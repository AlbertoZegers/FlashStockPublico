package com.inventory.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "inventory")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Inventory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String sku;

    @Column(name = "supplier_id")
    private Long supplierId;

    @Column(nullable = false)
    private Integer quantity;

    @Column
    private Integer stock;

    @Column(nullable = false)
    private String warehouse;

    @Column(nullable = false)
    private String name;

    @Column(length = 1200)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    @Column(length = 1024)
    private String imageUrl;

    @Column(length = 100)
    private String category;

    @Column(nullable = false)
    private Boolean active;

    @Version
    private Long version;

    @PrePersist
    @PreUpdate
    private void syncLegacyAliases() {
        if (stock == null && quantity != null) {
            stock = quantity;
        }
        if (quantity == null && stock != null) {
            quantity = stock;
        }
        if (price == null && unitPrice != null) {
            price = unitPrice;
        }
        if (unitPrice == null && price != null) {
            unitPrice = price;
        }
    }
}
