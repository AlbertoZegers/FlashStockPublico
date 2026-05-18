package com.auth.dtos;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SessionUserResponse {
    private boolean authenticated;
    private boolean admin;
    private String email;
    private String displayName;
    private List<String> authorities;
}
