package com.order.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderCustomerShippingResponse {
    private Long orderId;
    private String orderNumber;
    private String orderStatus;
    private String shipmentTrackingNumber;
    private String shipmentStatus;
    private String carrier;
    private String customerFirstName;
    private String customerLastName;
    private String customerEmail;
    private String shippingAddress;
}
