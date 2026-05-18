package com.order.dtos;

import lombok.Data;

@Data
public class ReceiptShipmentInfo {
    private String orderNumber;
    private String trackingNumber;
    private String carrier;
    private String courierName;
    private String status;
    private String eta;
}
