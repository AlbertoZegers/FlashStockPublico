package com.auth.controllers;

import com.auth.common.ApiResponse;
import com.auth.dtos.AdminMetricsResponse;
import com.auth.services.admin.AdminMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@RequiredArgsConstructor
public class AdminMetricsController {

    private final AdminMetricsService metricsService;

    @Value("${app.security.admin-email:}")
    private String adminEmail;

    @GetMapping("/metrics")
    public ApiResponse<AdminMetricsResponse> metrics(Authentication authentication) {
        if (!isAdmin(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo administrador");
        }

        return ApiResponse.<AdminMetricsResponse>builder()
                .message("Metricas administrativas en tiempo real")
                .data(metricsService.getAdminMetrics())
                .build();
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        boolean byRole = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        if (byRole) {
            return true;
        }

        String email = authentication.getName();
        Object principal = authentication.getPrincipal();
        if (principal instanceof OAuth2User oauth2User) {
            email = getBestEmail(oauth2User, email);
        }

        return adminEmail != null
                && !adminEmail.isBlank()
                && email != null
                && email.equalsIgnoreCase(adminEmail);
    }

    private String getBestEmail(OAuth2User oauth2User, String fallback) {
        Object attrEmail = oauth2User.getAttributes().get("email");
        if (attrEmail instanceof String value && !value.isBlank()) {
            return value;
        }

        Object attrMail = oauth2User.getAttributes().get("mail");
        if (attrMail instanceof String value && !value.isBlank()) {
            return value;
        }

        Object attrUpn = oauth2User.getAttributes().get("userPrincipalName");
        if (attrUpn instanceof String value && !value.isBlank()) {
            return value;
        }

        Object preferredUsername = oauth2User.getAttributes().get("preferred_username");
        if (preferredUsername instanceof String value && !value.isBlank()) {
            return value;
        }

        return fallback;
    }
}
