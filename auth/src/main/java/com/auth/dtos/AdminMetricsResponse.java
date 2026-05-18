package com.auth.dtos;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AdminMetricsResponse {
    private String timestamp;

    private Integer inventorySkuCount;
    private Integer totalStock;
    private Integer lowRiskSkuCount;
    private Integer criticalRiskSkuCount;

    private Integer totalOrders;
    private Integer createdOrders;
    private Integer completedOrders;
    private Integer cancelledOrders;

    private Integer totalShipments;
    private Integer preparingShipments;
    private Integer inTransitShipments;
    private Integer deliveredShipments;

    private Double grossCashflow;
    private Double realizedCashflow;
    private Double pendingCashflow;

    private List<AdminSkuMetricResponse> skuMetrics;
}
