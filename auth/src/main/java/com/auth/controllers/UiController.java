package com.auth.controllers;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class UiController {

    @GetMapping("/")
    public String root() {
        return "forward:/index.html";
    }

    @GetMapping("/login")
    public String login(Authentication authentication) {
        boolean authenticated = authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
        if (authenticated) {
            return "redirect:/index.html";
        }
        return "forward:/login.html";
    }

    @GetMapping("/admin/inventory")
    public String adminInventory() {
        return "forward:/admin/inventory.html";
    }

    @GetMapping("/admin/dashboard")
    public String adminDashboard() {
        return "forward:/admin/dashboard.html";
    }

    @GetMapping("/admin/shipments")
    public String adminShipments() {
        return "forward:/admin/shipments.html";
    }

    @GetMapping("/order-status")
    public String orderStatus() {
        return "forward:/order-status.html";
    }
}
