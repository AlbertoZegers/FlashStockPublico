import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // ========== REGLAS MÁS ESPECÍFICAS PRIMERO ==========
      
      // PUERTO 8082: INVENTORY (ESPECÍFICO)
      { source: "/api/inventory/:path*", destination: "http://localhost:8082/api/inventory/:path*" },
      
      // PUERTO 8083: ORDERS + RECEIPTS (ESPECÍFICO)
      { source: "/api/orders/:path*", destination: "http://localhost:8083/api/orders/:path*" },
      { source: "/api/receipts/:path*", destination: "http://localhost:8083/api/receipts/:path*" },
      
      // PUERTO 8084: SHIPPING + MAPS + CART + PAYMENTS + COUPONS (ESPECÍFICO)
      { source: "/api/shipping/:path*", destination: "http://localhost:8084/api/shipping/:path*" },
      { source: "/api/maps/:path*", destination: "http://localhost:8084/api/maps/:path*" },
      { source: "/api/cart/:path*", destination: "http://localhost:8084/api/cart/:path*" },
      { source: "/api/payments/:path*", destination: "http://localhost:8084/api/payments/:path*" },
      { source: "/api/coupons/:path*", destination: "http://localhost:8084/api/coupons/:path*" },
      
      // PUERTO 8081: AUTH (GENERAL - VA ÚLTIMAS)
      { source: "/api/auth/:path*", destination: "http://localhost:8081/api/auth/:path*" },
      { source: "/api/admin/:path*", destination: "http://localhost:8081/api/admin/:path*" },
      { source: "/oauth2/:path*", destination: "http://localhost:8081/oauth2/:path*" },
      { source: "/login/oauth2/:path*", destination: "http://localhost:8081/login/oauth2/:path*" },
      { source: "/logout", destination: "http://localhost:8081/logout" },
          
    ];
  }
};

export default nextConfig;
