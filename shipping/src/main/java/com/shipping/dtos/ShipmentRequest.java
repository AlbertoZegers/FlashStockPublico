package com.shipping.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ShipmentRequest {
    @NotBlank
    private String orderNumber;
    @NotBlank
    private String carrier;
}
