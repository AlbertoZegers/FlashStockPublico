package com.inventory.dtos;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class InventoryResponse {
    private Long id;
    private String sku;
    private Long supplierId;
    private String name;
    private String description;
    private BigDecimal unitPrice;
    private BigDecimal price;
    private String imageUrl;
    private String category;
    private Integer quantity;
    private Integer stock;
    private String warehouse;
    private Boolean active;
}
