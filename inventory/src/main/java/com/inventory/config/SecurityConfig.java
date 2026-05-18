package com.inventory.config;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.SecurityFilterChain;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final CustomOidcUserService customOidcUserService;
    private final OAuth2AuthorizationRequestResolver customAuthorizationRequestResolver;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Existing frontend flow posts to public APIs without CSRF token.
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // 1) Publico (HTML/CSS/JS)
                .requestMatchers(
                    "/",
                    "/index.html",
                    "/shop.html",
                    "/cart.html",
                    "/chackout.html",
                    "/contact.html",
                    "/login",
                    "/login.html",
                    "/logout",
                    "/css/**",
                    "/js/**",
                    "/img/**",
                    "/lib/**",
                    "/favicon.ico"
                ).permitAll()

                // 2) Publico API
                .requestMatchers("/api/auth/providers", "/api/maps/config").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/inventory/**", "/api/coupons/**", "/api/receipts/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/receipts/**").permitAll()

                // 3) Pagos publicos
                .requestMatchers(HttpMethod.GET, "/api/payments/google-pay/config", "/api/payments/deuna/config").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/payments/google-pay/authorize",
                    "/api/payments/deuna/attempts", "/api/payments/deuna/webhook").permitAll()

                // 4) Admin
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/orders/customer-shipping", "/api/orders").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/shipping").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/inventory/**", "/api/coupons/**").permitAll()
                .requestMatchers(HttpMethod.PATCH, "/api/inventory/**", "/api/orders/**", "/api/shipping/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/inventory/**", "/api/orders/**", "/api/shipping/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/inventory/**", "/api/orders/**", "/api/shipping/**").hasRole("ADMIN")

                // 5) Autenticado (cualquier rol)
                .requestMatchers("/api/auth/me", "/api/cart/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/orders/my-history").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/shipping/tracking/**", "/api/shipping/*").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/orders/**", "/api/shipping/**").authenticated()

                // 6) Docs
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/api-docs/**").permitAll()

                .anyRequest().authenticated()
            )

            .oauth2Login(oauth2 -> oauth2
                .loginPage("/login")
                .authorizationEndpoint(authorization ->
                    authorization.authorizationRequestResolver(customAuthorizationRequestResolver))
                .userInfoEndpoint(userInfo -> userInfo
                    .userService(customOAuth2UserService)
                    .oidcUserService(customOidcUserService))
                .successHandler((request, response, authentication) -> {
                    response.sendRedirect("http://localhost:3000/index.html");
                })
                .failureHandler((request, response, exception) -> {
                    String rawMessage = exception != null && exception.getMessage() != null
                        ? exception.getMessage()
                        : "Error OAuth2 desconocido";
                    String safeMessage = rawMessage.length() > 600 ? rawMessage.substring(0, 600) : rawMessage;
                    String encodedMessage = URLEncoder.encode(safeMessage, StandardCharsets.UTF_8);
                    response.sendRedirect("/login?error=oauth2&message=" + encodedMessage);
                })
            
                .defaultSuccessUrl("/index.html", true))
            .logout(logout -> logout
                .logoutRequestMatcher(new AntPathRequestMatcher("/logout", "GET"))
                .clearAuthentication(true)
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .logoutSuccessUrl("/index.html"));

        return http.build();
    }
}
