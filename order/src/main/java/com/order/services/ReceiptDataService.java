package com.order.services;

import com.order.daos.InventoryDao;
import com.order.daos.OrderDao;
import com.order.daos.ShipmentDao;
import com.order.dtos.ReceiptEmailRequest;
import com.order.dtos.ReceiptLineItem;
import com.order.dtos.ReceiptShipmentInfo;
import com.order.models.Inventory;
import com.order.models.CustomerOrder;
import com.order.models.Shipment;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReceiptDataService {

    private final OrderDao orderDao;
    private final InventoryDao inventoryDao;
    private final ShipmentDao shipmentDao;

    public ReceiptEmailRequest buildFromOrderNumbers(List<String> orderNumbers, String authenticatedEmail) {
        if (orderNumbers == null || orderNumbers.isEmpty()) {
            throw new IllegalArgumentException("Debes indicar al menos un numero de pedido para generar boleta.");
        }

        List<CustomerOrder> orders = new ArrayList<>();
        for (String orderNumber : orderNumbers) {
            if (orderNumber == null || orderNumber.isBlank()) {
                continue;
            }
            CustomerOrder order = orderDao.findByOrderNumber(orderNumber.trim())
                    .orElseThrow(() -> new IllegalArgumentException("No existe pedido: " + orderNumber));
            if (authenticatedEmail != null && !authenticatedEmail.isBlank() && order.getCustomerEmail() != null && !order.getCustomerEmail().equalsIgnoreCase(authenticatedEmail)) {
                throw new IllegalArgumentException("No autorizado para consultar boleta del pedido: " + orderNumber);
            }
            orders.add(order);
        }

        if (orders.isEmpty()) {
            throw new IllegalArgumentException("No se encontraron pedidos para construir la boleta.");
        }

        CustomerOrder first = orders.get(0);
        BigDecimal subtotal = BigDecimal.ZERO;
        List<ReceiptLineItem> items = new ArrayList<>();
        List<ReceiptShipmentInfo> shipments = new ArrayList<>();
        LocalDateTime latest = first.getCreatedAt();

        for (CustomerOrder order : orders) {
            if (order.getCreatedAt() != null && (latest == null || order.getCreatedAt().isAfter(latest))) {
                latest = order.getCreatedAt();
            }

            Inventory inventory = resolveInventory(order);
            BigDecimal unitPrice = inventory != null && inventory.getUnitPrice() != null ? inventory.getUnitPrice() : BigDecimal.ZERO;
            int qty = order.getQuantity() == null ? 0 : order.getQuantity();
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(qty));
            subtotal = subtotal.add(lineTotal);

            ReceiptLineItem item = new ReceiptLineItem();
            item.setInventoryId(order.getInventoryId());
            item.setSku(order.getSku());
            item.setProductName(inventory != null && inventory.getName() != null ? inventory.getName() : order.getSku());
            item.setQuantity(qty);
            item.setUnitPrice(unitPrice);
            item.setLineTotal(lineTotal);
            item.setOrderNumber(order.getOrderNumber());
            items.add(item);

            Shipment shipment = shipmentDao.findByOrderNumber(order.getOrderNumber()).orElse(null);
            ReceiptShipmentInfo shipmentInfo = new ReceiptShipmentInfo();
            shipmentInfo.setOrderNumber(order.getOrderNumber());
            shipmentInfo.setTrackingNumber(shipment != null ? shipment.getTrackingNumber() : "N/A");
            shipmentInfo.setCarrier(shipment != null ? shipment.getCarrier() : "N/A");
            shipmentInfo.setCourierName(shipment != null && shipment.getCourierName() != null ? shipment.getCourierName() : "Repartidor " + (shipment != null ? shipment.getCarrier() : "FlashStock"));
            shipmentInfo.setStatus(shipment != null ? shipment.getStatus() : "pendiente");
            shipmentInfo.setEta(shipment != null ? shipment.getEta() : "N/A");
            shipments.add(shipmentInfo);
        }

        BigDecimal shipping = items.isEmpty() ? BigDecimal.ZERO : BigDecimal.valueOf(3);
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal total = subtotal.add(shipping).subtract(discount);

        ReceiptEmailRequest receipt = new ReceiptEmailRequest();
        receipt.setReceiptNumber("BOL-" + first.getOrderNumber());
        receipt.setCreatedAt((latest == null ? LocalDateTime.now() : latest).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        receipt.setCustomerFirstName(first.getCustomerFirstName());
        receipt.setCustomerLastName(first.getCustomerLastName());
        receipt.setCustomerEmail(first.getCustomerEmail());
        receipt.setShippingAddress(first.getShippingAddress());
        receipt.setSubtotal(subtotal);
        receipt.setShipping(shipping);
        receipt.setDiscount(discount);
        receipt.setTotal(total);
        receipt.setItems(items);
        receipt.setShipments(shipments);
        return receipt;
    }

    private Inventory resolveInventory(CustomerOrder order) {
        if (order.getInventoryId() != null) {
            Inventory byId = inventoryDao.findById(order.getInventoryId()).orElse(null);
            if (byId != null) {
                return byId;
            }
        }
        if (order.getSku() == null || order.getSku().isBlank()) {
            return null;
        }
        return inventoryDao.findBySku(order.getSku()).orElse(null);
    }
}
