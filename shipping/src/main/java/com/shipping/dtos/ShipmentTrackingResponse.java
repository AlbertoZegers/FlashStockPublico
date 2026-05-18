package com.shipping.dtos;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ShipmentTrackingResponse {
    private String trackingNumber;
    private String orderNumber;
    private String orderStatus;
    private String shipmentStatus;
    private String shippingAddress;
    private String courierName;
    private String routeGeoJson;
    private Double originLat;
    private Double originLng;
    private Double destinationLat;
    private Double destinationLng;
    private Double courierLat;
    private Double courierLng;
    private Integer progressPercent;
    private Integer totalDurationSec;
    private Integer remainingDurationSec;
    private String totalDurationText;
    private String remainingDurationText;
    private String startedAt;
    private List<ShipmentRouteStepEtaResponse> routeSteps;
    private String lastUpdate;
}
