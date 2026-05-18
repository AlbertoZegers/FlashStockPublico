package com.order.repos;

public interface OrderCustomerShippingProjection {
    Long getOrderId();
    String getOrderNumber();
    String getOrderStatus();
    String getShipmentTrackingNumber();
    String getShipmentStatus();
    String getCarrier();
    String getCustomerFirstName();
    String getCustomerLastName();
    String getCustomerEmail();
    String getShippingAddress();
}
