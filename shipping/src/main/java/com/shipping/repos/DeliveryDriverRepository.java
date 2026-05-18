package com.shipping.repos;

import com.shipping.models.DeliveryDriver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeliveryDriverRepository extends JpaRepository<DeliveryDriver, Long> {
    Optional<DeliveryDriver> findByEmail(String email);
}
