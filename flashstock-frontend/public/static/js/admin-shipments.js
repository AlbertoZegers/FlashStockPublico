(function () {
    "use strict";

    const API_BASE = window.FLASHSTOCK_API_BASE || "";
    const REFRESH_MS = 7000;
    const CHILE_BOUNDS = {
        north: -17.0,
        south: -56.0,
        west: -110.0,
        east: -66.0
    };

    let mapsLoader = null;
    const mapsByTracking = new Map();

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
        listCustomerShipping: () => requestJson(`${API_BASE}/api/orders/customer-shipping`),
        tracking: (tracking) => requestJson(`${API_BASE}/api/shipping/tracking/${encodeURIComponent(tracking)}`),
        mapsConfig: () => requestJson(`${API_BASE}/api/maps/config`)
    };

    async function ensureAdminSession() {
        const response = await Api.me();
        const session = response?.data;
        const hasAdminRole = Array.isArray(session?.authorities) && session.authorities.includes("ROLE_ADMIN");
        const isAdmin = Boolean(session?.admin) || hasAdminRole;

        if (!session?.authenticated || !isAdmin) {
            throw new Error("Acceso restringido: esta vista es solo para administradores.");
        }
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function fmtDateTime(value) {
        if (!value) {
            return "-";
        }
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) {
            return value;
        }
        return d.toLocaleString();
    }

    function carrierClass(status) {
        const norm = String(status || "").toLowerCase();
        if (norm.includes("complet") || norm.includes("deliver")) {
            return "success";
        }
        if (norm.includes("enviado") || norm.includes("transit") || norm.includes("shipped")) {
            return "warning";
        }
        if (norm.includes("cancel")) {
            return "danger";
        }
        return "secondary";
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

    function parseRoute(routeGeoJson, origin, destination) {
        let points = [];
        try {
            const parsed = JSON.parse(routeGeoJson || "{}");
            points = Array.isArray(parsed?.geometry?.coordinates)
                ? parsed.geometry.coordinates.map((p) => ({ lat: Number(p[1]), lng: Number(p[0]) }))
                : [];
        } catch (_) {
            points = [];
        }

        if (points.length < 2) {
            points = [origin, destination];
        }

        return points;
    }

    async function renderTrackingMap(trackingNumber, data) {
        await ensureGoogleMapsLoaded();

        const mapId = `shipmentMap-${trackingNumber}`;
        const container = document.getElementById(mapId);
        if (!container) {
            return;
        }

        const origin = { lat: Number(data.originLat), lng: Number(data.originLng) };
        const destination = { lat: Number(data.destinationLat), lng: Number(data.destinationLng) };
        const courier = { lat: Number(data.courierLat), lng: Number(data.courierLng) };
        const route = parseRoute(data.routeGeoJson, origin, destination);

        let state = mapsByTracking.get(trackingNumber);
        if (!state) {
            const map = new window.google.maps.Map(container, {
                center: origin,
                zoom: 12,
                mapTypeControl: false,
                streetViewControl: false,
                restriction: {
                    latLngBounds: CHILE_BOUNDS,
                    strictBounds: true
                }
            });

            state = {
                map,
                polyline: null,
                markers: {
                    store: null,
                    customer: null,
                    courier: null
                }
            };
            mapsByTracking.set(trackingNumber, state);
        }

        if (state.polyline) {
            state.polyline.setMap(null);
        }

        state.polyline = new window.google.maps.Polyline({
            path: route,
            geodesic: true,
            strokeColor: "#f0ad00",
            strokeOpacity: 0.95,
            strokeWeight: 6
        });
        state.polyline.setMap(state.map);

        function upsertMarker(key, position, title, iconUrl) {
            if (!state.markers[key]) {
                state.markers[key] = new window.google.maps.Marker({
                    map: state.map,
                    position,
                    title,
                    icon: { url: iconUrl, scaledSize: new window.google.maps.Size(30, 30) }
                });
            } else {
                state.markers[key].setPosition(position);
                state.markers[key].setTitle(title);
            }
        }

        upsertMarker("store", origin, "Tienda", "https://maps.google.com/mapfiles/ms/icons/green-dot.png");
        upsertMarker("customer", destination, "Cliente", "https://maps.google.com/mapfiles/ms/icons/red-dot.png");
        upsertMarker("courier", courier, "Conductor", "https://maps.google.com/mapfiles/ms/icons/blue-dot.png");

        const bounds = new window.google.maps.LatLngBounds();
        route.forEach((p) => bounds.extend(p));
        bounds.extend(courier);
        state.map.fitBounds(bounds);
    }

    function buildDetailsHtml(row, trackingData) {
        const status = `${trackingData?.orderStatus || row.orderStatus || "proceso"} / ${trackingData?.shipmentStatus || row.shipmentStatus || "proceso"}`;
        return `
            <div class="details-wrap">
                <div class="mb-2">
                    <span class="meta-chip">Estado: ${status}</span>
                    <span class="meta-chip">Conductor: ${trackingData?.courierName || "Repartidor FlashStock"}</span>
                    <span class="meta-chip">Direccion: ${trackingData?.shippingAddress || row.shippingAddress || "-"}</span>
                    <span class="meta-chip">ETA total: ${trackingData?.totalDurationText || "-"}</span>
                    <span class="meta-chip">ETA restante: ${trackingData?.remainingDurationText || "-"}</span>
                </div>
                <div id="shipmentMap-${row.shipmentTrackingNumber}" class="map-box"></div>
            </div>`;
    }

    async function toggleDetails(row, baseRowEl, detailsRowEl, buttonEl) {
        const isOpen = detailsRowEl.classList.contains("open");
        if (isOpen) {
            detailsRowEl.classList.remove("open");
            buttonEl.classList.remove("open");
            return;
        }

        try {
            const tracking = row.shipmentTrackingNumber;
            if (!tracking) {
                return;
            }

            const trackingResp = await Api.tracking(tracking);
            const trackingData = trackingResp?.data || null;

            detailsRowEl.innerHTML = `<td colspan="8">${buildDetailsHtml(row, trackingData)}</td>`;
            detailsRowEl.classList.add("open");
            buttonEl.classList.add("open");
            await renderTrackingMap(tracking, trackingData);
        } catch (error) {
            detailsRowEl.innerHTML = `<td colspan="8" class="text-danger small p-3">No se pudo cargar el detalle del envio: ${error.message}</td>`;
            detailsRowEl.classList.add("open");
            buttonEl.classList.add("open");
        }
    }

    function renderTable(rows) {
        const body = document.getElementById("shipmentsTableBody");
        if (!body) {
            return;
        }

        if (!rows.length) {
            body.innerHTML = "<tr><td colspan='8' class='text-muted'>No hay envios para monitorear.</td></tr>";
            return;
        }

        const html = [];
        rows.forEach((row, index) => {
            const state = `${row.orderStatus || "proceso"} / ${row.shipmentStatus || "proceso"}`;
            const badge = carrierClass(row.shipmentStatus || "");
            const customer = `${row.customerFirstName || ""} ${row.customerLastName || ""}`.trim() || "Cliente";
            const tracking = row.shipmentTrackingNumber || "-";

            html.push(`
                <tr data-row-index="${index}">
                    <td>${row.orderNumber || "-"}</td>
                    <td>${customer}</td>
                    <td>${tracking}</td>
                    <td><span class="badge bg-${badge}">${state}</span></td>
                    <td>${row.etaRemaining || "-"}</td>
                    <td>${row.startedAtText || "-"}</td>
                    <td>${row.lastUpdateText || "-"}</td>
                    <td class="text-end"><button type="button" class="toggle-btn js-toggle">&lt;</button></td>
                </tr>
                <tr class="details-row" data-details-index="${index}"><td colspan="8"></td></tr>
            `);
        });

        body.innerHTML = html.join("");

        rows.forEach((row, index) => {
            const rowEl = body.querySelector(`tr[data-row-index='${index}']`);
            const detailsEl = body.querySelector(`tr[data-details-index='${index}']`);
            const btn = rowEl?.querySelector(".js-toggle");
            if (!rowEl || !detailsEl || !btn) {
                return;
            }

            btn.addEventListener("click", () => {
                toggleDetails(row, rowEl, detailsEl, btn);
            });
        });

        if (rows.length > 0) {
            const firstBtn = body.querySelector(".js-toggle");
            firstBtn?.click();
        }
    }

    async function loadShipments() {
        const response = await Api.listCustomerShipping();
        const rows = Array.isArray(response?.data) ? response.data : [];
        const filtered = rows.filter((row) => row.shipmentTrackingNumber);

        const enriched = await Promise.all(filtered.map(async (row) => {
            try {
                const trackingResp = await Api.tracking(row.shipmentTrackingNumber);
                const t = trackingResp?.data || {};
                return {
                    ...row,
                    etaRemaining: t.remainingDurationText || "-",
                    startedAtText: fmtDateTime(t.startedAt),
                    lastUpdateText: fmtDateTime(t.lastUpdate)
                };
            } catch (_) {
                return {
                    ...row,
                    etaRemaining: "-",
                    startedAtText: "-",
                    lastUpdateText: "-"
                };
            }
        }));

        renderTable(enriched);
        const now = new Date().toLocaleTimeString();
        setText("shipmentsHeaderInfo", `Actualizado: ${now}`);
        setText("shipmentsLastUpdate", `Actualizado: ${now}`);
    }

    function bindEvents() {
        document.getElementById("btnRefreshShipments")?.addEventListener("click", () => {
            loadShipments().catch((error) => {
                setText("shipmentsHeaderInfo", `No se pudo refrescar: ${error.message}`);
            });
        });
    }

    async function bootstrap() {
        await ensureAdminSession();
        bindEvents();
        await loadShipments();

        window.setInterval(() => {
            loadShipments().catch(() => {
                // Keep panel usable if one refresh fails.
            });
        }, REFRESH_MS);
    }

    bootstrap().catch((error) => {
        setText("shipmentsHeaderInfo", `Error de inicializacion: ${error.message}`);
    });
})();