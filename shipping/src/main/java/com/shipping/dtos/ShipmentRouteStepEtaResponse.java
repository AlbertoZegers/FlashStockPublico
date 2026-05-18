package com.shipping.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ShipmentRouteStepEtaResponse {
    private Integer stepIndex;
    private String instruction;
    private String distanceText;
    private String durationText;
    private Integer durationSec;
    private Integer cumulativeDurationSec;
    private Double startLat;
    private Double startLng;
    private Double endLat;
    private Double endLng;
}
