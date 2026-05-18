package com.inventory.daos;

import com.inventory.models.CustomerOrder;
import com.inventory.repos.OrderCustomerShippingProjection;

import java.util.List;
import java.util.Optional;

public interface OrderDao {
    List<CustomerOrder> findAll();
    Optional<CustomerOrder> findByOrderNumber(String orderNumber);
    boolean existsByOrderNumber(String orderNumber);
    CustomerOrder save(CustomerOrder order);
    List<OrderCustomerShippingProjection> findCustomerOrderShipping(String status);
    List<OrderCustomerShippingProjection> findCustomerOrderShippingByEmail(String email, String status);
}
