package com.inventory.daos;

import com.inventory.models.CustomerOrder;
import com.inventory.repos.OrderCustomerShippingProjection;
import com.inventory.repos.OrderRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class OrderDaoImpl implements OrderDao {
    private final OrderRepository repository;

    @Override
    public List<CustomerOrder> findAll() {
        return repository.findAll();
    }

    @Override
    public Optional<CustomerOrder> findByOrderNumber(String orderNumber) {
        return repository.findByOrderNumber(orderNumber);
    }

    @Override
    public boolean existsByOrderNumber(String orderNumber) {
        return repository.existsByOrderNumber(orderNumber);
    }

    @Override
    public CustomerOrder save(CustomerOrder order) {
        return repository.save(order);
    }

    @Override
    public List<OrderCustomerShippingProjection> findCustomerOrderShipping(String status) {
        return repository.findCustomerOrderShipping(status);
    }

    @Override
    public List<OrderCustomerShippingProjection> findCustomerOrderShippingByEmail(String email, String status) {
        return repository.findCustomerOrderShippingByEmail(email, status);
    }
}
