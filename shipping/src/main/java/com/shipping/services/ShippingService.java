package com.shipping.services;

import com.shipping.repos.OrderRepository;
import com.shipping.repos.ShipmentRepository;
import com.shipping.dtos.ShipmentLiveUpdateRequest;
import com.shipping.dtos.ShipmentRouteStepEtaResponse;
import com.shipping.dtos.ShipmentRequest;
import com.shipping.dtos.ShipmentResponse;
import com.shipping.dtos.ShipmentTrackingResponse;
import com.shipping.models.CustomerOrder;
import com.shipping.models.Shipment;
import com.shipping.services.factory.EtaStrategyFactory;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShippingService {
    private static final double CHILE_MIN_LAT = -56.0;
    private static final double CHILE_MAX_LAT = -17.0;
    private static final double CHILE_MIN_LNG = -110.0;
    private static final double CHILE_MAX_LNG = -66.0;

    private final ShipmentRepository dao;
    private final OrderRepository orderDao;

    @Value("${app.maps.google.api-key:}")
    private String googleApiKey;

    @Value("${app.maps.google.geocoding-url:https://maps.googleapis.com/maps/api/geocode/json}")
    private String googleGeocodingUrl;

    @Value("${app.maps.google.directions-url:https://maps.googleapis.com/maps/api/directions/json}")
    private String googleDirectionsUrl;

    @Value("${app.store.origin-lat:-33.4489}")
    private Double storeOriginLat;

    @Value("${app.store.origin-lng:-70.6693}")
    private Double storeOriginLng;

    @Value("${app.store.origin-address:Antonio Varas, Providencia, Santiago, Chile}")
    private String storeOriginAddress;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder().build();

    public List<ShipmentResponse> findAll() {
        return dao.findAll().stream().map(this::toResponse).toList();
    }

    @CircuitBreaker(name = "shippingCb", fallbackMethod = "shippingFallback")
    public ShipmentResponse create(ShipmentRequest request) {
        Shipment existing = dao.findByOrderNumber(request.getOrderNumber()).orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        var eta = EtaStrategyFactory.create(request.getCarrier()).eta();
        CustomerOrder order = orderDao.findByOrderNumber(request.getOrderNumber())
                .orElseThrow(() -> new IllegalArgumentException("No existe pedido para crear envio: " + request.getOrderNumber()));

        order.setStatus("proceso");
        orderDao.save(order);

        double[] origin = resolveStoreOrigin();
        double[] destination = geocodeAddress(order.getShippingAddress());
        RoutePlan routePlan = directionsRoute(origin[0], origin[1], destination[0], destination[1]);

        for (int attempt = 0; attempt < 5; attempt++) {
            Shipment shipment = Shipment.builder()
                    .trackingNumber(generateUniqueTrackingNumber())
                    .orderNumber(request.getOrderNumber())
                    .carrier(request.getCarrier())
                    .status("proceso")
                    .eta(eta)
                    .courierName("Repartidor " + request.getCarrier())
                    .originLat(origin[0])
                    .originLng(origin[1])
                    .destinationLat(destination[0])
                    .destinationLng(destination[1])
                    .courierLat(origin[0])
                    .courierLng(origin[1])
                    .routeGeoJson(buildLineGeoJson(routePlan.points()))
                    .routeStepsJson(writeStepsJson(routePlan.steps()))
                    .totalDurationSec(routePlan.totalDurationSec())
                    .lastUpdate(LocalDateTime.now())
                    .build();
            try {
                return toResponse(dao.save(shipment));
            } catch (DataIntegrityViolationException ex) {
                if (!isDuplicateKey(ex)) {
                    throw ex;
                }
                Shipment maybeCreated = dao.findByOrderNumber(request.getOrderNumber()).orElse(null);
                if (maybeCreated != null) {
                    return toResponse(maybeCreated);
                }
            }
        }

        throw new IllegalStateException("No fue posible generar tracking unico para el envio.");
    }

    public ShipmentResponse findByTrackingNumber(String trackingNumber) {
        Shipment shipment = dao.findByTrackingNumber(trackingNumber)
                .orElseThrow(() -> new IllegalArgumentException("No existe envio: " + trackingNumber));
        return toResponse(shipment);
    }

    public ShipmentResponse updateStatus(String trackingNumber, String status) {
        Shipment shipment = dao.findByTrackingNumber(trackingNumber)
                .orElseThrow(() -> new IllegalArgumentException("No existe envio: " + trackingNumber));
        String normalized = normalizeShipmentStatus(status);
        shipment.setStatus(normalized);
        moveCourierByStatus(shipment, normalized);
        syncOrderStatus(shipment.getOrderNumber(), normalized);
        return toResponse(dao.save(shipment));
    }

    public ShipmentTrackingResponse updateTrackingLive(String trackingNumber, ShipmentLiveUpdateRequest request) {
        Shipment shipment = dao.findByTrackingNumber(trackingNumber)
                .orElseThrow(() -> new IllegalArgumentException("No existe envio: " + trackingNumber));

        if (request != null) {
            if (request.getCourierName() != null && !request.getCourierName().isBlank()) {
                shipment.setCourierName(request.getCourierName().trim());
            }
            if (request.getCourierLat() != null) {
                shipment.setCourierLat(clampLatToChile(request.getCourierLat()));
            }
            if (request.getCourierLng() != null) {
                shipment.setCourierLng(clampLngToChile(request.getCourierLng()));
            }
            if (request.getStatus() != null && !request.getStatus().isBlank()) {
                String normalized = normalizeShipmentStatus(request.getStatus());
                shipment.setStatus(normalized);
                syncOrderStatus(shipment.getOrderNumber(), normalized);
            }
        }

        shipment.setLastUpdate(LocalDateTime.now());
        dao.save(shipment);
        return getTrackingSnapshot(trackingNumber);
    }

    public ShipmentTrackingResponse getTrackingSnapshot(String trackingNumber) {
        Shipment shipment = dao.findByTrackingNumber(trackingNumber)
                .orElseThrow(() -> new IllegalArgumentException("No existe envio: " + trackingNumber));

        CustomerOrder order = orderDao.findByOrderNumber(shipment.getOrderNumber())
                .orElseThrow(() -> new IllegalArgumentException("No existe pedido para tracking: " + shipment.getOrderNumber()));

        String status = normalizeOrderStatus(order.getStatus());
        double[] fixedOrigin = resolveStoreOrigin();
        double[] origin = new double[] {fixedOrigin[0], fixedOrigin[1]};
        double[] destination = shipment.getDestinationLat() != null && shipment.getDestinationLng() != null
                ? new double[] {shipment.getDestinationLat(), shipment.getDestinationLng()}
                : geocodeAddress(order.getShippingAddress());

        boolean originMismatch = shipment.getOriginLat() == null
            || shipment.getOriginLng() == null
            || areFarApart(shipment.getOriginLat(), shipment.getOriginLng(), fixedOrigin[0], fixedOrigin[1]);

        boolean requiresChileCorrection = !isChileCoordinate(origin[0], origin[1]) || !isChileCoordinate(destination[0], destination[1]);

        if (originMismatch || shipment.getDestinationLat() == null || shipment.getDestinationLng() == null || shipment.getRouteGeoJson() == null || requiresChileCorrection) {
            origin = new double[] {fixedOrigin[0], fixedOrigin[1]};
            destination = geocodeAddress(order.getShippingAddress());
            RoutePlan routePlan = directionsRoute(origin[0], origin[1], destination[0], destination[1]);
            shipment.setOriginLat(origin[0]);
            shipment.setOriginLng(origin[1]);
            shipment.setDestinationLat(destination[0]);
            shipment.setDestinationLng(destination[1]);
            shipment.setRouteGeoJson(buildLineGeoJson(routePlan.points()));
            shipment.setRouteStepsJson(writeStepsJson(routePlan.steps()));
            shipment.setTotalDurationSec(routePlan.totalDurationSec());
        }

        int progress = progressByStatus(status);

        double courierLat = shipment.getCourierLat() == null ? interpolate(origin[0], destination[0], progress / 100.0) : shipment.getCourierLat();
        double courierLng = shipment.getCourierLng() == null ? interpolate(origin[1], destination[1], progress / 100.0) : shipment.getCourierLng();

        shipment.setCourierLat(courierLat);
        shipment.setCourierLng(courierLng);
        shipment.setLastUpdate(LocalDateTime.now());
        dao.save(shipment);

        List<ShipmentRouteStepEtaResponse> steps = readStepsJson(shipment.getRouteStepsJson());
        int totalDurationSec = shipment.getTotalDurationSec() == null
            ? steps.stream().map(ShipmentRouteStepEtaResponse::getDurationSec).filter(v -> v != null).reduce(0, Integer::sum)
            : shipment.getTotalDurationSec();
        int remainingDurationSec = Math.max(0, (int) Math.round(totalDurationSec * ((100 - progress) / 100.0)));

        return ShipmentTrackingResponse.builder()
                .trackingNumber(shipment.getTrackingNumber())
                .orderNumber(order.getOrderNumber())
                .orderStatus(status)
                .shipmentStatus(normalizeShipmentStatus(shipment.getStatus()))
                .shippingAddress(order.getShippingAddress())
                .courierName(shipment.getCourierName() == null ? "Repartidor FlashStock" : shipment.getCourierName())
                .routeGeoJson(shipment.getRouteGeoJson())
                .originLat(origin[0])
                .originLng(origin[1])
                .destinationLat(destination[0])
                .destinationLng(destination[1])
                .courierLat(courierLat)
                .courierLng(courierLng)
                .progressPercent(progress)
                .totalDurationSec(totalDurationSec)
                .remainingDurationSec(remainingDurationSec)
                .totalDurationText(formatDuration(totalDurationSec))
                .remainingDurationText(formatDuration(remainingDurationSec))
                .startedAt(shipment.getCreatedAt() == null
                    ? LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    : shipment.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .routeSteps(steps)
                .lastUpdate(shipment.getLastUpdate() == null
                        ? LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                        : shipment.getLastUpdate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .build();
    }

    public ShipmentResponse shippingFallback(ShipmentRequest request, Throwable throwable) {
        return ShipmentResponse.builder()
                .trackingNumber("N/A")
                .orderNumber(request.getOrderNumber())
                .carrier(request.getCarrier())
                .status("PENDING_RETRY")
                .eta("UNKNOWN")
                .build();
    }

    private ShipmentResponse toResponse(Shipment shipment) {
        return ShipmentResponse.builder()
                .trackingNumber(shipment.getTrackingNumber())
                .orderNumber(shipment.getOrderNumber())
                .carrier(shipment.getCarrier())
                .courierName(shipment.getCourierName())
                .status(shipment.getStatus())
                .eta(shipment.getEta())
                .build();
    }

    private void moveCourierByStatus(Shipment shipment, String shipmentStatus) {
        if (shipment.getOriginLat() == null || shipment.getOriginLng() == null || shipment.getDestinationLat() == null || shipment.getDestinationLng() == null) {
            return;
        }

        String orderStatus = toOrderStatus(shipmentStatus);
        int progress = progressByStatus(orderStatus);
        shipment.setCourierLat(interpolate(shipment.getOriginLat(), shipment.getDestinationLat(), progress / 100.0));
        shipment.setCourierLng(interpolate(shipment.getOriginLng(), shipment.getDestinationLng(), progress / 100.0));
    }

    private void syncOrderStatus(String orderNumber, String shipmentStatus) {
        orderDao.findByOrderNumber(orderNumber).ifPresent(order -> {
            String nextStatus = toOrderStatus(shipmentStatus);
            order.setStatus(nextStatus);
            orderDao.save(order);
        });
    }

    private String toOrderStatus(String shipmentStatus) {
        if (shipmentStatus.contains("cancel")) {
            return "cancelado";
        }
        if (shipmentStatus.contains("complet") || shipmentStatus.contains("deliver")) {
            return "completado";
        }
        if (shipmentStatus.contains("enviado") || shipmentStatus.contains("transit") || shipmentStatus.contains("shipped")) {
            return "enviado";
        }
        return "proceso";
    }

    private String normalizeShipmentStatus(String status) {
        if (status == null) {
            return "proceso";
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return "proceso";
        }
        return normalized;
    }

    private String normalizeOrderStatus(String status) {
        if (status == null) {
            return "proceso";
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "enviado", "cancelado", "completado", "proceso" -> normalized;
            default -> "proceso";
        };
    }

    private int progressByStatus(String orderStatus) {
        return switch (orderStatus) {
            case "proceso" -> 15;
            case "enviado" -> 65;
            case "cancelado" -> 35;
            case "completado" -> 100;
            default -> 15;
        };
    }

    private double[] resolveStoreOrigin() {
        if (storeOriginAddress != null && !storeOriginAddress.isBlank()) {
            double[] geocoded = geocodeAddress(storeOriginAddress);
            if (isChileCoordinate(geocoded[0], geocoded[1])) {
                return geocoded;
            }
        }

        if (storeOriginLat != null && storeOriginLng != null && isChileCoordinate(storeOriginLat, storeOriginLng)) {
            return new double[] {storeOriginLat, storeOriginLng};
        }

        return new double[] {-33.4489, -70.6693};
    }

    private boolean areFarApart(double latA, double lngA, double latB, double lngB) {
        double latDiff = Math.abs(latA - latB);
        double lngDiff = Math.abs(lngA - lngB);
        return latDiff > 0.001 || lngDiff > 0.001;
    }

    private double[] geocodeAddress(String address) {
        String normalizedAddress = forceChileAddress(address);
        if (googleApiKey == null || googleApiKey.isBlank() || normalizedAddress.isBlank()) {
            return fallbackCoordinate(address);
        }

        try {
            String url = googleGeocodingUrl
                    + "?address=" + URLEncoder.encode(normalizedAddress, StandardCharsets.UTF_8)
                    + "&components=" + URLEncoder.encode("country:CL", StandardCharsets.UTF_8)
                    + "&region=cl"
                    + "&language=es"
                    + "&key=" + URLEncoder.encode(googleApiKey, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(url))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode firstResult = root.path("results").path(0);
            if (isGoogleResultInChile(firstResult)) {
                JsonNode location = firstResult.path("geometry").path("location");
                if (location.has("lat") && location.has("lng")) {
                    return new double[] {location.path("lat").asDouble(), location.path("lng").asDouble()};
                }
            }
        } catch (Exception ignored) {
        }

        return fallbackCoordinate(address);
    }

    private double interpolate(double start, double end, double progress) {
        return start + (end - start) * progress;
    }

    private RoutePlan directionsRoute(double originLat, double originLng, double destinationLat, double destinationLng) {
        if (googleApiKey == null || googleApiKey.isBlank()) {
            return fallbackRoute(originLat, originLng, destinationLat, destinationLng);
        }

        try {
            String url = googleDirectionsUrl
                    + "?origin=" + originLat + "," + originLng
                    + "&destination=" + destinationLat + "," + destinationLng
                    + "&mode=driving"
                    + "&region=cl"
                    + "&language=es"
                    + "&key=" + URLEncoder.encode(googleApiKey, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .GET()
                    .uri(URI.create(url))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());
            String encoded = root.path("routes").path(0).path("overview_polyline").path("points").asText("");
            if (!encoded.isBlank()) {
                List<double[]> points = decodePolyline(encoded);
                List<ShipmentRouteStepEtaResponse> steps = parseStepEtas(root);
                int totalDuration = steps.stream().map(ShipmentRouteStepEtaResponse::getDurationSec).filter(v -> v != null).reduce(0, Integer::sum);
                if (totalDuration <= 0) {
                    totalDuration = 1800;
                }
                return new RoutePlan(points, steps, totalDuration);
            }
        } catch (Exception ignored) {
        }

        return fallbackRoute(originLat, originLng, destinationLat, destinationLng);
    }

    private List<double[]> decodePolyline(String encoded) {
        List<double[]> polyline = new ArrayList<>();
        int index = 0;
        int lat = 0;
        int lng = 0;

        while (index < encoded.length()) {
            int b;
            int shift = 0;
            int result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlat = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1);
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlng = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1);
            lng += dlng;

            double pointLat = lat / 1E5;
            double pointLng = lng / 1E5;
            polyline.add(new double[] {pointLat, pointLng});
        }

        return polyline;
    }

    private RoutePlan fallbackRoute(double originLat, double originLng, double destinationLat, double destinationLng) {
        List<double[]> points = new ArrayList<>();
        points.add(new double[] {originLat, originLng});
        points.add(new double[] {(originLat + destinationLat) / 2.0 + 0.01, (originLng + destinationLng) / 2.0});
        points.add(new double[] {destinationLat, destinationLng});

        List<ShipmentRouteStepEtaResponse> steps = new ArrayList<>();
        steps.add(ShipmentRouteStepEtaResponse.builder()
                .stepIndex(1)
                .instruction("Ruta principal")
                .distanceText("N/A")
                .durationText("30 min")
                .durationSec(1800)
                .cumulativeDurationSec(1800)
                .startLat(originLat)
                .startLng(originLng)
                .endLat(destinationLat)
                .endLng(destinationLng)
                .build());

        return new RoutePlan(points, steps, 1800);
    }

    private List<ShipmentRouteStepEtaResponse> parseStepEtas(JsonNode root) {
        JsonNode stepsNode = root.path("routes").path(0).path("legs").path(0).path("steps");
        if (stepsNode == null || !stepsNode.isArray()) {
            return Collections.emptyList();
        }

        List<ShipmentRouteStepEtaResponse> steps = new ArrayList<>();
        int cumulative = 0;
        int idx = 1;
        for (JsonNode stepNode : stepsNode) {
            int durationSec = stepNode.path("duration").path("value").asInt(0);
            cumulative += durationSec;

            steps.add(ShipmentRouteStepEtaResponse.builder()
                    .stepIndex(idx++)
                    .instruction(stripHtml(stepNode.path("html_instructions").asText("Tramo")))
                    .distanceText(stepNode.path("distance").path("text").asText("N/A"))
                    .durationText(stepNode.path("duration").path("text").asText("N/A"))
                    .durationSec(durationSec)
                    .cumulativeDurationSec(cumulative)
                    .startLat(stepNode.path("start_location").path("lat").asDouble())
                    .startLng(stepNode.path("start_location").path("lng").asDouble())
                    .endLat(stepNode.path("end_location").path("lat").asDouble())
                    .endLng(stepNode.path("end_location").path("lng").asDouble())
                    .build());
        }
        return steps;
    }

    private String stripHtml(String text) {
        if (text == null) {
            return "";
        }
        return text.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    private String writeStepsJson(List<ShipmentRouteStepEtaResponse> steps) {
        try {
            return objectMapper.writeValueAsString(steps == null ? Collections.emptyList() : steps);
        } catch (Exception ignored) {
            return "[]";
        }
    }

    private List<ShipmentRouteStepEtaResponse> readStepsJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ShipmentRouteStepEtaResponse>>() {});
        } catch (Exception ignored) {
            return Collections.emptyList();
        }
    }

    private String formatDuration(int durationSec) {
        int totalMin = Math.max(0, durationSec) / 60;
        int hours = totalMin / 60;
        int mins = totalMin % 60;
        if (hours > 0) {
            return hours + " h " + mins + " min";
        }
        return mins + " min";
    }

    private String forceChileAddress(String address) {
        if (address == null) {
            return "";
        }

        String normalized = address.trim();
        if (normalized.isBlank()) {
            return "";
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        if (!lower.contains("chile")) {
            normalized = normalized + ", Chile";
        }

        return normalized;
    }

    private boolean isGoogleResultInChile(JsonNode resultNode) {
        if (resultNode == null || resultNode.isMissingNode()) {
            return false;
        }

        JsonNode components = resultNode.path("address_components");
        if (components == null || !components.isArray()) {
            return false;
        }

        for (JsonNode component : components) {
            JsonNode types = component.path("types");
            if (types != null && types.isArray()) {
                boolean isCountry = false;
                for (JsonNode t : types) {
                    if ("country".equalsIgnoreCase(t.asText(""))) {
                        isCountry = true;
                        break;
                    }
                }

                if (isCountry) {
                    String shortName = component.path("short_name").asText("");
                    String longName = component.path("long_name").asText("");
                    return "CL".equalsIgnoreCase(shortName) || "CHILE".equalsIgnoreCase(longName);
                }
            }
        }

        return false;
    }

    private boolean isChileCoordinate(double lat, double lng) {
        return lat >= CHILE_MIN_LAT && lat <= CHILE_MAX_LAT && lng >= CHILE_MIN_LNG && lng <= CHILE_MAX_LNG;
    }

    private double clampLatToChile(double lat) {
        return Math.max(CHILE_MIN_LAT, Math.min(CHILE_MAX_LAT, lat));
    }

    private double clampLngToChile(double lng) {
        return Math.max(CHILE_MIN_LNG, Math.min(CHILE_MAX_LNG, lng));
    }

    private double[] fallbackCoordinate(String seed) {
        String base = seed == null ? "" : seed;
        int hash = Math.abs(base.hashCode());
        double lat = -33.35 - ((hash % 7000) / 100000.0);
        double lng = -70.58 - (((hash / 10) % 7000) / 100000.0);
        return new double[] {lat, lng};
    }

    private String buildLineGeoJson(List<double[]> route) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"Feature\",\"geometry\":{\"type\":\"LineString\",\"coordinates\":[");
        for (int i = 0; i < route.size(); i++) {
            double[] point = route.get(i);
            if (i > 0) {
                sb.append(',');
            }
            sb.append('[').append(round(point[1])).append(',').append(round(point[0])).append(']');
        }
        sb.append("]}}");
        return sb.toString();
    }

    private String round(double value) {
        return String.format(Locale.US, "%.6f", value);
    }

    private String generateUniqueTrackingNumber() {
        for (int i = 0; i < 8; i++) {
            String candidate = "TRK-" + UUID.randomUUID().toString().substring(0, 8);
            if (!dao.existsByTrackingNumber(candidate)) {
                return candidate;
            }
        }
        return "TRK-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private boolean isDuplicateKey(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause() == null ? ex.getMessage() : ex.getMostSpecificCause().getMessage();
        if (msg == null) {
            return false;
        }
        String normalized = msg.toLowerCase();
        return normalized.contains("duplicate key") || normalized.contains("sqlstate: 23505");
    }

    private record RoutePlan(List<double[]> points, List<ShipmentRouteStepEtaResponse> steps, Integer totalDurationSec) {
    }
}
