package com.order.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OrderRequest {
    private Long inventoryId;

    @NotBlank
    private String sku;
    @Min(1)
    private Integer quantity;
    private String customerFirstName;
    private String customerLastName;
    private String customerEmail;
    private String shippingAddress;
}
