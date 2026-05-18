package com.shipping.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Service
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();

    @Value("${app.security.admin-email}")
    private String adminEmail;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = delegate.loadUser(userRequest);
        Map<String, Object> attributes = oauth2User.getAttributes();

        String email = getEmail(attributes);
        Set<GrantedAuthority> authorities = new HashSet<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));

        if (email != null && email.equalsIgnoreCase(adminEmail)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        }

        String userNameAttributeName = userRequest.getClientRegistration()
                .getProviderDetails()
                .getUserInfoEndpoint()
                .getUserNameAttributeName();

        if (userNameAttributeName == null || userNameAttributeName.isBlank()) {
            userNameAttributeName = "sub";
        }

        return new DefaultOAuth2User(authorities, attributes, userNameAttributeName);
    }

    private String getEmail(Map<String, Object> attributes) {
        Object email = attributes.get("email");
        if (email instanceof String emailStr && !emailStr.isBlank()) {
            return emailStr;
        }

        Object mail = attributes.get("mail");
        if (mail instanceof String mailStr && !mailStr.isBlank()) {
            return mailStr;
        }

        Object userPrincipalName = attributes.get("userPrincipalName");
        if (userPrincipalName instanceof String userPrincipalNameStr && !userPrincipalNameStr.isBlank()) {
            return userPrincipalNameStr;
        }

        Object preferredUsername = attributes.get("preferred_username");
        if (preferredUsername instanceof String preferredUsernameStr && !preferredUsernameStr.isBlank()) {
            return preferredUsernameStr;
        }

        return null;
    }
}
