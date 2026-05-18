package com.inventory.daos;

import com.inventory.models.Inventory;
import com.inventory.repos.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class InventoryDaoImpl implements InventoryDao {
    private final InventoryRepository repository;

    public List<Inventory> findAll() { return repository.findAll(); }
    public Optional<Inventory> findById(Long id) { return repository.findById(id); }
    public Optional<Inventory> findBySku(String sku) { return repository.findBySku(sku); }
    public Optional<Inventory> findByIdForUpdate(Long id) { return repository.findByIdForUpdate(id); }
    public Optional<Inventory> findBySkuForUpdate(String sku) { return repository.findBySkuForUpdate(sku); }
    public Inventory save(Inventory inventory) { return repository.save(inventory); }
    public long deleteBySku(String sku) { return repository.deleteBySku(sku); }
}
