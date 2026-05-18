package com.auth.services.admin;

import com.auth.daos.CartDao;
import com.auth.daos.InventoryDao;
import com.auth.daos.OrderDao;
import com.auth.daos.ShipmentDao;
import com.auth.dtos.AdminMetricsResponse;
import com.auth.dtos.AdminSkuMetricResponse;
import com.auth.models.CustomerOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    private final CartDao cartDao;
    private final InventoryDao inventoryDao;
    private final OrderDao orderDao;
    private final ShipmentDao shipmentDao;

    @Value("${app.metrics.cashflow.unit-value:12.5}")
    private double unitValue;

    public AdminMetricsResponse getAdminMetrics() {
        var inventories = inventoryDao.findAll().stream()
            .filter(entity -> !Boolean.FALSE.equals(entity.getActive()))
            .toList();
        var orders = orderDao.findAll();
        var shipments = shipmentDao.findAll();
        Map<String, Integer> reservedBySku = cartDao.reservedUnitsBySku();

        Map<String, Integer> orderedBySku = new HashMap<>();
        Map<String, CustomerOrder> orderByNumber = new HashMap<>();
        for (CustomerOrder order : orders) {
            String sku = order.getSku();
            int quantity = order.getQuantity() == null ? 0 : order.getQuantity();
            orderedBySku.merge(sku, quantity, Integer::sum);
            orderByNumber.put(order.getOrderNumber(), order);
        }

        int totalStock = inventories.stream().mapToInt(i -> i.getQuantity() == null ? 0 : i.getQuantity()).sum();

        int lowRisk = 0;
        int criticalRisk = 0;

        List<AdminSkuMetricResponse> skuMetrics = inventories.stream().map(inventory -> {
            int stock = inventory.getQuantity() == null ? 0 : inventory.getQuantity();
            int ordered = orderedBySku.getOrDefault(inventory.getSku(), 0);
            int reserved = Math.max(0, reservedBySku.getOrDefault(inventory.getSku(), 0));
            int available = Math.max(stock - reserved, 0);
            String risk = riskLevel(stock, reserved);
            return AdminSkuMetricResponse.builder()
                    .sku(inventory.getSku())
                    .warehouse(inventory.getWarehouse())
                    .currentStock(stock)
                    .orderedUnits(ordered)
                    .availableUnits(available)
                    .riskLevel(risk)
                    .build();
        }).toList();

        for (AdminSkuMetricResponse metric : skuMetrics) {
            if ("CRITICAL".equals(metric.getRiskLevel())) {
                criticalRisk++;
            } else if ("LOW".equals(metric.getRiskLevel())) {
                lowRisk++;
            }
        }

        int createdOrders = 0;
        int completedOrders = 0;
        int cancelledOrders = 0;

        for (CustomerOrder order : orders) {
            String normalizedStatus = normalize(order.getStatus());
            if (normalizedStatus.contains("CANCEL")) {
                cancelledOrders++;
            } else if (normalizedStatus.contains("COMPLETE") || normalizedStatus.contains("PAID") || normalizedStatus.contains("CLOSED")) {
                completedOrders++;
            } else {
                createdOrders++;
            }
        }

        int preparingShipments = 0;
        int inTransitShipments = 0;
        int deliveredShipments = 0;
        Set<String> deliveredOrderNumbers = new HashSet<>();

        for (var shipment : shipments) {
            String normalizedStatus = normalize(shipment.getStatus());
            if (normalizedStatus.contains("DELIVER")) {
                deliveredShipments++;
                deliveredOrderNumbers.add(shipment.getOrderNumber());
            } else if (normalizedStatus.contains("TRANSIT") || normalizedStatus.contains("SHIPPED")) {
                inTransitShipments++;
            } else {
                preparingShipments++;
            }
        }

        double grossCashflow = orders.stream()
                .mapToDouble(order -> (order.getQuantity() == null ? 0 : order.getQuantity()) * unitValue)
                .sum();

        double realizedCashflow = orders.stream()
                .filter(order -> deliveredOrderNumbers.contains(order.getOrderNumber()) || isCompletedOrder(order.getStatus()))
                .mapToDouble(order -> (order.getQuantity() == null ? 0 : order.getQuantity()) * unitValue)
                .sum();

        double pendingCashflow = Math.max(grossCashflow - realizedCashflow, 0);

        return AdminMetricsResponse.builder()
                .timestamp(LocalDateTime.now().toString())
                .inventorySkuCount(inventories.size())
                .totalStock(totalStock)
                .lowRiskSkuCount(lowRisk)
                .criticalRiskSkuCount(criticalRisk)
                .totalOrders(orders.size())
                .createdOrders(createdOrders)
                .completedOrders(completedOrders)
                .cancelledOrders(cancelledOrders)
                .totalShipments(shipments.size())
                .preparingShipments(preparingShipments)
                .inTransitShipments(inTransitShipments)
                .deliveredShipments(deliveredShipments)
                .grossCashflow(roundMoney(grossCashflow))
                .realizedCashflow(roundMoney(realizedCashflow))
                .pendingCashflow(roundMoney(pendingCashflow))
                .skuMetrics(skuMetrics)
                .build();
    }

    private boolean isCompletedOrder(String status) {
        String normalized = normalize(status);
        return normalized.contains("COMPLETE") || normalized.contains("PAID") || normalized.contains("CLOSED");
    }

    private String riskLevel(int currentStock, int orderedUnits) {
        int projected = currentStock - orderedUnits;
        if (projected <= 0) {
            return "CRITICAL";
        }
        if (projected <= 5) {
            return "LOW";
        }
        return "HEALTHY";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    private double roundMoney(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
