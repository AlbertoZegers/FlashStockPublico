package com.auth.daos;

import com.auth.models.CartItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public interface CartDao extends JpaRepository<CartItem, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CartItem c where c.userEmail = :userEmail")
    List<CartItem> findForUpdateByUserEmail(@Param("userEmail") String userEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CartItem c where c.sku = :sku")
    List<CartItem> findForUpdateBySku(@Param("sku") String sku);

    default void lockUserCart(String userEmail) {
        findForUpdateByUserEmail(userEmail);
    }

    default void lockSku(String sku) {
        findForUpdateBySku(sku);
    }

    List<CartItem> findByUserEmail(String userEmail);
    Optional<CartItem> findByUserEmailAndSku(String userEmail, String sku);

    @Transactional
    @Modifying
    @Query(
            value = "merge into cart_items (user_email, sku, inventory_id, quantity, created_at, updated_at) "
                    + "key (user_email, sku) values (:userEmail, :sku, :inventoryId, :quantity, :now, :now)",
            nativeQuery = true
    )
    void upsert(
            @Param("userEmail") String userEmail,
            @Param("sku") String sku,
            @Param("inventoryId") Long inventoryId,
            @Param("quantity") Integer quantity,
            @Param("now") LocalDateTime now
    );

    @Query("select coalesce(sum(c.quantity), 0) from CartItem c where c.sku = :sku")
    Integer sumQuantityBySku(@Param("sku") String sku);

    @Query("select coalesce(sum(c.quantity), 0) from CartItem c where c.sku = :sku and c.userEmail <> :userEmail")
    Integer sumQuantityBySkuAndUserEmailNot(
            @Param("sku") String sku,
            @Param("userEmail") String userEmail
    );

    interface ReservedSkuQuantity {
        String getSku();
        Integer getQuantity();
    }

    @Query("select c.sku as sku, coalesce(sum(c.quantity), 0) as quantity from CartItem c group by c.sku")
    List<ReservedSkuQuantity> reservedUnitsBySkuRaw();

    default Map<String, Integer> reservedUnitsBySku() {
        return reservedUnitsBySkuRaw().stream()
                .collect(Collectors.toMap(ReservedSkuQuantity::getSku, ReservedSkuQuantity::getQuantity));
    }

    long deleteBySku(String sku);
    long deleteByUserEmailAndSku(String userEmail, String sku);
    long deleteByUserEmailAndSkuNotIn(String userEmail, List<String> skus);
    long deleteByUserEmail(String userEmail);
}