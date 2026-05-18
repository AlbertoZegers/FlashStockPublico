package com.inventory.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class OAuth2AuthorizationRequestResolverConfig {

    @Bean
    public OAuth2AuthorizationRequestResolver customAuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        DefaultOAuth2AuthorizationRequestResolver delegate =
                new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");

        return new OAuth2AuthorizationRequestResolver() {
            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                return customize(request, delegate.resolve(request));
            }

            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
                return customize(request, delegate.resolve(request, clientRegistrationId));
            }
        };
    }

    private OAuth2AuthorizationRequest customize(HttpServletRequest request, OAuth2AuthorizationRequest authorizationRequest) {
        if (authorizationRequest == null) {
            return null;
        }

        String requestUri = request.getRequestURI();
        String registrationId = requestUri.substring(requestUri.lastIndexOf('/') + 1).toLowerCase();

        Map<String, Object> additionalParameters = new HashMap<>(authorizationRequest.getAdditionalParameters());

        if ("google".equals(registrationId) || "microsoft".equals(registrationId)) {
            additionalParameters.put("prompt", "select_account");
        }

        OAuth2AuthorizationRequest.Builder builder = OAuth2AuthorizationRequest.from(authorizationRequest)
                .additionalParameters(additionalParameters);

        // Microsoft can require PKCE for some app registration/platform settings.
        if ("microsoft".equals(registrationId)) {
            OAuth2AuthorizationRequestCustomizers.withPkce().accept(builder);
        }

        return builder.build();
    }
}
