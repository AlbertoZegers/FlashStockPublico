(function () {
    "use strict";

    const API_BASE = window.FLASHSTOCK_API_BASE || "";
    const REFRESH_MS = 1500;

    const charts = {
        orders: null,
        shipments: null,
        sku: null,
        cashflow: null
    };

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function toggle(id, hidden) {
        const el = document.getElementById(id);
        if (!el) {
            return;
        }
        el.classList.toggle("hidden", hidden);
    }

    function setDeniedReason(text) {
        const el = document.getElementById("dashDeniedReason");
        if (el) {
            el.textContent = text;
        }
    }

    async function requestJson(url) {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    async function getSession() {
        const payload = await requestJson(`${API_BASE}/api/auth/me`);
        return payload?.data || null;
    }

    async function getMetrics() {
        const payload = await requestJson(`${API_BASE}/api/admin/metrics`);
        return payload?.data || null;
    }

    async function getCustomerShipping() {
        const payload = await requestJson(`${API_BASE}/api/orders/customer-shipping`);
        return Array.isArray(payload?.data) ? payload.data : [];
    }

    async function getShippingTracking(trackingNumber) {
        const payload = await requestJson(`${API_BASE}/api/shipping/tracking/${encodeURIComponent(trackingNumber)}`);
        return payload?.data || null;
    }

    function formatMoney(value) {
        return `$${Number(value || 0).toFixed(2)}`;
    }

    function renderKpis(metrics) {
        setText("kpiSkus", String(metrics.inventorySkuCount || 0));
        setText("kpiStock", String(metrics.totalStock || 0));
        setText("kpiOrders", String(metrics.totalOrders || 0));
        setText("kpiShipments", String(metrics.totalShipments || 0));
    }

    function renderTable(metrics) {
        const body = document.getElementById("dashSkuTable");
        if (!body) {
            return;
        }

        const items = Array.isArray(metrics.skuMetrics) ? metrics.skuMetrics : [];
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="6" class="text-muted">Sin datos</td></tr>';
            return;
        }

        body.innerHTML = items.slice(0, 12).map((item) => `
            <tr>
                <td>${item.sku || "-"}</td>
                <td>${item.warehouse || "-"}</td>
                <td>${item.currentStock || 0}</td>
                <td>${item.orderedUnits || 0}</td>
                <td>${item.availableUnits || 0}</td>
                <td>${item.riskLevel || "HEALTHY"}</td>
            </tr>
        `).join("");
    }

    function upsertChart(key, canvasId, configFactory) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === "undefined") {
            return;
        }

        if (!charts[key]) {
            charts[key] = new Chart(canvas, configFactory());
            return;
        }

        const next = configFactory();
        charts[key].data = next.data;
        charts[key].update("none");
    }

    function renderCharts(metrics) {
        upsertChart("orders", "ordersChart", () => ({
            type: "doughnut",
            data: {
                labels: ["Creadas", "Completadas", "Canceladas"],
                datasets: [{
                    data: [metrics.createdOrders || 0, metrics.completedOrders || 0, metrics.cancelledOrders || 0],
                    backgroundColor: ["#0ea5e9", "#10b981", "#f43f5e"]
                }]
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } } }
        }));

        upsertChart("shipments", "shipmentsChart", () => ({
            type: "doughnut",
            data: {
                labels: ["Preparando", "Transito", "Entregados"],
                datasets: [{
                    data: [metrics.preparingShipments || 0, metrics.inTransitShipments || 0, metrics.deliveredShipments || 0],
                    backgroundColor: ["#f59e0b", "#3b82f6", "#22c55e"]
                }]
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } } }
        }));

        const topSkus = (metrics.skuMetrics || []).slice(0, 8);
        upsertChart("sku", "skuChart", () => ({
            type: "bar",
            data: {
                labels: topSkus.map((item) => item.sku || "-"),
                datasets: [
                    {
                        label: "Stock",
                        data: topSkus.map((item) => item.currentStock || 0),
                        backgroundColor: "#0ea5e9"
                    },
                    {
                        label: "Pedidos",
                        data: topSkus.map((item) => item.orderedUnits || 0),
                        backgroundColor: "#f97316"
                    }
                ]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { position: "bottom" } }
            }
        }));

        upsertChart("cashflow", "cashflowChart", () => ({
            type: "bar",
            data: {
                labels: ["Bruto", "Realizado", "Pendiente"],
                datasets: [{
                    label: "Cashflow",
                    data: [metrics.grossCashflow || 0, metrics.realizedCashflow || 0, metrics.pendingCashflow || 0],
                    backgroundColor: ["#0ea5e9", "#10b981", "#f59e0b"]
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        }));
    }

    function renderCashflowInHeader(metrics) {
        setText("dashLastUpdate", `Actualizado: ${new Date().toLocaleTimeString()} | Bruto ${formatMoney(metrics.grossCashflow)} | Realizado ${formatMoney(metrics.realizedCashflow)} | Pendiente ${formatMoney(metrics.pendingCashflow)}`);
    }

    function formatDateTime(value) {
        if (!value) {
            return "-";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString();
    }

    async function renderOrdersLivePanel() {
        const body = document.getElementById("dashOrdersLiveBody");
        if (!body) {
            return;
        }

        const rows = await getCustomerShipping();
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="7" class="text-muted">Sin pedidos con envío.</td></tr>';
            setText("dashOrdersLastUpdate", `Actualizado: ${new Date().toLocaleTimeString()}`);
            return;
        }

        const enriched = await Promise.all(rows.slice(0, 15).map(async (row) => {
            const tracking = row.shipmentTrackingNumber;
            if (!tracking) {
                return { row, trackingData: null };
            }
            try {
                const trackingData = await getShippingTracking(tracking);
                return { row, trackingData };
            } catch (_) {
                return { row, trackingData: null };
            }
        }));

        body.innerHTML = enriched.map(({ row, trackingData }) => {
            const client = `${row.customerFirstName || ""} ${row.customerLastName || ""}`.trim() || row.customerEmail || "-";
            const status = `${row.orderStatus || "-"} / ${row.shipmentStatus || "-"}`;
            const eta = trackingData?.remainingDurationText || trackingData?.totalDurationText || "-";
            const startedAt = formatDateTime(trackingData?.startedAt);
            const lastUpdate = formatDateTime(trackingData?.lastUpdate);
            return `
                <tr>
                    <td>${row.orderNumber || "-"}</td>
                    <td>${client}</td>
                    <td>${row.shipmentTrackingNumber || "-"}</td>
                    <td>${status}</td>
                    <td>${eta}</td>
                    <td>${startedAt}</td>
                    <td>${lastUpdate}</td>
                </tr>`;
        }).join("");

        setText("dashOrdersLastUpdate", `Actualizado: ${new Date().toLocaleTimeString()}`);
    }

    async function refreshDashboard() {
        let metrics;
        try {
            metrics = await getMetrics();
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                setText("dashSessionInfo", "Tu sesion cambio o no tienes permisos para ver metricas admin.");
                setDeniedReason("No tienes permisos de administrador vigentes para ver el dashboard global.");
                toggle("dashDenied", false);
                toggle("dashContent", true);
                return;
            }
            throw error;
        }

        if (!metrics) {
            return;
        }

        renderKpis(metrics);
        renderTable(metrics);
        renderCharts(metrics);
        renderCashflowInHeader(metrics);
        await renderOrdersLivePanel();
    }

    async function bootstrap() {
        const session = await getSession();
        if (!session?.authenticated || !session?.admin) {
            setText("dashSessionInfo", "No tienes permisos de administrador para este dashboard.");
            if (!session?.authenticated) {
                setDeniedReason("No hay sesion activa. Inicia sesion con una cuenta administradora para ingresar.");
            } else {
                setDeniedReason(`La cuenta ${session.email || "actual"} no tiene permisos de administrador.`);
            }
            toggle("dashDenied", false);
            toggle("dashContent", true);
            return;
        }

        setText("dashSessionInfo", `Administrador: ${session.displayName || session.email}`);
        toggle("dashDenied", true);
        toggle("dashContent", false);

        await refreshDashboard();
        window.setInterval(() => {
            refreshDashboard().catch(() => {
                setText("dashLastUpdate", "Error al actualizar en tiempo real");
            });
        }, REFRESH_MS);
    }

    bootstrap().catch((error) => {
        if (error.status === 401 || error.status === 403) {
            setText("dashSessionInfo", "Tu sesion cambio o no tienes permisos para ver metricas admin.");
            setDeniedReason("No tienes permisos de administrador vigentes para ver el dashboard global.");
            toggle("dashDenied", false);
            toggle("dashContent", true);
            return;
        }
        setText("dashSessionInfo", `Error de inicio: ${error.message}`);
    });
})();
