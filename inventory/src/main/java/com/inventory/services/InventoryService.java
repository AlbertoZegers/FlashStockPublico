package com.inventory.services;

import com.inventory.daos.CartDao;
import com.inventory.daos.InventoryDao;
import com.inventory.daos.OrderDao;
import com.inventory.daos.ShipmentDao;
import com.inventory.dtos.InventoryRequest;
import com.inventory.dtos.InventoryRealtimeResponse;
import com.inventory.dtos.InventoryResponse;
import com.inventory.models.Inventory;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InventoryService {
    private final CartDao cartDao;
    private final InventoryDao dao;
    private final OrderDao orderDao;
    private final ShipmentDao shipmentDao;

    public List<InventoryResponse> findAll() {
        Map<String, Integer> reservedBySku = cartDao.reservedUnitsBySku();
        return dao.findAll().stream()
            .filter(entity -> !Boolean.FALSE.equals(entity.getActive()))
            .map(entity -> toResponseWithAvailability(entity, reservedBySku))
            .toList();
    }

    public InventoryResponse create(InventoryRequest request) {
        String normalizedSku = request.getSku() == null ? "" : request.getSku().trim();
        if (normalizedSku.isBlank()) {
            throw new IllegalArgumentException("El SKU es obligatorio");
        }
        if (dao.findBySku(normalizedSku).isPresent()) {
            throw new IllegalStateException("Ya existe un producto con SKU: " + normalizedSku);
        }

        if (request.getUnitPrice() == null && request.getPrice() == null) {
            throw new IllegalArgumentException("Debes informar unitPrice o price para el producto");
        }
        Integer quantity = request.getQuantity() != null ? request.getQuantity() : request.getStock();
        Inventory entity = Inventory.builder()
                .sku(normalizedSku)
            .supplierId(request.getSupplierId())
                .name(request.getName())
                .description(request.getDescription())
            .unitPrice(request.getUnitPrice() != null ? request.getUnitPrice() : request.getPrice())
            .price(request.getPrice() != null ? request.getPrice() : request.getUnitPrice())
                .imageUrl(request.getImageUrl())
                .category(request.getCategory())
            .quantity(quantity == null ? 0 : quantity)
            .stock(quantity == null ? 0 : quantity)
                .warehouse(request.getWarehouse())
                .active(request.getActive() == null ? Boolean.TRUE : request.getActive())
                .build();
        try {
            return toResponse(dao.save(entity));
        } catch (DataIntegrityViolationException ex) {
            if (isDuplicateKey(ex)) {
                throw new IllegalStateException("No se pudo crear el producto: SKU duplicado " + normalizedSku);
            }
            throw ex;
        }
    }

    public InventoryResponse findBySku(String sku) {
        Inventory entity = dao.findBySku(sku)
                .orElseThrow(() -> new IllegalArgumentException("No existe inventario para SKU: " + sku));
        Map<String, Integer> reservedBySku = cartDao.reservedUnitsBySku();
        return toResponseWithAvailability(entity, reservedBySku);
    }

    public InventoryResponse updateQuantity(String sku, Integer quantity) {
        Inventory entity = dao.findBySku(sku)
                .orElseThrow(() -> new IllegalArgumentException("No existe inventario para SKU: " + sku));
        entity.setQuantity(quantity);
        return toResponse(dao.save(entity));
    }

    public InventoryResponse updateProduct(String sku, InventoryRequest request) {
        Inventory entity = dao.findBySku(sku)
                .orElseThrow(() -> new IllegalArgumentException("No existe inventario para SKU: " + sku));

        if (request.getUnitPrice() == null && request.getPrice() == null) {
            throw new IllegalArgumentException("Debes informar unitPrice o price para el producto");
        }

        Integer quantity = request.getQuantity() != null ? request.getQuantity() : request.getStock();

        entity.setSupplierId(request.getSupplierId());
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());
        entity.setUnitPrice(request.getUnitPrice() != null ? request.getUnitPrice() : request.getPrice());
        entity.setPrice(request.getPrice() != null ? request.getPrice() : request.getUnitPrice());
        entity.setImageUrl(request.getImageUrl());
        entity.setCategory(request.getCategory());
        entity.setQuantity(quantity == null ? 0 : quantity);
        entity.setStock(quantity == null ? 0 : quantity);
        entity.setWarehouse(request.getWarehouse());
        entity.setActive(request.getActive() == null ? Boolean.TRUE : request.getActive());

        return toResponse(dao.save(entity));
    }

    @Transactional
    public void deleteBySku(String sku) {
        Inventory entity = dao.findBySku(sku).orElse(null);
        if (entity == null) {
            throw new IllegalArgumentException("No existe inventario para SKU: " + sku);
        }

        try {
            // Remove cart references first to avoid FK violations on inventory delete.
            cartDao.deleteBySku(sku);
            dao.deleteBySku(sku);
        } catch (DataIntegrityViolationException ex) {
            throw new IllegalStateException(
                    "No se puede eliminar el producto con SKU " + sku + " porque tiene referencias activas.",
                    ex
            );
        }
    }

    public List<InventoryRealtimeResponse> findRealtimeStatus() {
        List<Inventory> inventories = dao.findAll().stream()
            .filter(entity -> !Boolean.FALSE.equals(entity.getActive()))
            .toList();
        var orders = orderDao.findAll();
        var shipments = shipmentDao.findAll();
        Map<String, Integer> reservedBySku = cartDao.reservedUnitsBySku();

        Map<String, Integer> orderedUnitsBySku = new HashMap<>();
        Map<String, String> skuByOrderNumber = new HashMap<>();

        for (var order : orders) {
            orderedUnitsBySku.merge(order.getSku(), order.getQuantity(), Integer::sum);
            skuByOrderNumber.put(order.getOrderNumber(), order.getSku());
        }

        Map<String, Integer> preparingBySku = new HashMap<>();
        Map<String, Integer> inTransitBySku = new HashMap<>();
        Map<String, Integer> deliveredBySku = new HashMap<>();

        for (var shipment : shipments) {
            String sku = skuByOrderNumber.get(shipment.getOrderNumber());
            if (sku == null) {
                continue;
            }

            String normalizedStatus = shipment.getStatus() == null
                    ? ""
                    : shipment.getStatus().trim().toUpperCase();

            if (normalizedStatus.contains("DELIVER")) {
                deliveredBySku.merge(sku, 1, Integer::sum);
            } else if (normalizedStatus.contains("TRANSIT") || normalizedStatus.contains("SHIPPED")) {
                inTransitBySku.merge(sku, 1, Integer::sum);
            } else {
                preparingBySku.merge(sku, 1, Integer::sum);
            }
        }

        return inventories.stream().map(inventory -> {
            int currentStock = inventory.getQuantity() == null ? 0 : inventory.getQuantity();
            int orderedUnits = orderedUnitsBySku.getOrDefault(inventory.getSku(), 0);
            int reservedUnits = Math.max(0, reservedBySku.getOrDefault(inventory.getSku(), 0));
            int availableToSell = Math.max(currentStock - reservedUnits, 0);
            String riskLevel = calculateRiskLevel(currentStock, reservedUnits);

            return InventoryRealtimeResponse.builder()
                    .sku(inventory.getSku())
                    .warehouse(inventory.getWarehouse())
                    .currentStock(currentStock)
                    .orderedUnits(orderedUnits)
                    .preparingShipments(preparingBySku.getOrDefault(inventory.getSku(), 0))
                    .inTransitShipments(inTransitBySku.getOrDefault(inventory.getSku(), 0))
                    .deliveredShipments(deliveredBySku.getOrDefault(inventory.getSku(), 0))
                    .availableToSell(availableToSell)
                    .riskLevel(riskLevel)
                    .build();
        }).toList();
    }

    private String calculateRiskLevel(int currentStock, int orderedUnits) {
        int projected = currentStock - orderedUnits;
        if (projected <= 0) {
            return "CRITICAL";
        }
        if (projected <= 5) {
            return "LOW";
        }
        return "HEALTHY";
    }

    private InventoryResponse toResponse(Inventory entity) {
        return toResponseWithAvailability(entity, Map.of());
    }

    private InventoryResponse toResponseWithAvailability(Inventory entity, Map<String, Integer> reservedBySku) {
        int currentStock = entity.getQuantity() == null ? 0 : entity.getQuantity();
        int reservedUnits = Math.max(0, reservedBySku.getOrDefault(entity.getSku(), 0));
        int availableToSell = Math.max(0, currentStock - reservedUnits);

        return InventoryResponse.builder()
                .id(entity.getId())
                .sku(entity.getSku())
                .supplierId(entity.getSupplierId())
                .name(entity.getName())
                .description(entity.getDescription())
                .unitPrice(entity.getUnitPrice())
                .price(entity.getPrice())
                .imageUrl(entity.getImageUrl())
                .category(entity.getCategory())
                .quantity(availableToSell)
                .stock(currentStock)
                .warehouse(entity.getWarehouse())
                .active(entity.getActive())
                .build();
    }

    private boolean isDuplicateKey(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause() == null ? ex.getMessage() : ex.getMostSpecificCause().getMessage();
        if (msg == null) {
            return false;
        }
        String normalized = msg.toLowerCase();
        return normalized.contains("duplicate key") || normalized.contains("sqlstate: 23505");
    }
}
