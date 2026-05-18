package com.inventory.daos;

import com.inventory.models.CartItem;
import com.inventory.repos.CartRepository;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class CartDaoImpl implements CartDao {
    private final CartRepository repository;

    @Override
    @Transactional
    public void lockUserCart(String userEmail) {
        repository.lockUserCart(userEmail);
    }

    @Override
    @Transactional
    public void lockSku(String sku) {
        repository.lockSku(sku);
    }

    @Override
    public List<CartItem> findByUserEmail(String userEmail) {
        return repository.findByUserEmail(userEmail);
    }

    @Override
    public Optional<CartItem> findByUserEmailAndSku(String userEmail, String sku) {
        return repository.findByUserEmailAndSku(userEmail, sku);
    }

    @Override
    public CartItem save(CartItem item) {
        return repository.save(item);
    }

    @Override
    @Transactional
    public void upsert(String userEmail, String sku, Long inventoryId, Integer quantity, LocalDateTime now) {
        Optional<CartItem> existing = repository.findByUserEmailAndSku(userEmail, sku);
        if (existing.isPresent()) {
            CartItem item = existing.get();
            item.setInventoryId(inventoryId);
            item.setQuantity(quantity);
            item.setUpdatedAt(now);
            repository.save(item);
            return;
        }

        CartItem item = CartItem.builder()
            .userEmail(userEmail)
            .sku(sku)
            .inventoryId(inventoryId)
            .quantity(quantity)
            .createdAt(now)
            .updatedAt(now)
            .build();
        repository.save(item);
    }

    @Override
    public Integer sumQuantityBySku(String sku) {
        Long total = repository.sumQuantityBySku(sku);
        return total == null ? 0 : total.intValue();
    }

    @Override
    public Integer sumQuantityBySkuAndUserEmailNot(String sku, String userEmail) {
        Long total = repository.sumQuantityBySkuAndUserEmailNot(sku, userEmail);
        return total == null ? 0 : total.intValue();
    }

    @Override
    public Map<String, Integer> reservedUnitsBySku() {
        List<Object[]> rows = repository.findReservedUnitsBySku();
        Map<String, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            String sku = (String) row[0];
            Number total = (Number) row[1];
            result.put(sku, total == null ? 0 : total.intValue());
        }
        return result;
    }

    @Override
    public long deleteBySku(String sku) {
        return repository.deleteBySku(sku);
    }

    @Override
    public long deleteByUserEmailAndSku(String userEmail, String sku) {
        return repository.deleteByUserEmailAndSku(userEmail, sku);
    }

    @Override
    public long deleteByUserEmailAndSkuNotIn(String userEmail, List<String> skus) {
        return repository.deleteByUserEmailAndSkuNotIn(userEmail, skus);
    }

    @Override
    public long deleteByUserEmail(String userEmail) {
        return repository.deleteByUserEmail(userEmail);
    }
}
