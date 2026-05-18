package com.auth.controllers;

import com.auth.common.ApiResponse;
import com.auth.dtos.SessionUserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AuthController {

    @Value("${app.security.admin-email:}")
    private String adminEmail;

    @Value("${spring.security.oauth2.client.registration.google.client-id:}")
    private String googleClientId;

    @Value("${spring.security.oauth2.client.registration.microsoft.client-id:}")
    private String microsoftClientId;

    @GetMapping("/me")
    public ApiResponse<SessionUserResponse> me(Authentication authentication) {
        boolean isAuthenticated = authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);

        if (!isAuthenticated) {
            return ApiResponse.<SessionUserResponse>builder()
                    .message("Sesion anonima")
                    .data(SessionUserResponse.builder()
                            .authenticated(false)
                            .admin(false)
                            .email(null)
                            .displayName("Invitado")
                            .authorities(Collections.emptyList())
                            .build())
                    .build();
        }

        List<String> authorities = authentication.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        boolean isAdminByRole = authorities.contains("ROLE_ADMIN");
        String email = authentication.getName();
        String displayName = authentication.getName();

        Object principal = authentication.getPrincipal();
        if (principal instanceof OAuth2User oauth2User) {
            Object attrEmail = oauth2User.getAttributes().get("email");
            Object attrMail = oauth2User.getAttributes().get("mail");
            Object attrUserPrincipalName = oauth2User.getAttributes().get("userPrincipalName");
            Object attrPreferredUsername = oauth2User.getAttributes().get("preferred_username");
            Object attrName = oauth2User.getAttributes().get("name");
            if (attrEmail instanceof String attrEmailStr && !attrEmailStr.isBlank()) {
                email = attrEmailStr;
            } else if (attrMail instanceof String attrMailStr && !attrMailStr.isBlank()) {
                email = attrMailStr;
            } else if (attrUserPrincipalName instanceof String attrUpnStr && !attrUpnStr.isBlank()) {
                email = attrUpnStr;
            } else if (attrPreferredUsername instanceof String attrPreferredUsernameStr && !attrPreferredUsernameStr.isBlank()) {
                email = attrPreferredUsernameStr;
            }
            if (attrName instanceof String attrNameStr && !attrNameStr.isBlank()) {
                displayName = attrNameStr;
            }
        }

        boolean isAdminByEmail = adminEmail != null
            && !adminEmail.isBlank()
            && email != null
            && email.equalsIgnoreCase(adminEmail);

        boolean isAdmin = isAdminByRole || isAdminByEmail;

        return ApiResponse.<SessionUserResponse>builder()
                .message("Sesion activa")
                .data(SessionUserResponse.builder()
                        .authenticated(true)
                        .admin(isAdmin)
                        .email(email)
                        .displayName(displayName)
                        .authorities(authorities)
                        .build())
                .build();
    }

    @GetMapping("/providers")
    public ApiResponse<Map<String, Boolean>> providers() {
        boolean googleConfigured = isProviderConfigured(googleClientId, "replace-with-your-google-client-id", "disabled-google-client-id");
        boolean microsoftConfigured = isProviderConfigured(microsoftClientId, "replace-with-your-microsoft-client-id", "disabled-microsoft-client-id");

        return ApiResponse.<Map<String, Boolean>>builder()
                .message("Estado de proveedores de autenticacion")
                .data(Map.of(
                        "google", googleConfigured,
                        "microsoft", microsoftConfigured
                ))
                .build();
    }

    private boolean isProviderConfigured(String clientId, String placeholder, String disabledValue) {
        if (clientId == null || clientId.isBlank()) {
            return false;
        }

        String normalized = clientId.trim();
        return !normalized.equalsIgnoreCase(placeholder)
                && !normalized.equalsIgnoreCase(disabledValue);
    }
}
