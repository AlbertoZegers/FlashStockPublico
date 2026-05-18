package com.inventory.repos;

import com.inventory.models.Shipment;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, Long> {
    Optional<Shipment> findByTrackingNumber(String trackingNumber);
    Optional<Shipment> findByOrderNumber(String orderNumber);
    boolean existsByTrackingNumber(String trackingNumber);
}
