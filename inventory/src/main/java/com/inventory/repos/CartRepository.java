package com.inventory.repos;

import com.inventory.models.CartItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

@Repository
public interface CartRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByUserEmail(String userEmail);
    Optional<CartItem> findByUserEmailAndSku(String userEmail, String sku);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c.id from CartItem c where c.userEmail = :userEmail")
    List<Long> lockUserCart(@Param("userEmail") String userEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c.id from CartItem c where c.sku = :sku")
    List<Long> lockSku(@Param("sku") String sku);

    @Query("select coalesce(sum(c.quantity), 0) from CartItem c where c.sku = :sku")
    Long sumQuantityBySku(@Param("sku") String sku);

    @Query("select coalesce(sum(c.quantity), 0) from CartItem c where c.sku = :sku and c.userEmail <> :userEmail")
    Long sumQuantityBySkuAndUserEmailNot(@Param("sku") String sku, @Param("userEmail") String userEmail);

    @Query("select c.sku, coalesce(sum(c.quantity), 0) from CartItem c group by c.sku")
    List<Object[]> findReservedUnitsBySku();

    long deleteBySku(String sku);
    long deleteByUserEmailAndSku(String userEmail, String sku);
    long deleteByUserEmailAndSkuNotIn(String userEmail, List<String> skus);
    long deleteByUserEmail(String userEmail);
}
