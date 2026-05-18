package com.auth.daos;

import com.auth.models.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShipmentDao extends JpaRepository<Shipment, Long> {
    Optional<Shipment> findByTrackingNumber(String trackingNumber);
    Optional<Shipment> findByOrderNumber(String orderNumber);
    boolean existsByTrackingNumber(String trackingNumber);
}
