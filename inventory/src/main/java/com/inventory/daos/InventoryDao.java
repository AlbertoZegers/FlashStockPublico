package com.inventory.daos;

import com.inventory.models.Inventory;

import java.util.List;
import java.util.Optional;

public interface InventoryDao {
    List<Inventory> findAll();
    Optional<Inventory> findById(Long id);
    Optional<Inventory> findBySku(String sku);
    Optional<Inventory> findByIdForUpdate(Long id);
    Optional<Inventory> findBySkuForUpdate(String sku);
    Inventory save(Inventory inventory);
    long deleteBySku(String sku);
}
