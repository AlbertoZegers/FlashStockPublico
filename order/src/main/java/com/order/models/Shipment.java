package com.order.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "shipments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shipment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String trackingNumber;

    @Column(nullable = false)
    private String orderNumber;

    @Column(nullable = false)
    private String carrier;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String eta;

    @Column
    private String courierName;

    @Column
    private Double originLat;

    @Column
    private Double originLng;

    @Column
    private Double destinationLat;

    @Column
    private Double destinationLng;

    @Column
    private Double courierLat;

    @Column
    private Double courierLng;

    @Column(columnDefinition = "TEXT")
    private String routeGeoJson;

    @Column(columnDefinition = "TEXT")
    private String routeStepsJson;

    @Column
    private Integer totalDurationSec;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime lastUpdate;

    @PrePersist
    @PreUpdate
    private void touchLastUpdate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        this.lastUpdate = LocalDateTime.now();
    }
}
