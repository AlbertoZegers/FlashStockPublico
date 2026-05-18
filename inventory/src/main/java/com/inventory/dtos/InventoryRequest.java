package com.inventory.dtos;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InventoryRequest {
    @NotBlank
    private String sku;

    private Long supplierId;

    @NotBlank
    private String name;

    private String description;

    @DecimalMin(value = "0.0", inclusive = true)
    private BigDecimal unitPrice;

    @DecimalMin(value = "0.0", inclusive = true)
    private BigDecimal price;

    private String imageUrl;

    private String category;

    @Min(0)
    private Integer quantity;

    @Min(0)
    private Integer stock;

    @NotBlank
    private String warehouse;

    private Boolean active;
}
