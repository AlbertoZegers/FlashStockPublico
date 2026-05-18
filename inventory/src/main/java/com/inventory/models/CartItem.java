package com.inventory.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "cart_items", uniqueConstraints = {
        @UniqueConstraint(name = "uk_cart_user_sku", columnNames = {"user_email", "sku"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false, length = 250)
    private String userEmail;

    @Column(nullable = false, length = 100)
    private String sku;

    @Column(name = "inventory_id")
    private Long inventoryId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;
}