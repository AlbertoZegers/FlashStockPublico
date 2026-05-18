package com.shipping.controllers;

import com.shipping.common.ApiResponse;
import com.shipping.dtos.ShipmentLiveUpdateRequest;
import com.shipping.dtos.ShipmentRequest;
import com.shipping.dtos.ShipmentResponse;
import com.shipping.dtos.ShipmentTrackingResponse;
import com.shipping.services.ShippingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.List;

@RestController
@RequestMapping("/api/shipping")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@RequiredArgsConstructor
public class ShippingController {
    private final ShippingService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ShipmentResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.<List<ShipmentResponse>>builder().message("Envios listados").data(service.findAll()).build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ShipmentResponse>> create(@Valid @RequestBody ShipmentRequest request) {
        return ResponseEntity.ok(ApiResponse.<ShipmentResponse>builder().message("Envio creado").data(service.create(request)).build());
    }

    @GetMapping("/{trackingNumber}")
    public ResponseEntity<ApiResponse<ShipmentResponse>> getByTracking(@PathVariable String trackingNumber) {
        return ResponseEntity.ok(ApiResponse.<ShipmentResponse>builder().message("Envio encontrado").data(service.findByTrackingNumber(trackingNumber)).build());
    }

    @GetMapping("/tracking/{trackingNumber}")
    public ResponseEntity<ApiResponse<ShipmentTrackingResponse>> getTracking(@PathVariable String trackingNumber) {
        return ResponseEntity.ok(ApiResponse.<ShipmentTrackingResponse>builder()
                .message("Tracking de envio en curso")
                .data(service.getTrackingSnapshot(trackingNumber))
                .build());
    }

        @PatchMapping("/tracking/{trackingNumber}/live")
        public ResponseEntity<ApiResponse<ShipmentTrackingResponse>> updateTrackingLive(
            @PathVariable String trackingNumber,
            @RequestBody ShipmentLiveUpdateRequest request
        ) {
        return ResponseEntity.ok(ApiResponse.<ShipmentTrackingResponse>builder()
            .message("Tracking actualizado en vivo")
            .data(service.updateTrackingLive(trackingNumber, request))
            .build());
        }

    @PatchMapping("/{trackingNumber}/status/{status}")
    public ResponseEntity<ApiResponse<ShipmentResponse>> updateStatus(@PathVariable String trackingNumber, @PathVariable String status) {
        return ResponseEntity.ok(ApiResponse.<ShipmentResponse>builder().message("Estado de envio actualizado").data(service.updateStatus(trackingNumber, status)).build());
    }
}
