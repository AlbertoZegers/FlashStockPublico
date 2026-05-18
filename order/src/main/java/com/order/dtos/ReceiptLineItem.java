package com.order.dtos;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ReceiptLineItem {
    private Long inventoryId;
    private String sku;
    private String productName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;
    private String orderNumber;
}
