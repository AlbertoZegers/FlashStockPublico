package com.order.daos;

import com.order.models.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShipmentDao extends JpaRepository<Shipment, Long> {
    Optional<Shipment> findByTrackingNumber(String trackingNumber);
    Optional<Shipment> findByOrderNumber(String orderNumber);
    boolean existsByTrackingNumber(String trackingNumber);
}
