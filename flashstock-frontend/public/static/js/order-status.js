(function () {
    "use strict";

    const API_BASE = window.FLASHSTOCK_API_BASE || "";
    const REFRESH_MS = 1000;
    const CHILE_BOUNDS = {
        north: -17.0,
        south: -56.0,
        west: -110.0,
        east: -66.0
    };

    let currentSession = null;
    let activeOrder = null;
    let trackingMap = null;
    let trackingRoute = null;
    let trackingMarkers = { store: null, customer: null, courier: null };
    let mapsLoader = null;

    async function requestJson(url, options) {
        const response = await fetch(url, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            cache: "no-store",
            ...options
        });

        if (!response.ok) {
            let message = "";
            try {
                const payload = await response.json();
                message = payload?.data || payload?.message || "";
            } catch (_) {
                message = "";
            }
            throw new Error(message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    const Api = {
        me: () => requestJson(`${API_BASE}/api/auth/me`),
        getMyOrders: () => requestJson(`${API_BASE}/api/orders/my-history`),
        getCustomerOrders: () => requestJson(`${API_BASE}/api/orders/customer-shipping`),
        getTracking: (tracking) => requestJson(`${API_BASE}/api/shipping/tracking/${encodeURIComponent(tracking)}`),
        mapsConfig: () => requestJson(`${API_BASE}/api/maps/config`),
        confirmReceived: (orderNumber) => requestJson(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/confirm-received`, { method: "POST" })
    };

    function normalizeTracking(value) {
        return String(value || "").trim();
    }

    function isAdminSession() {
        const hasAdminRole = Array.isArray(currentSession?.authorities) && currentSession.authorities.includes("ROLE_ADMIN");
        return Boolean(currentSession?.admin) || hasAdminRole;
    }

    async function fetchOrdersForRole() {
        const response = isAdminSession() ? await Api.getCustomerOrders() : await Api.getMyOrders();
        return Array.isArray(response?.data) ? response.data : [];
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function updateUserIcon() {
        const userLink = document.getElementById("navbarUserLink");
        if (!userLink) {
            return;
        }
        const icon = userLink.querySelector("i");

        if (currentSession?.authenticated) {
            userLink.href = "/index.html";
            userLink.title = currentSession.email || "Sesion activa";
            if (icon) {
                icon.className = "fas fa-user-check fa-2x text-success";
            }
        }
    }

    function renderOrdersList(rows) {
        const list = document.getElementById("statusOrdersList");
        if (!list) {
            return;
        }

        if (!rows.length) {
            list.innerHTML = "<div class='text-muted'>Aun no hay pedidos visibles para este rol.</div>";
            return;
        }

        list.innerHTML = rows.map((row) => {
            const tracking = normalizeTracking(row.shipmentTrackingNumber);
            const shipStatus = String(row.shipmentStatus || "PENDING");
            const shipStatusUpper = shipStatus.toUpperCase();
            const badgeClass = shipStatusUpper.includes("DELIVER") || shipStatusUpper.includes("COMPLET")
                ? "success"
                : (shipStatusUpper.includes("TRANSIT") || shipStatusUpper.includes("ENVI") ? "warning" : "secondary");

            return `<button class="btn btn-light border w-100 text-start mb-2 js-pick-order" data-order="${row.orderNumber || ""}" data-tracking="${tracking}">
                <div class="d-flex justify-content-between align-items-center">
                    <span><strong>${row.orderNumber || "ORD-N/A"}</strong> | ${row.customerFirstName || ""} ${row.customerLastName || ""}</span>
                    <span class="badge bg-${badgeClass}">${shipStatus}</span>
                </div>
                <div class="small text-muted">Tracking: ${tracking || "Sin tracking"}</div>
            </button>`;
        }).join("");

        list.querySelectorAll(".js-pick-order").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const orderNumber = btn.getAttribute("data-order") || "";
                const tracking = normalizeTracking(btn.getAttribute("data-tracking") || "");
                if (!tracking) {
                    setText("statusActionResult", "Este pedido aun no tiene tracking asignado.");
                    return;
                }

                activeOrder = { orderNumber, tracking };
                await refreshActiveTracking();
            });
        });
    }

    async function loadTrackingManually() {
        const input = document.getElementById("statusManualTracking");
        const status = document.getElementById("statusManualTrackingResult");
        const button = document.getElementById("btnStatusManualTracking");

        const tracking = normalizeTracking(input?.value);
        if (!tracking) {
            if (status) {
                status.textContent = "Ingresa un tracking valido.";
            }
            return;
        }

        if (button) {
            button.disabled = true;
        }
        if (status) {
            status.textContent = "Cargando seguimiento...";
        }

        try {
            activeOrder = { orderNumber: activeOrder?.orderNumber || "", tracking };
            await refreshActiveTracking();
            if (status) {
                status.textContent = `Tracking ${tracking} cargado correctamente.`;
            }
        } catch (error) {
            if (status) {
                status.textContent = `No se pudo cargar tracking: ${error.message}`;
            }
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function bindManualTracking() {
        const input = document.getElementById("statusManualTracking");
        const button = document.getElementById("btnStatusManualTracking");

        button?.addEventListener("click", () => {
            loadTrackingManually().catch(() => {
                setText("statusManualTrackingResult", "No se pudo cargar tracking.");
            });
        });

        input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                loadTrackingManually().catch(() => {
                    setText("statusManualTrackingResult", "No se pudo cargar tracking.");
                });
            }
        });
    }

    async function ensureGoogleMapsLoaded() {
        if (window.google && window.google.maps) {
            return;
        }

        if (mapsLoader) {
            await mapsLoader;
            return;
        }

        mapsLoader = (async () => {
            const cfg = await Api.mapsConfig();
            const key = cfg?.data?.googleApiKey || "";
            if (!key || key === "YOUR_GOOGLE_MAPS_API_KEY") {
                throw new Error("Falta configurar Google Maps API key");
            }

            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry`;
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
                document.head.appendChild(script);
            });
        })();

        await mapsLoader;
    }

    async function ensureMap() {
        const container = document.getElementById("statusDeliveryMap");
        if (!container) {
            return null;
        }

        await ensureGoogleMapsLoaded();

        if (!trackingMap) {
            trackingMap = new window.google.maps.Map(container, {
                center: { lat: -33.4489, lng: -70.6693 },
                zoom: 12,
                mapTypeControl: false,
                streetViewControl: false,
                restriction: {
                    latLngBounds: CHILE_BOUNDS,
                    strictBounds: true
                }
            });
        }

        return trackingMap;
    }

    function drawRoute(map, data) {
        let points = [];
        try {
            const parsed = JSON.parse(data.routeGeoJson || "{}");
            points = Array.isArray(parsed?.geometry?.coordinates)
                ? parsed.geometry.coordinates.map((p) => ({ lat: Number(p[1]), lng: Number(p[0]) }))
                : [];
        } catch (_) {
            points = [];
        }

        const origin = { lat: Number(data.originLat), lng: Number(data.originLng) };
        const destination = { lat: Number(data.destinationLat), lng: Number(data.destinationLng) };
        const courier = { lat: Number(data.courierLat), lng: Number(data.courierLng) };

        if (points.length < 2) {
            points = [origin, destination];
        }

        if (trackingRoute) {
            trackingRoute.setMap(null);
        }

        trackingRoute = new window.google.maps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: "#f0ad00",
            strokeOpacity: 0.95,
            strokeWeight: 6
        });
        trackingRoute.setMap(map);

        function upsert(key, pos, title, iconUrl) {
            if (!trackingMarkers[key]) {
                trackingMarkers[key] = new window.google.maps.Marker({
                    map,
                    position: pos,
                    title,
                    icon: { url: iconUrl, scaledSize: new window.google.maps.Size(30, 30) }
                });
            } else {
                trackingMarkers[key].setPosition(pos);
                trackingMarkers[key].setTitle(title);
            }
        }

        upsert("store", origin, "Tienda", "https://maps.google.com/mapfiles/ms/icons/green-dot.png");
        upsert("customer", destination, "Cliente", "https://maps.google.com/mapfiles/ms/icons/red-dot.png");
        upsert("courier", courier, "Conductor", "https://maps.google.com/mapfiles/ms/icons/blue-dot.png");

        const bounds = new window.google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        bounds.extend(courier);
        map.fitBounds(bounds);
    }

    async function refreshActiveTracking() {
        if (!activeOrder?.tracking) {
            return;
        }

        const trackingResp = await Api.getTracking(normalizeTracking(activeOrder.tracking));
        const data = trackingResp?.data;
        if (!data) {
            return;
        }

        activeOrder = {
            orderNumber: data.orderNumber || activeOrder.orderNumber || "",
            tracking: normalizeTracking(data.trackingNumber || activeOrder.tracking)
        };

        const panel = document.getElementById("statusTrackingPanel");
        if (panel) {
            panel.style.display = "block";
        }

        setText("statusOrderNumber", data.orderNumber || activeOrder.orderNumber || "-");
        setText("statusOrderState", `${data.orderStatus || "proceso"} / ${data.shipmentStatus || "proceso"}`);
        setText("statusTrackingNumber", data.trackingNumber || activeOrder.tracking);
        setText("statusEtaRemaining", data.remainingDurationText || "-");
        setText("statusCourier", data.courierName || "Repartidor FlashStock");
        setText("statusAddress", data.shippingAddress || "-");
        setText("statusUpdatedAt", data.lastUpdate || "-");
        setText("statusLastUpdate", `Actualizado: ${new Date().toLocaleTimeString()}`);

        const map = await ensureMap();
        if (map) {
            drawRoute(map, data);
        }
    }

    function bindActionButtons() {
        document.getElementById("btnTip")?.addEventListener("click", () => {
            setText("statusActionResult", "Gracias por querer dejar propina. Esta opcion se habilitara en la siguiente version.");
        });

        document.getElementById("btnCallCourier")?.addEventListener("click", () => {
            setText("statusActionResult", "Llamando repartidor... +56 9 6249 4006");
            window.location.href = "tel:+56962494006";
        });

        document.getElementById("btnContactUs")?.addEventListener("click", () => {
            setText("statusActionResult", "Contactanos en aron83353@gmail.com o +56 9 6249 4006");
        });

        const receivedBtn = document.getElementById("btnReceived");
        if (receivedBtn && isAdminSession()) {
            receivedBtn.disabled = true;
            receivedBtn.title = "Disponible solo para cliente dueno del pedido";
        }

        receivedBtn?.addEventListener("click", () => {
            const modal = new window.bootstrap.Modal(document.getElementById("receivedConfirmModal"));
            modal.show();
        });

        document.getElementById("btnModalSupport")?.addEventListener("click", () => {
            setText("statusActionResult", "Soporte tecnico notificado. Te contactaremos en breve.");
            const modalEl = document.getElementById("receivedConfirmModal");
            window.bootstrap.Modal.getInstance(modalEl)?.hide();
        });

        document.getElementById("btnModalConfirm")?.addEventListener("click", async () => {
            if (isAdminSession()) {
                setText("statusActionResult", "El admin no puede confirmar recepcion de pedidos de clientes.");
                return;
            }

            if (!activeOrder?.orderNumber) {
                setText("statusActionResult", "Selecciona un pedido primero.");
                return;
            }

            try {
                await Api.confirmReceived(activeOrder.orderNumber);
                setText("statusActionResult", `Pedido ${activeOrder.orderNumber} confirmado como recibido.`);
                const modalEl = document.getElementById("receivedConfirmModal");
                window.bootstrap.Modal.getInstance(modalEl)?.hide();
                await refreshOrders();
                await refreshActiveTracking();
            } catch (error) {
                setText("statusActionResult", `No se pudo confirmar recepcion: ${error.message}`);
            }
        });
    }

    async function refreshOrders() {
        let rows = [];
        try {
            rows = await fetchOrdersForRole();
            renderOrdersList(rows);
        } catch (error) {
            const list = document.getElementById("statusOrdersList");
            if (list) {
                list.innerHTML = "<div class='text-muted'>No se pudo cargar pedidos. Puedes buscar por tracking.</div>";
            }
            return;
        }

        if (!activeOrder && rows.length) {
            const firstWithTracking = rows.find((r) => r.shipmentTrackingNumber);
            if (firstWithTracking) {
                activeOrder = {
                    orderNumber: firstWithTracking.orderNumber,
                    tracking: firstWithTracking.shipmentTrackingNumber
                };
                await refreshActiveTracking();
            }
        }
    }

    async function bootstrap() {
        try {
            const meResp = await Api.me();
            currentSession = meResp?.data || null;
            updateUserIcon();
        } catch (_) {
            currentSession = null;
        }

        bindActionButtons();
        bindManualTracking();

        await refreshOrders();

        const urlTracking = normalizeTracking(new URLSearchParams(window.location.search || "").get("tracking"));
        if (urlTracking) {
            const input = document.getElementById("statusManualTracking");
            if (input) {
                input.value = urlTracking;
            }
            activeOrder = { orderNumber: activeOrder?.orderNumber || "", tracking: urlTracking };
            await refreshActiveTracking();
        }

        window.setInterval(() => {
            refreshOrders().catch(() => {
                // refreshOrders already handles visual fallback.
            });
            refreshActiveTracking().catch(() => {
                setText("statusActionResult", "No se pudo refrescar tracking.");
            });
        }, REFRESH_MS);
    }

    bootstrap().catch((error) => {
        setText("statusActionResult", `Error de inicializacion: ${error.message}`);
    });
})();
