package com.order.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderResponse {
    private String orderNumber;
    private Long inventoryId;
    private String sku;
    private Integer quantity;
    private String customerFirstName;
    private String customerLastName;
    private String customerEmail;
    private String shippingAddress;
    private String status;
}
