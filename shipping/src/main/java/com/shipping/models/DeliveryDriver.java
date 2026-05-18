package com.shipping.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "delivery_drivers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryDriver {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String phone;

    @Column
    private String vehicle;

    @Column
    private String plate;

    @Column(nullable = false)
    private String status;

    @Column(precision = 10, scale = 7)
    private BigDecimal currentLat;

    @Column(precision = 10, scale = 7)
    private BigDecimal currentLng;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    private void touchUpdatedAt() {
        this.updatedAt = LocalDateTime.now();
    }
}
