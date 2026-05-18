package com.auth.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminSkuMetricResponse {
    private String sku;
    private String warehouse;
    private Integer currentStock;
    private Integer orderedUnits;
    private Integer availableUnits;
    private String riskLevel;
}
