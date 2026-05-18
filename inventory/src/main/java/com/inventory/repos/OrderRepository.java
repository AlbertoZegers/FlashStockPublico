package com.inventory.repos;

import com.inventory.models.CustomerOrder;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderRepository extends JpaRepository<CustomerOrder, Long> {
    Optional<CustomerOrder> findByOrderNumber(String orderNumber);
    boolean existsByOrderNumber(String orderNumber);

    @Query(value = """
        select
            o.id as orderId,
            o.order_number as orderNumber,
            o.status as orderStatus,
            s.tracking_number as shipmentTrackingNumber,
            s.status as shipmentStatus,
            s.carrier as carrier,
            o.customer_first_name as customerFirstName,
            o.customer_last_name as customerLastName,
            o.customer_email as customerEmail,
            o.shipping_address as shippingAddress
        from orders o
        left join shipments s on s.order_number = o.order_number
        where (:status is null or o.status = :status)
        """, nativeQuery = true)
    List<OrderCustomerShippingProjection> findCustomerOrderShipping(@Param("status") String status);

    @Query(value = """
        select
            o.id as orderId,
            o.order_number as orderNumber,
            o.status as orderStatus,
            s.tracking_number as shipmentTrackingNumber,
            s.status as shipmentStatus,
            s.carrier as carrier,
            o.customer_first_name as customerFirstName,
            o.customer_last_name as customerLastName,
            o.customer_email as customerEmail,
            o.shipping_address as shippingAddress
        from orders o
        left join shipments s on s.order_number = o.order_number
        where (:email is null or o.customer_email = :email)
          and (:status is null or o.status = :status)
        """, nativeQuery = true)
    List<OrderCustomerShippingProjection> findCustomerOrderShippingByEmail(
        @Param("email") String email,
        @Param("status") String status
    );
}
