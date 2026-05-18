package com.order.services;

import com.order.dtos.ReceiptEmailRequest;
import com.order.dtos.ReceiptLineItem;
import com.order.dtos.ReceiptShipmentInfo;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReceiptEmailService {

    private final JavaMailSender mailSender;
    private final ObjectMapper objectMapper;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.port:0}")
    private int mailPort;

    public void sendReceiptEmail(ReceiptEmailRequest request) {
        if (request.getCustomerEmail() == null || request.getCustomerEmail().isBlank()) {
            throw new IllegalArgumentException("Debes indicar el correo del cliente para enviar la boleta.");
        }

        validateSmtpConfiguration();

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            if (mailFrom != null && !mailFrom.isBlank()) {
                helper.setFrom(mailFrom);
            }

            helper.setTo(request.getCustomerEmail().trim());
            helper.setSubject("boleta " + request.getReceiptNumber());
            helper.setText(buildHtmlBody(request), true);

            mailSender.send(message);
        } catch (MessagingException ex) {
            throw new IllegalStateException("No se pudo construir el correo HTML de boleta. Detalle: " + firstCauseMessage(ex));
        } catch (MailAuthenticationException ex) {
            throw new IllegalStateException("Fallo autenticacion SMTP. Verifica usuario/contrasena del correo remitente. En Gmail debes usar App Password de 16 caracteres con 2FA habilitado.");
        } catch (MailSendException ex) {
            throw new IllegalStateException("No se pudo enviar el correo de boleta. SMTP " + mailHost + ":" + mailPort + " reporto: " + firstCauseMessage(ex));
        } catch (MailException ex) {
            throw new IllegalStateException("No se pudo enviar el correo de boleta. Revisa la configuracion SMTP. Detalle: " + firstCauseMessage(ex));
        }
    }

    private void validateSmtpConfiguration() {
        if (mailHost == null || mailHost.isBlank() || mailPort <= 0) {
            throw new IllegalStateException("Configuracion SMTP incompleta: faltan host/port en spring.mail.host y spring.mail.port.");
        }
        if (mailFrom == null || mailFrom.isBlank()) {
            throw new IllegalStateException("Configuracion SMTP incompleta: falta spring.mail.username (correo remitente).");
        }
        if (mailPassword == null || mailPassword.isBlank()) {
            throw new IllegalStateException("Configuracion SMTP incompleta: falta spring.mail.password.");
        }
    }

    private String firstCauseMessage(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        String message = current.getMessage();
        return (message == null || message.isBlank()) ? ex.getClass().getSimpleName() : message;
    }

        private String buildHtmlBody(ReceiptEmailRequest request) {
        String receiptJson;
        try {
            receiptJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(request);
        } catch (JsonProcessingException ex) {
            receiptJson = "{}";
        }

                String productRows = buildProductRows(request.getItems());
                String shipmentRows = buildShipmentRows(request.getShipments());

                return """
                                <!DOCTYPE html>
                                <html lang=\"es\">
                                <head>
                                    <meta charset=\"UTF-8\">
                                    <style>
                                        body { font-family: Arial, sans-serif; color: #1f2937; }
                                        .wrap { max-width: 860px; margin: 0 auto; padding: 16px; }
                                        .card { background: #f8f9fa; border-radius: 10px; padding: 18px; }
                                        h2 { margin: 0 0 8px 0; }
                                        table { width: 100%%; border-collapse: collapse; margin: 10px 0 18px 0; background: #fff; }
                                        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
                                        th { background: #f3f4f6; }
                                        .totals td { border: none; padding: 4px 0; }
                                        .muted { color: #6b7280; font-size: 13px; }
                                        pre { background: #111827; color: #e5e7eb; padding: 12px; border-radius: 8px; overflow-x: auto; }
                                    </style>
                                </head>
                                <body>
                                    <div class=\"wrap\">
                                        <div class=\"card\">
                                            <h2>FlashStock</h2>
                                            <div><strong>Boleta N°:</strong> %s</div>
                                            <div><strong>Fecha:</strong> %s</div>
                                            <div><strong>Cliente:</strong> %s %s</div>
                                            <div><strong>Correo:</strong> %s</div>
                                            <div><strong>Direccion:</strong> %s</div>

                                            <h3>Desglose de productos</h3>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Producto</th>
                                                        <th>SKU</th>
                                                        <th>Cantidad</th>
                                                        <th>Precio unitario</th>
                                                        <th>Total linea</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    %s
                                                </tbody>
                                            </table>

                                            <h3>Datos del repartidor y envio</h3>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Pedido</th>
                                                        <th>Tracking</th>
                                                        <th>Carrier</th>
                                                        <th>Repartidor</th>
                                                        <th>Estado</th>
                                                        <th>ETA</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    %s
                                                </tbody>
                                            </table>

                                            <table class=\"totals\">
                                                <tr><td><strong>Subtotal:</strong></td><td>%s</td></tr>
                                                <tr><td><strong>Envio:</strong></td><td>%s</td></tr>
                                                <tr><td><strong>Descuento:</strong></td><td>-%s</td></tr>
                                                <tr><td><strong>Total boleta:</strong></td><td><strong>%s</strong></td></tr>
                                            </table>

                                            <h3>JSON de boleta</h3>
                                            <pre>%s</pre>

                                            <p>FlashStock<br>
                                            Tú compra suma un granito mas de arena para la montaña, muchas gracias<br>
                                            Equipo de soporte FlashStock<br>
                                            +56962494006<br>
                                            soporte.flashstock@gmail.com<br>
                                            Antonio Varas, Providencia</p>
                                        </div>
                                    </div>
                                </body>
                                </html>
                                """.formatted(
                                safe(request.getReceiptNumber()),
                                safe(request.getCreatedAt()),
                                safe(request.getCustomerFirstName()),
                                safe(request.getCustomerLastName()),
                                safe(request.getCustomerEmail()),
                                safe(request.getShippingAddress()),
                                productRows,
                                shipmentRows,
                                currency(request.getSubtotal()),
                                currency(request.getShipping()),
                                currency(request.getDiscount()),
                                currency(request.getTotal()),
                                escapeHtml(receiptJson)
                );
    }

        private String buildProductRows(List<ReceiptLineItem> items) {
                if (items == null || items.isEmpty()) {
                        return "<tr><td colspan=\"5\" class=\"muted\">Sin productos</td></tr>";
                }

                StringBuilder rows = new StringBuilder();
                for (ReceiptLineItem item : items) {
                        rows.append("<tr>")
                                        .append("<td>").append(escapeHtml(safe(item.getProductName()))).append("</td>")
                                        .append("<td>").append(escapeHtml(safe(item.getSku()))).append("</td>")
                                        .append("<td>").append(item.getQuantity() == null ? 0 : item.getQuantity()).append("</td>")
                                        .append("<td>").append(currency(item.getUnitPrice())).append("</td>")
                                        .append("<td>").append(currency(item.getLineTotal())).append("</td>")
                                        .append("</tr>");
                }
                return rows.toString();
        }

        private String buildShipmentRows(List<ReceiptShipmentInfo> shipments) {
                if (shipments == null || shipments.isEmpty()) {
                        return "<tr><td colspan=\"6\" class=\"muted\">Sin envios asociados</td></tr>";
                }

                StringBuilder rows = new StringBuilder();
                for (ReceiptShipmentInfo shipment : shipments) {
                        rows.append("<tr>")
                                        .append("<td>").append(escapeHtml(safe(shipment.getOrderNumber()))).append("</td>")
                                        .append("<td>").append(escapeHtml(safe(shipment.getTrackingNumber()))).append("</td>")
                                        .append("<td>").append(escapeHtml(safe(shipment.getCarrier()))).append("</td>")
                                        .append("<td>").append(escapeHtml(safe(shipment.getCourierName()))).append("</td>")
                                        .append("<td>").append(escapeHtml(safe(shipment.getStatus()))).append("</td>")
                                        .append("<td>").append(escapeHtml(safe(shipment.getEta()))).append("</td>")
                                        .append("</tr>");
                }
                return rows.toString();
        }

        private String currency(BigDecimal value) {
                return "$" + (value == null ? "0.00" : value.setScale(2, java.math.RoundingMode.HALF_UP));
        }

        private String escapeHtml(String value) {
                return safe(value)
                                .replace("&", "&amp;")
                                .replace("<", "&lt;")
                                .replace(">", "&gt;")
                                .replace("\"", "&quot;")
                                .replace("'", "&#39;");
        }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
