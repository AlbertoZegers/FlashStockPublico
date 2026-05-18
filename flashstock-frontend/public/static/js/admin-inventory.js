(function () {
    "use strict";

    const API_BASE = window.FLASHSTOCK_API_BASE || "";

    async function requestJson(url, options) {
        const response = await fetch(url, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            ...options
        });

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return response.json();
    }

    const AdminApi = {
        getCurrentUser: () => requestJson(`${API_BASE}/api/auth/me`),
        listInventory: () => requestJson(`${API_BASE}/api/inventory`),
        listInventoryRealtime: () => requestJson(`${API_BASE}/api/inventory/realtime`),
        createInventory: (payload) => requestJson(`${API_BASE}/api/inventory`, { method: "POST", body: JSON.stringify(payload) }),
        updateInventoryQuantity: (sku, quantity) => requestJson(`${API_BASE}/api/inventory/${encodeURIComponent(sku)}/quantity/${quantity}`, { method: "PATCH" }),
        deleteInventoryBySku: (sku) => requestJson(`${API_BASE}/api/inventory/${encodeURIComponent(sku)}`, { method: "DELETE" })
    };

    const state = {
        refreshTimerId: null,
        refreshMs: 1000
    };

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function toggle(elId, hidden) {
        const el = document.getElementById(elId);
        if (!el) {
            return;
        }
        el.classList.toggle("hidden", hidden);
    }

    function setDeniedReason(text) {
        const el = document.getElementById("adminDeniedReason");
        if (el) {
            el.textContent = text;
        }
    }

    function riskClass(level) {
        if (!level) {
            return "risk risk-LOW";
        }
        return `risk risk-${level}`;
    }

    function toInt(value) {
        return Number.parseInt(value, 10) || 0;
    }

    function toMoney(value) {
        const parsed = Number.parseFloat(value);
        if (Number.isNaN(parsed)) {
            return "0.00";
        }
        return parsed.toFixed(2);
    }

    function renderMetrics(items) {
        const skuCount = items.length;
        const totalStock = items.reduce((acc, it) => acc + toInt(it.currentStock), 0);
        const lowCount = items.filter((it) => it.riskLevel === "LOW").length;
        const criticalCount = items.filter((it) => it.riskLevel === "CRITICAL").length;

        setText("metricSkus", String(skuCount));
        setText("metricStock", String(totalStock));
        setText("metricLow", String(lowCount));
        setText("metricCritical", String(criticalCount));
    }

    function renderStockAlerts(items) {
        const container = document.getElementById("stockAlertsBody");
        if (!container) {
            return;
        }

        const criticalItems = items.filter((it) => toInt(it.availableToSell) <= 0);
        const lowItems = items.filter((it) => {
            const available = toInt(it.availableToSell);
            return available > 0 && available <= 5;
        });

        if (!criticalItems.length && !lowItems.length) {
            container.innerHTML = '<div class="text-success">Inventario estable. No hay alertas de stock.</div>';
            return;
        }

        const criticalText = criticalItems.length
            ? `<div class="mb-2 text-danger"><strong>Stock agotado:</strong> ${criticalItems.map((it) => `${it.sku} (disp: ${toInt(it.availableToSell)})`).join(", ")}</div>`
            : "";

        const lowText = lowItems.length
            ? `<div class="text-warning"><strong>Stock bajo (<= 5):</strong> ${lowItems.map((it) => `${it.sku} (disp: ${toInt(it.availableToSell)})`).join(", ")}</div>`
            : "";

        container.innerHTML = `${criticalText}${lowText}`;
    }

    function renderTable(items) {
        const body = document.getElementById("inventoryTableBody");
        if (!body) {
            return;
        }

        if (!items.length) {
            body.innerHTML = '<tr><td colspan="9" class="text-muted">Sin registros de inventario.</td></tr>';
            return;
        }

        body.innerHTML = items.map((item) => {
            return `<tr>
                <td>${item.sku || "-"}</td>
                <td>${item.warehouse || "-"}</td>
                <td>${toInt(item.currentStock)}</td>
                <td>${toInt(item.orderedUnits)}</td>
                <td>${toInt(item.preparingShipments)}</td>
                <td>${toInt(item.inTransitShipments)}</td>
                <td>${toInt(item.deliveredShipments)}</td>
                <td>${toInt(item.availableToSell)}</td>
                <td><span class="${riskClass(item.riskLevel)}">${item.riskLevel || "LOW"}</span></td>
            </tr>`;
        }).join("");
    }

    async function loadDashboard() {
        try {
            const resp = await AdminApi.listInventoryRealtime();
            const items = Array.isArray(resp?.data) ? resp.data : [];

            renderMetrics(items);
            renderTable(items);
            renderStockAlerts(items);
            setText("lastUpdate", `Actualizado: ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                setText("sessionInfo", "Tu sesion cambio o no tienes permisos para refrescar este panel.");
                setDeniedReason("No tienes permisos de administrador vigentes para refrescar inventario.");
                toggle("adminDenied", false);
                toggle("adminContent", true);
                if (state.refreshTimerId) {
                    window.clearInterval(state.refreshTimerId);
                    state.refreshTimerId = null;
                }
                return;
            }
            throw error;
        }
    }

    function renderCatalog(items) {
        const body = document.getElementById("catalogTableBody");
        if (!body) {
            return;
        }

        if (!items.length) {
            body.innerHTML = '<tr><td colspan="8" class="text-muted">Sin productos cargados.</td></tr>';
            return;
        }

        body.innerHTML = items.map((item) => {
            const image = item.imageUrl || "../img/fruite-item-1.jpg";
            const active = item.active === false ? "No" : "Si";
            return `<tr>
                <td><img src="${image}" alt="${item.name || item.sku || "Producto"}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;"></td>
                <td>${item.sku || "-"}</td>
                <td>${item.name || "-"}</td>
                <td>${item.category || "-"}</td>
                <td>$${toMoney(item.unitPrice)}</td>
                <td>${toInt(item.quantity)}</td>
                <td>${active}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-sku="${item.sku || ""}">Eliminar</button>
                </td>
            </tr>`;
        }).join("");
    }

    async function loadCatalog() {
        const resp = await AdminApi.listInventory();
        const items = (Array.isArray(resp?.data) ? resp.data : []).filter((item) => item.active !== false);
        renderCatalog(items);
    }

    async function handleCreateInventory(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        const payload = {
            sku: String(formData.get("sku") || "").trim(),
            name: String(formData.get("name") || "").trim(),
            category: String(formData.get("category") || "").trim(),
            unitPrice: Number.parseFloat(formData.get("unitPrice")) || 0,
            quantity: toInt(formData.get("quantity")),
            warehouse: String(formData.get("warehouse") || "").trim(),
            imageUrl: String(formData.get("imageUrl") || "").trim(),
            description: String(formData.get("description") || "").trim(),
            active: true
        };

        await AdminApi.createInventory(payload);
        form.reset();
        await loadCatalog();
        await loadDashboard();
    }

    async function handleUpdateQuantity(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        const sku = String(formData.get("sku") || "").trim();
        const quantity = toInt(formData.get("quantity"));

        await AdminApi.updateInventoryQuantity(sku, quantity);
        form.reset();
        await loadCatalog();
        await loadDashboard();
    }

    async function handleCatalogClick(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const action = button.getAttribute("data-action");
        const sku = button.getAttribute("data-sku") || "";
        if (!sku) {
            return;
        }

        if (action === "delete") {
            const confirmed = window.confirm(`Eliminar producto ${sku}? Esta accion no se puede deshacer.`);
            if (!confirmed) {
                return;
            }

            await AdminApi.deleteInventoryBySku(sku);
            await loadCatalog();
            await loadDashboard();
        }
    }

    function bindEvents() {
        const btnRefresh = document.getElementById("btnRefresh");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", () => {
                loadDashboard().catch((error) => {
                    setText("sessionInfo", `No se pudo refrescar: ${error.message}`);
                });
            });
        }

        const createForm = document.getElementById("createInventoryForm");
        if (createForm) {
            createForm.addEventListener("submit", (event) => {
                handleCreateInventory(event).catch((error) => {
                    setText("sessionInfo", `No se pudo crear SKU: ${error.message}`);
                });
            });
        }

        const updateForm = document.getElementById("updateQuantityForm");
        if (updateForm) {
            updateForm.addEventListener("submit", (event) => {
                handleUpdateQuantity(event).catch((error) => {
                    setText("sessionInfo", `No se pudo actualizar stock: ${error.message}`);
                });
            });
        }

        const catalogTable = document.getElementById("catalogTableBody");
        if (catalogTable) {
            catalogTable.addEventListener("click", (event) => {
                handleCatalogClick(event).catch((error) => {
                    setText("sessionInfo", `No se pudo ejecutar accion del catalogo: ${error.message}`);
                });
            });
        }
    }

    async function validateAdminSession() {
        const sessionResp = await AdminApi.getCurrentUser();
        const session = sessionResp?.data;

        if (!session?.authenticated) {
            setText("sessionInfo", "No hay sesion activa. Inicia sesion con Google para continuar.");
            setDeniedReason("No se detecto una sesion activa. Inicia sesion con una cuenta administradora para continuar.");
            toggle("adminDenied", false);
            toggle("adminContent", true);
            return false;
        }

        if (!session?.admin) {
            setText("sessionInfo", `Sesion activa: ${session.email || "usuario"}. Sin rol administrador.`);
            setDeniedReason(`La cuenta ${session.email || "actual"} no tiene rol administrador para ver este panel.`);
            toggle("adminDenied", false);
            toggle("adminContent", true);
            return false;
        }

        setText("sessionInfo", `Administrador: ${session.displayName || session.email}`);
        toggle("adminDenied", true);
        toggle("adminContent", false);
        return true;
    }

    async function bootstrapAdminInventory() {
        const isAdmin = await validateAdminSession();
        if (!isAdmin) {
            return;
        }

        bindEvents();
        await loadCatalog();
        await loadDashboard();

        state.refreshTimerId = window.setInterval(() => {
            loadDashboard().catch(() => {
                setText("lastUpdate", "Error al refrescar automaticamente");
            });
        }, state.refreshMs);
    }

    bootstrapAdminInventory().catch((error) => {
        setText("sessionInfo", `Error de inicializacion: ${error.message}`);
    });
})();
