package com.shipping.dtos;

import lombok.Data;

@Data
public class ShipmentLiveUpdateRequest {
    private String status;
    private String courierName;
    private Double courierLat;
    private Double courierLng;
}
