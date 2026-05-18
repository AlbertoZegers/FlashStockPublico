package com.order.controllers;

import com.order.common.ApiResponse;
import com.order.common.AuthEmailResolver;
import com.order.dtos.ReceiptEmailRequest;
import com.order.services.ReceiptDataService;
import com.order.services.ReceiptEmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/receipts")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@RequiredArgsConstructor
public class ReceiptController {

    private final ReceiptEmailService receiptEmailService;
    private final ReceiptDataService receiptDataService;

    @GetMapping("/from-orders")
    public ResponseEntity<ApiResponse<ReceiptEmailRequest>> getReceiptFromOrders(
            @RequestParam String orderNumbers,
            Authentication authentication
    ) {
        String email = AuthEmailResolver.resolve(authentication);
        if (email == null) {
            throw new IllegalArgumentException("Debes iniciar sesion para consultar boleta");
        }

        List<String> numbers = Arrays.stream(orderNumbers.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();

        ReceiptEmailRequest receipt = receiptDataService.buildFromOrderNumbers(numbers, email);
        return ResponseEntity.ok(ApiResponse.<ReceiptEmailRequest>builder()
                .message("Boleta generada")
                .data(receipt)
                .build());
    }

    @PostMapping("/send-email")
    public ResponseEntity<ApiResponse<String>> sendReceiptByEmail(@Valid @RequestBody ReceiptEmailRequest request) {
        receiptEmailService.sendReceiptEmail(request);
        return ResponseEntity.ok(ApiResponse.<String>builder()
                .message("Boleta enviada por correo")
                .data(request.getReceiptNumber())
                .build());
    }
}
