package com.inventory.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InventoryRealtimeResponse {
    private String sku;
    private String warehouse;
    private Integer currentStock;
    private Integer orderedUnits;
    private Integer preparingShipments;
    private Integer inTransitShipments;
    private Integer deliveredShipments;
    private Integer availableToSell;
    private String riskLevel;
}
