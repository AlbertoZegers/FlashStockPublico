package com.auth.config;

import com.auth.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/maps")
@RequiredArgsConstructor
public class MapsConfigController {

    @Value("${app.maps.google.api-key:}")
    private String googleApiKey;

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<Map<String, String>>> getPublicMapConfig() {
        Map<String, String> data = new HashMap<>();
        data.put("provider", "google");
        data.put("googleApiKey", googleApiKey == null ? "" : googleApiKey.trim());
        return ResponseEntity.ok(ApiResponse.<Map<String, String>>builder()
                .message("Configuracion de mapas")
                .data(data)
                .build());
    }
}
