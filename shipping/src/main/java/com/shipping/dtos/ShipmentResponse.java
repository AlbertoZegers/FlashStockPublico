package com.shipping.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ShipmentResponse {
    private String trackingNumber;
    private String orderNumber;
    private String carrier;
    private String courierName;
    private String status;
    private String eta;
}
