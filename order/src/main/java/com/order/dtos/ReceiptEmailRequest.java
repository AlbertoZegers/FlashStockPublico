package com.order.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ReceiptEmailRequest {
    @NotBlank
    private String receiptNumber;

    private String createdAt;

    @NotBlank
    private String customerEmail;

    private String customerFirstName;
    private String customerLastName;
    private String shippingAddress;

    @NotNull
    private BigDecimal subtotal;

    @NotNull
    private BigDecimal shipping;

    @NotNull
    private BigDecimal discount;

    @NotNull
    private BigDecimal total;

    private List<ReceiptLineItem> items;
    private List<ReceiptShipmentInfo> shipments;
}
