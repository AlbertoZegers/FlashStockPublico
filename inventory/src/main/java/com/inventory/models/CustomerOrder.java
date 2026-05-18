package com.inventory.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNumber;

    @Column(nullable = false)
    private String sku;

    @Column(name = "inventory_id")
    private Long inventoryId;

    @Column(nullable = false)
    private Integer quantity;

    @Column
    private String customerFirstName;

    @Column
    private String customerLastName;

    @Column
    private String customerEmail;

    @Column
    private String shippingAddress;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
