package com.inventory.daos;

import com.inventory.models.CartItem;


import java.util.List;
import java.util.Optional;

public interface CartDao {
    void lockUserCart(String userEmail);
    void lockSku(String sku);
    List<CartItem> findByUserEmail(String userEmail);
    Optional<CartItem> findByUserEmailAndSku(String userEmail, String sku);
    CartItem save(CartItem item);
    void upsert(String userEmail, String sku, Long inventoryId, Integer quantity, java.time.LocalDateTime now);
    Integer sumQuantityBySku(String sku);
    Integer sumQuantityBySkuAndUserEmailNot(String sku, String userEmail);
    java.util.Map<String, Integer> reservedUnitsBySku();
    long deleteBySku(String sku);
    long deleteByUserEmailAndSku(String userEmail, String sku);
    long deleteByUserEmailAndSkuNotIn(String userEmail, List<String> skus);
    long deleteByUserEmail(String userEmail);
}