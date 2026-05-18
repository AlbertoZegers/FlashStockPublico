package com.inventory.controllers;

import com.inventory.common.ApiResponse;
import com.inventory.dtos.InventoryRequest;
import com.inventory.dtos.InventoryRealtimeResponse;
import com.inventory.dtos.InventoryResponse;
import com.inventory.services.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.CrossOrigin;


import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@RequiredArgsConstructor
public class InventoryController {
    private final InventoryService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<InventoryResponse>>> getAll() {
        ApiResponse<List<InventoryResponse>> response = new ApiResponse<>();
        response.setMessage("Inventario listado");
        response.setData(service.findAll());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/realtime")
    public ResponseEntity<ApiResponse<List<InventoryRealtimeResponse>>> getRealtime() {
        ApiResponse<List<InventoryRealtimeResponse>> response = new ApiResponse<>();
        response.setMessage("Inventario en tiempo real con pedidos y envios");
        response.setData(service.findRealtimeStatus());
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InventoryResponse>> create(@Valid @RequestBody InventoryRequest request) {
        ApiResponse<InventoryResponse> response = new ApiResponse<>();
        response.setMessage("Inventario creado");
        response.setData(service.create(request));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{sku}")
    public ResponseEntity<ApiResponse<InventoryResponse>> getBySku(@PathVariable String sku) {
        ApiResponse<InventoryResponse> response = new ApiResponse<>();
        response.setMessage("Inventario encontrado");
        response.setData(service.findBySku(sku));
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{sku}/quantity/{quantity}")
    public ResponseEntity<ApiResponse<InventoryResponse>> updateQuantity(@PathVariable String sku, @PathVariable Integer quantity) {
        ApiResponse<InventoryResponse> response = new ApiResponse<>();
        response.setMessage("Stock actualizado");
        response.setData(service.updateQuantity(sku, quantity));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{sku}")
    public ResponseEntity<ApiResponse<InventoryResponse>> updateProduct(@PathVariable String sku, @Valid @RequestBody InventoryRequest request) {
        ApiResponse<InventoryResponse> response = new ApiResponse<>();
        response.setMessage("Producto actualizado");
        response.setData(service.updateProduct(sku, request));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{sku}")
    public ResponseEntity<ApiResponse<String>> deleteBySku(@PathVariable String sku) {
        service.deleteBySku(sku);
        ApiResponse<String> response = new ApiResponse<>();
        response.setMessage("Producto eliminado");
        response.setData(sku);
        return ResponseEntity.ok(response);
    }
}
