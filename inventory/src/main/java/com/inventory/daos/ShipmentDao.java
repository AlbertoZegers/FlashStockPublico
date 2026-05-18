package com.inventory.daos;

import com.inventory.models.Shipment;

import java.util.List;
import java.util.Optional;

public interface ShipmentDao {
    List<Shipment> findAll();
    Optional<Shipment> findByTrackingNumber(String trackingNumber);
    Optional<Shipment> findByOrderNumber(String orderNumber);
    boolean existsByTrackingNumber(String trackingNumber);
    Shipment save(Shipment shipment);
}
