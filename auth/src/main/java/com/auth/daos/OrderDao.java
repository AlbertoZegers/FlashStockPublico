package com.auth.daos;

import com.auth.models.CustomerOrder;
import com.auth.repos.OrderCustomerShippingProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderDao extends JpaRepository<CustomerOrder, Long> {
    Optional<CustomerOrder> findByOrderNumber(String orderNumber);
    boolean existsByOrderNumber(String orderNumber);

    @Query(
        "select o.id as orderId, o.orderNumber as orderNumber, o.status as orderStatus, "
            + "s.trackingNumber as shipmentTrackingNumber, s.status as shipmentStatus, s.carrier as carrier, "
            + "o.customerFirstName as customerFirstName, o.customerLastName as customerLastName, "
            + "o.customerEmail as customerEmail, o.shippingAddress as shippingAddress "
            + "from CustomerOrder o left join Shipment s on s.orderNumber = o.orderNumber "
            + "where (:status is null or o.status = :status)"
    )
    List<OrderCustomerShippingProjection> findCustomerOrderShipping(@Param("status") String status);

    @Query(
        "select o.id as orderId, o.orderNumber as orderNumber, o.status as orderStatus, "
            + "s.trackingNumber as shipmentTrackingNumber, s.status as shipmentStatus, s.carrier as carrier, "
            + "o.customerFirstName as customerFirstName, o.customerLastName as customerLastName, "
            + "o.customerEmail as customerEmail, o.shippingAddress as shippingAddress "
            + "from CustomerOrder o left join Shipment s on s.orderNumber = o.orderNumber "
            + "where o.customerEmail = :email and (:status is null or o.status = :status)"
    )
    List<OrderCustomerShippingProjection> findCustomerOrderShippingByEmail(
        @Param("email") String email,
        @Param("status") String status
    );
}
