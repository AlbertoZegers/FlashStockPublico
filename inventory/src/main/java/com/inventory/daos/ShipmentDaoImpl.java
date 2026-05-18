package com.inventory.daos;

import com.inventory.models.Shipment;
import com.inventory.repos.ShipmentRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class ShipmentDaoImpl implements ShipmentDao {
    private final ShipmentRepository repository;

    @Override
    public List<Shipment> findAll() {
        return repository.findAll();
    }

    @Override
    public Optional<Shipment> findByTrackingNumber(String trackingNumber) {
        return repository.findByTrackingNumber(trackingNumber);
    }

    @Override
    public Optional<Shipment> findByOrderNumber(String orderNumber) {
        return repository.findByOrderNumber(orderNumber);
    }

    @Override
    public boolean existsByTrackingNumber(String trackingNumber) {
        return repository.existsByTrackingNumber(trackingNumber);
    }

    @Override
    public Shipment save(Shipment shipment) {
        return repository.save(shipment);
    }
}
