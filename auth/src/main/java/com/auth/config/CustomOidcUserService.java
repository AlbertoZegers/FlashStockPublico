package com.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
public class CustomOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final OidcUserService delegate = new OidcUserService();

    @Value("${app.security.admin-email}")
    private String adminEmail;

    @Value("${app.security.admin-email-2}")
    private String adminEmail2;
    
    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) {
        OidcUser oidcUser = delegate.loadUser(userRequest);

        Set<GrantedAuthority> authorities = new HashSet<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));

        String email = getEmail(oidcUser);
        if (email != null && (email.equalsIgnoreCase(adminEmail) || email.equalsIgnoreCase(adminEmail2))) {
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        }

        String userNameAttributeName = userRequest.getClientRegistration()
                .getProviderDetails()
                .getUserInfoEndpoint()
                .getUserNameAttributeName();

        if (userNameAttributeName == null || userNameAttributeName.isBlank()) {
            userNameAttributeName = "sub";
        }

        return new DefaultOidcUser(authorities, oidcUser.getIdToken(), oidcUser.getUserInfo(), userNameAttributeName);
    }

    private String getEmail(OidcUser user) {
        String email = user.getEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }

        Object preferredUsername = user.getClaims().get("preferred_username");
        if (preferredUsername instanceof String preferredUsernameStr && !preferredUsernameStr.isBlank()) {
            return preferredUsernameStr;
        }

        Object upn = user.getClaims().get("upn");
        if (upn instanceof String upnStr && !upnStr.isBlank()) {
            return upnStr;
        }

        return null;
    }
}