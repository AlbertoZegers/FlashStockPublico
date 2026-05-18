package com.order.controllers;

import com.order.common.ApiResponse;
import com.order.common.AuthEmailResolver;
import com.order.dtos.OrderCustomerShippingResponse;
import com.order.dtos.OrderRequest;
import com.order.dtos.OrderResponse;
import com.order.services.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService service;

    @Value("${app.security.admin-email:}")
    private String adminEmail;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.<List<OrderResponse>>builder().message("Pedidos listados").data(service.findAll()).build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> create(@Valid @RequestBody OrderRequest request, Authentication authentication) {
        String email = AuthEmailResolver.resolve(authentication);
        if ((request.getCustomerEmail() == null || request.getCustomerEmail().isBlank()) && email != null) {
            request.setCustomerEmail(email);
        }

        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder().message("Pedido creado").data(service.create(request)).build());
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<ApiResponse<OrderResponse>> getByOrderNumber(@PathVariable String orderNumber) {
        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder().message("Pedido encontrado").data(service.findByOrderNumber(orderNumber)).build());
    }

    @PatchMapping("/{orderNumber}/status/{status}")
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(@PathVariable String orderNumber, @PathVariable String status) {
        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder().message("Estado actualizado").data(service.updateStatus(orderNumber, status)).build());
    }

    @GetMapping("/customer-shipping")
    public ResponseEntity<ApiResponse<List<OrderCustomerShippingResponse>>> getCustomerShipping(
            Authentication authentication,
            @RequestParam(required = false) String status
    ) {
        if (!isAdmin(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo administrador");
        }

        return ResponseEntity.ok(ApiResponse.<List<OrderCustomerShippingResponse>>builder()
                .message("Pedido + envio + cliente")
                .data(service.findCustomerOrderShipping(status))
                .build());
    }

    @GetMapping("/my-history")
    public ResponseEntity<ApiResponse<List<OrderCustomerShippingResponse>>> getMyHistory(
            Authentication authentication,
            @RequestParam(required = false) String status
    ) {
        String email = AuthEmailResolver.resolve(authentication);
        if (email == null) {
            throw new IllegalArgumentException("Debes iniciar sesion para ver tu historial");
        }

        return ResponseEntity.ok(ApiResponse.<List<OrderCustomerShippingResponse>>builder()
                .message("Mis pedidos")
                .data(service.findMyOrderHistory(email, status))
                .build());
    }

    @PostMapping("/{orderNumber}/confirm-received")
    public ResponseEntity<ApiResponse<OrderResponse>> confirmReceived(
            Authentication authentication,
            @PathVariable String orderNumber
    ) {
        String email = AuthEmailResolver.resolve(authentication);
        if (email == null) {
            throw new IllegalArgumentException("Debes iniciar sesion para confirmar la recepcion");
        }

        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .message("Pedido confirmado como recibido")
                .data(service.confirmReceived(orderNumber, email))
                .build());
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        boolean byRole = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
        if (byRole) {
            return true;
        }

        String email = AuthEmailResolver.resolve(authentication);
        return adminEmail != null
                && !adminEmail.isBlank()
                && email != null
                && email.equalsIgnoreCase(adminEmail);
    }
}
