(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner(0);


    // Fixed Navbar
    $(window).scroll(function () {
        if ($(window).width() < 992) {
            if ($(this).scrollTop() > 55) {
                $('.fixed-top').addClass('shadow');
            } else {
                $('.fixed-top').removeClass('shadow');
            }
        } else {
            if ($(this).scrollTop() > 55) {
                $('.fixed-top').addClass('shadow').css('top', -55);
            } else {
                $('.fixed-top').removeClass('shadow').css('top', 0);
            }
        } 
    });
    
    
   // Back to top button
   $(window).scroll(function () {
    if ($(this).scrollTop() > 300) {
        $('.back-to-top').fadeIn('slow');
    } else {
        $('.back-to-top').fadeOut('slow');
    }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // vegetable carousel (guarded: plugin is not loaded in every page)
    if ($.fn && typeof $.fn.owlCarousel === 'function' && $('.vegetable-carousel').length > 0) {
        $(".vegetable-carousel").owlCarousel({
            autoplay: true,
            smartSpeed: 1500,
            center: false,
            dots: true,
            loop: true,
            margin: 25,
            nav : true,
            navText : [
                '<i class="bi bi-arrow-left"></i>',
                '<i class="bi bi-arrow-right"></i>'
            ],
            responsiveClass: true,
            responsive: {
                0:{
                    items:1
                },
                576:{
                    items:1
                },
                768:{
                    items:2
                },
                992:{
                    items:3
                },
                1200:{
                    items:4
                }
            }
        });
    }


    // Modal Video
    $(document).ready(function () {
        var $videoSrc;
        $('.btn-play').click(function () {
            $videoSrc = $(this).data("src");
        });

        $('#videoModal').on('shown.bs.modal', function (e) {
            $("#video").attr('src', $videoSrc + "?autoplay=1&amp;modestbranding=1&amp;showinfo=0");
        })

        $('#videoModal').on('hide.bs.modal', function (e) {
            $("#video").attr('src', $videoSrc);
        })
    });

    // FlashStock API integration
    const API_BASE = window.FLASHSTOCK_API_BASE
        || (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL)
        || '';
    const CART_STORAGE_KEY = 'flashstock_cart_v2';
    const SHIPPING_ADDRESS_KEY = 'flashstock_shipping_address';
    const RECEIPT_STORAGE_KEY = 'flashstock_last_receipt_v1';
    const RECEIPT_SESSION_KEY = 'flashstock_last_receipt_session_v1';
    const CART_REFRESH_MS = 5000;
    const INVENTORY_REFRESH_MS = 3000;
    const TRACKING_REFRESH_MS = 1000;
    const ORDER_STATUS_PAGE = 'order-status.html';
    let inventoryCache = [];
    let pendingAddItem = null;
    let currentSession = null;
    let checkoutCouponState = { code: null, discountAmount: 0, finalTotal: 0, valid: false };
    let trackingMap = null;
    let trackingRoute = null;
    let trackingMarkers = { store: null, customer: null, courier: null, order: null };
    let trackingTimer = null;
    let activeTrackingNumber = null;
    let googleMapsLoader = null;
    let googlePayScriptLoader = null;
    let googlePayClient = null;
    let googlePayConfigCache = null;
    let lastCourierPosition = null;
    let checkoutPaymentState = {
        guestPaymentApproved: false,
        transactionReference: null,
        paymentData: null
    };
    const CHILE_BOUNDS = {
        north: -17.0,
        south: -56.0,
        west: -110.0,
        east: -66.0
    };

    async function requestJson(url, options) {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            credentials: 'include',
            ...options
        });

        if (!response.ok) {
            let apiMessage = '';
            try {
                const errorPayload = await response.json();
                apiMessage = errorPayload?.data || errorPayload?.message || '';
            } catch (e) {
                apiMessage = '';
            }

            const fallback = `HTTP ${response.status}`;
            throw new Error(apiMessage || fallback);
        }

        return response.json();
    }

    const FlashStockApi = {
        getCurrentUser: () => requestJson(`${API_BASE}/api/auth/me`),
        getAdminMetrics: () => requestJson(`${API_BASE}/api/admin/metrics`),
        getMapsConfig: () => requestJson(`${API_BASE}/api/maps/config`),
        listInventory: () => requestJson(`${API_BASE}/api/inventory`),
        listInventoryRealtime: () => requestJson(`${API_BASE}/api/inventory/realtime`),
        getInventoryBySku: (sku) => requestJson(`${API_BASE}/api/inventory/${encodeURIComponent(sku)}`),
        createInventory: (payload) => requestJson(`${API_BASE}/api/inventory`, { method: 'POST', body: JSON.stringify(payload) }),
        updateInventoryQuantity: (sku, quantity) => requestJson(`${API_BASE}/api/inventory/${encodeURIComponent(sku)}/quantity/${quantity}`, { method: 'PATCH' }),
        listOrders: () => requestJson(`${API_BASE}/api/orders`),
        getOrderByNumber: (orderNumber) => requestJson(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}`),
        createOrder: (payload) => requestJson(`${API_BASE}/api/orders`, { method: 'POST', body: JSON.stringify(payload) }),
        getMyOrderHistory: (status) => {
            const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
            return requestJson(`${API_BASE}/api/orders/my-history${suffix}`);
        },
        getCustomerShipping: (status) => {
            const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
            return requestJson(`${API_BASE}/api/orders/customer-shipping${suffix}`);
        },
        updateOrderStatus: (orderNumber, status) => requestJson(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/status/${encodeURIComponent(status)}`, { method: 'PATCH' }),
        listShipping: () => requestJson(`${API_BASE}/api/shipping`),
        getShippingByTracking: (trackingNumber) => requestJson(`${API_BASE}/api/shipping/${encodeURIComponent(trackingNumber)}`),
        getShippingTracking: (trackingNumber) => requestJson(`${API_BASE}/api/shipping/tracking/${encodeURIComponent(trackingNumber)}`),
        updateTrackingLive: (trackingNumber, payload) => requestJson(`${API_BASE}/api/shipping/tracking/${encodeURIComponent(trackingNumber)}/live`, { method: 'PATCH', body: JSON.stringify(payload) }),
        createShipping: (payload) => requestJson(`${API_BASE}/api/shipping`, { method: 'POST', body: JSON.stringify(payload) }),
        updateShippingStatus: (trackingNumber, status) => requestJson(`${API_BASE}/api/shipping/${encodeURIComponent(trackingNumber)}/status/${encodeURIComponent(status)}`, { method: 'PATCH' }),
        getCart: () => requestJson(`${API_BASE}/api/cart`),
        syncCart: (items) => requestJson(`${API_BASE}/api/cart/sync`, { method: 'PUT', body: JSON.stringify(items) }),
        getGooglePayConfig: () => requestJson(`${API_BASE}/api/payments/google-pay/config`),
        authorizeGooglePayPayment: (payload) => requestJson(`${API_BASE}/api/payments/google-pay/authorize`, { method: 'POST', body: JSON.stringify(payload) }),
        validateCoupon: (code, subtotal) => requestJson(`${API_BASE}/api/coupons/${encodeURIComponent(code)}/validate?subtotal=${encodeURIComponent(subtotal)}`),
        getReceiptFromOrders: (orderNumbersCsv) => requestJson(`${API_BASE}/api/receipts/from-orders?orderNumbers=${encodeURIComponent(orderNumbersCsv)}`),
        sendReceiptEmail: (payload) => requestJson(`${API_BASE}/api/receipts/send-email`, { method: 'POST', body: JSON.stringify(payload) })
    };

    /*const FlashStockApi = {
        // PUERTO 8081: AUTH
        getCurrentUser: () => requestJson(`http://localhost:8081/api/auth/me`),
        getAdminMetrics: () => requestJson(`http://localhost:8081/api/admin/metrics`),

        // PUERTO 8082: INVENTORY
        listInventory: () => requestJson(`http://localhost:8082/api/inventory`),
        listInventoryRealtime: () => requestJson(`http://localhost:8082/api/inventory/realtime`),
        getInventoryBySku: (sku) => requestJson(`http://localhost:8082/api/inventory/${encodeURIComponent(sku)}`),
        createInventory: (payload) => requestJson(`http://localhost:8082/api/inventory`, { method: 'POST', body: JSON.stringify(payload) }),
        updateInventoryQuantity: (sku, quantity) => requestJson(`http://localhost:8082/api/inventory/${encodeURIComponent(sku)}/quantity/${quantity}`, { method: 'PATCH' }),

        // PUERTO 8083: ORDERS
        listOrders: () => requestJson(`http://localhost:8083/api/orders`),
        getOrderByNumber: (orderNumber) => requestJson(`http://localhost:8083/api/orders/${encodeURIComponent(orderNumber)}`),
        createOrder: (payload) => requestJson(`http://localhost:8083/api/orders`, { method: 'POST', body: JSON.stringify(payload) }),
        getMyOrderHistory: (status) => {
            const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
            return requestJson(`http://localhost:8083/api/orders/my-history${suffix}`);
        },
        getCustomerShipping: (status) => {
            const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
            return requestJson(`http://localhost:8083/api/orders/customer-shipping${suffix}`);
        },
        updateOrderStatus: (orderNumber, status) => requestJson(`http://localhost:8083/api/orders/${encodeURIComponent(orderNumber)}/status/${encodeURIComponent(status)}`, { method: 'PATCH' }),

        // PUERTO 8083: RECEIPTS
        getReceiptFromOrders: (orderNumbersCsv) => requestJson(`http://localhost:8083/api/receipts/from-orders?orderNumbers=${encodeURIComponent(orderNumbersCsv)}`),
        sendReceiptEmail: (payload) => requestJson(`http://localhost:8083/api/receipts/send-email`, { method: 'POST', body: JSON.stringify(payload) }),

        // PUERTO 8084: SHIPPING
        listShipping: () => requestJson(`http://localhost:8084/api/shipping`),
        getShippingByTracking: (trackingNumber) => requestJson(`http://localhost:8084/api/shipping/${encodeURIComponent(trackingNumber)}`),
        getShippingTracking: (trackingNumber) => requestJson(`http://localhost:8084/api/shipping/tracking/${encodeURIComponent(trackingNumber)}`),
        updateTrackingLive: (trackingNumber, payload) => requestJson(`http://localhost:8084/api/shipping/tracking/${encodeURIComponent(trackingNumber)}/live`, { method: 'PATCH', body: JSON.stringify(payload) }),
        createShipping: (payload) => requestJson(`http://localhost:8084/api/shipping`, { method: 'POST', body: JSON.stringify(payload) }),
        updateShippingStatus: (trackingNumber, status) => requestJson(`http://localhost:8084/api/shipping/${encodeURIComponent(trackingNumber)}/status/${encodeURIComponent(status)}`, { method: 'PATCH' }),

        // PUERTO 8084: MAPS
        getMapsConfig: () => requestJson(`http://localhost:8084/api/maps/config`),

        // PUERTO 8084: CART
        getCart: () => requestJson(`http://localhost:8084/api/cart`),
        syncCart: (items) => requestJson(`http://localhost:8084/api/cart/sync`, { method: 'PUT', body: JSON.stringify(items) }),

        // PUERTO 8084: PAYMENTS
        getGooglePayConfig: () => requestJson(`http://localhost:8084/api/payments/google-pay/config`),
        authorizeGooglePayPayment: (payload) => requestJson(`http://localhost:8084/api/payments/google-pay/authorize`, { method: 'POST', body: JSON.stringify(payload) }),

        // PUERTO 8084: COUPONS
        validateCoupon: (code, subtotal) => requestJson(`http://localhost:8084/api/coupons/${encodeURIComponent(code)}/validate?subtotal=${encodeURIComponent(subtotal)}`)
    };*/

    window.FlashStockApi = FlashStockApi;

    function getUserLink() {
        let userLink = document.getElementById('navbarUserLink');
        if (userLink) {
            return userLink;
        }

        userLink = document.querySelector('a[href="/static/login.html"], a[href="/login"], a[href="/"]');
        if (userLink && userLink.querySelector('i.fa-user, i.fa-user-check')) {
            userLink.id = 'navbarUserLink';
            return userLink;
        }

        return null;
    }

    function normalizeStatus(status) {
        return String(status || '').trim().toUpperCase();
    }

    function isShipmentInProgress(shipmentStatus, orderStatus) {
        const ship = normalizeStatus(shipmentStatus);
        const order = normalizeStatus(orderStatus);

        if (!ship && !order) {
            return false;
        }

        if (ship.includes('CANCEL') || ship.includes('COMPLET') || ship.includes('DELIVER')) {
            return false;
        }

        if (order.includes('CANCEL') || order.includes('COMPLET')) {
            return false;
        }

        return true;
    }

    function countActiveInTransitOrders(rows) {
        const list = Array.isArray(rows) ? rows : [];
        return list.filter((order) => isShipmentInProgress(order?.shipmentStatus, order?.orderStatus)).length;
    }

    function getCurrentPageName() {
        const path = window.location.pathname || '';
        return path.split('/').pop() || 'index.html';
    }

    function ensureOrderStatusNavbarLink() {
        const navContainer = document.querySelector('.navbar-nav');
        if (!navContainer) {
            return null;
        }

        let navLink = document.getElementById('navbarOrderStatusLink');
        if (!navLink) {
            navLink = navContainer.querySelector('a[href="order-status.html"], a[href="/order-status"], a[href="/order-status.html"]');
            if (navLink) {
                navLink.id = 'navbarOrderStatusLink';
            }
        }

        if (!navLink) {
            navLink = document.createElement('a');
            navLink.id = 'navbarOrderStatusLink';
            navLink.href = ORDER_STATUS_PAGE;
            navLink.className = 'nav-item nav-link';
            navLink.textContent = 'Estado Pedido';
            navContainer.appendChild(navLink);
        }

        const isCurrent = getCurrentPageName().toLowerCase() === ORDER_STATUS_PAGE;
        navLink.classList.toggle('active', isCurrent);
        return navLink;
    }

    function ensureOrderTrackingShortcut() {
        const userLink = getUserLink();
        if (!userLink) {
            return null;
        }

        let shortcut = document.getElementById('navbarOrderTrackingShortcut');
        if (!shortcut) {
            shortcut = document.createElement('a');
            shortcut.id = 'navbarOrderTrackingShortcut';
            shortcut.href = ORDER_STATUS_PAGE;
            shortcut.className = 'btn border border-secondary rounded-pill px-3 text-primary me-3 my-auto';
            shortcut.style.display = 'none';
            userLink.parentElement?.insertBefore(shortcut, userLink);
        }

        return shortcut;
    }

    function updateOrderTrackingShortcut(activeInTransitCount) {
        const shortcut = ensureOrderTrackingShortcut();
        if (!shortcut) {
            return;
        }

        const visible = isAuthenticatedUser() && Number(activeInTransitCount || 0) > 0;
        if (!visible) {
            shortcut.style.display = 'none';
            return;
        }

        shortcut.innerHTML = `<i class="fas fa-truck me-2"></i>Estado Pedido (${activeInTransitCount})`;
        shortcut.style.display = 'inline-flex';
    }

    async function refreshOrderStatusVisibility() {
        ensureOrderStatusNavbarLink();

        if (!isAuthenticatedUser()) {
            updateOrderTrackingShortcut(0);
            return;
        }

        if (isAdminSession()) {
            updateOrderTrackingShortcut(0);
            return;
        }

        try {
            const rows = await fetchOrdersForCurrentRole();
            updateOrderTrackingShortcut(countActiveInTransitOrders(rows));
        } catch (error) {
            updateOrderTrackingShortcut(0);
        }
    }

    async function maybeRedirectDeliveryToOrderStatus() {
        if (!isAuthenticatedUser()) {
            return false;
        }

        if (isAdminSession()) {
            return false;
        }

        const currentPage = getCurrentPageName().toLowerCase();
        if (currentPage !== 'delivery.html') {
            return false;
        }

        const params = new URLSearchParams(window.location.search || '');
        if (params.get('noRedirect') === '1') {
            return false;
        }

        try {
            const rows = await fetchOrdersForCurrentRole();
            const activeCount = countActiveInTransitOrders(rows);
            if (activeCount > 0) {
                window.location.href = `${ORDER_STATUS_PAGE}?from=delivery&active=${activeCount}`;
                return true;
            }
        } catch (error) {
            return false;
        }

        return false;
    }

    function isAuthenticatedUser() {
        return Boolean(currentSession && currentSession.authenticated);
    }

    function isAdminSession(session) {
        const source = session || currentSession;
        const hasAdminRole = Array.isArray(source?.authorities) && source.authorities.includes('ROLE_ADMIN');
        return Boolean(source?.admin) || hasAdminRole;
    }

    async function fetchOrdersForCurrentRole(status) {
        if (!isAuthenticatedUser()) {
            return [];
        }

        const response = isAdminSession()
            ? await FlashStockApi.getCustomerShipping(status)
            : await FlashStockApi.getMyOrderHistory(status);

        return Array.isArray(response?.data) ? response.data : [];
    }

    function ensureGlobalToast() {
        let toast = document.getElementById('flashstockGlobalToast');
        if (toast) {
            return toast;
        }

        toast = document.createElement('div');
        toast.id = 'flashstockGlobalToast';
        toast.style.position = 'fixed';
        toast.style.top = '18px';
        toast.style.right = '18px';
        toast.style.zIndex = '2000';
        toast.style.minWidth = '260px';
        toast.style.maxWidth = '420px';
        toast.style.padding = '12px 14px';
        toast.style.borderRadius = '12px';
        toast.style.boxShadow = '0 12px 30px rgba(0,0,0,0.18)';
        toast.style.display = 'none';
        toast.style.background = '#ffffff';
        toast.style.color = '#1f2937';
        toast.style.border = '2px solid #f0ad00';
        document.body.appendChild(toast);
        return toast;
    }

    function showToast(message, kind) {
        const toast = ensureGlobalToast();
        toast.textContent = message;

        if (kind === 'error') {
            toast.style.borderColor = '#dc3545';
            toast.style.color = '#8b1e2d';
        } else if (kind === 'success') {
            toast.style.borderColor = '#f0ad00';
            toast.style.color = '#6b4a00';
        } else {
            toast.style.borderColor = '#0d6efd';
            toast.style.color = '#0f365f';
        }

        toast.style.display = 'block';
        window.clearTimeout(toast._hideTimer);
        toast._hideTimer = window.setTimeout(() => {
            toast.style.display = 'none';
        }, 2600);
    }

    function setCardTexts($card, item) {
        const title = item.name || item.sku || 'SKU sin nombre';
        const subtitle = item.description || `Bodega: ${item.warehouse || 'N/A'}`;
        const stock = `$${Number(item.unitPrice || 0).toFixed(2)} | Stock: ${item.quantity ?? 0}`;

        const $titles = $card.find('h4, h5, h6');
        if ($titles.length > 0) {
            $titles.first().text(title);
        }

        const $texts = $card.find('p, small, span');
        if ($texts.length > 0) {
            $texts.first().text(subtitle);
        }

        const $priceTag = $card.find('.text-dark, .fw-bold').last();
        if ($priceTag.length > 0) {
            $priceTag.text(stock);
        }

        const $img = $card.find('img').first();
        if ($img.length > 0 && item.imageUrl) {
            $img.attr('src', item.imageUrl);
            $img.attr('alt', title);
        }

        $card.attr('data-sku', item.sku || '');
        $card.attr('data-id', item.id != null ? String(item.id) : '');

        const $button = $card.find('a.btn').first();
        if ($button.length > 0) {
            $button.attr('data-sku', item.sku || '');
            $button.attr('data-id', item.id != null ? String(item.id) : '');
        }
    }

    function buildCatalogCard(item) {
        const title = item.name || item.sku || 'Producto';
        const desc = (item.description || 'Producto disponible en FlashStock').substring(0, 120);
        const image = item.imageUrl || 'img/fruite-item-1.jpg';
        const category = item.category || 'Catalogo';
        const price = Number(item.unitPrice || 0).toFixed(2);
        const stock = Number(item.quantity || 0);
        const stockState = stock <= 0 ? 'Agotado' : (stock <= 5 ? 'Ultimas unidades' : 'En stock');
        const stockClass = stock <= 0 ? 'bg-danger' : (stock <= 5 ? 'bg-warning' : 'bg-success');
        const buttonDisabled = stock <= 0;
        return `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="rounded position-relative fruite-item" data-sku="${item.sku || ''}" data-id="${item.id != null ? item.id : ''}">
                    <div class="fruite-img">
                        <img src="${image}" class="img-fluid w-100 rounded-top" alt="${title}">
                    </div>
                    <div class="text-white bg-secondary px-3 py-1 rounded position-absolute" style="top: 10px; left: 10px;">${category}</div>
                    <div class="text-white ${stockClass} px-3 py-1 rounded position-absolute" style="top: 10px; right: 10px; font-size: 12px;">${stockState}</div>
                    <div class="p-4 border border-secondary border-top-0 rounded-bottom">
                        <h4>${title}</h4>
                        <p>${desc}</p>
                        <div class="d-flex justify-content-between flex-lg-wrap align-items-center gap-2">
                            <p class="text-dark fs-5 fw-bold mb-0">$${price}</p>
                            <a href="#" class="btn border border-secondary rounded-pill px-3 text-primary ${buttonDisabled ? 'disabled' : ''}" data-disabled="${buttonDisabled ? 'true' : 'false'}" data-sku="${item.sku || ''}" data-id="${item.id != null ? item.id : ''}" ${buttonDisabled ? 'aria-disabled="true" tabindex="-1"' : ''}><i class="fa fa-shopping-bag me-2 text-primary"></i>${buttonDisabled ? 'Sin stock' : 'Añadir al carrito'}</a>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function normalizeForMatch(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function mapCardToInventory(card, liveItems, fallbackIndex) {
        const sku = card.getAttribute('data-sku');
        if (sku) {
            const bySku = liveItems.find((item) => item?.sku === sku);
            if (bySku) {
                return bySku;
            }
        }

        const title = normalizeText(card.querySelector('h4, h5, h6')?.textContent);
        if (title) {
            const exact = liveItems.find((item) => normalizeText(item?.name) === title);
            if (exact) {
                return exact;
            }

            const includes = liveItems.find((item) => normalizeText(item?.name).includes(title) || title.includes(normalizeText(item?.name)));
            if (includes) {
                return includes;
            }
        }

        return liveItems[fallbackIndex] || null;
    }

    function hydrateAllStaticCards(liveItems) {
        const cards = Array.from(document.querySelectorAll('.fruite-item, .vesitable-item'));
        let fallbackIndex = 0;

        cards.forEach((card) => {
            const mapped = mapCardToInventory(card, liveItems, fallbackIndex);
            if (!mapped) {
                card.style.display = 'none';
                return;
            }

            fallbackIndex += 1;
            const quantity = Number(mapped.quantity || 0);
            if (mapped.active === false || quantity <= 0) {
                card.style.display = 'none';
                return;
            }

            card.style.display = '';
            setCardTexts($(card), mapped);

            const button = card.querySelector('a.btn');
            if (button) {
                button.classList.remove('disabled');
                button.setAttribute('data-disabled', 'false');
                button.removeAttribute('aria-disabled');
                button.removeAttribute('tabindex');
                if (!button.querySelector('i.fa-shopping-bag')) {
                    button.innerHTML = '<i class="fa fa-shopping-bag me-2 text-primary"></i>Añadir al carrito';
                }
            }
        });
    }

    function renderInventoryOnTemplate(items) {
        const primaryGrid = document.querySelector('#tab-1 .col-lg-12 .row.g-4');
        const shopGrid = document.querySelector('.col-lg-9 .row.g-4.justify-content-center');

        if (!Array.isArray(items) || items.length === 0) {
            const emptyHtml = '<div class="col-12"><div class="alert alert-warning mb-0">No hay productos disponibles en este momento.</div></div>';
            if (primaryGrid) {
                primaryGrid.innerHTML = emptyHtml;
            }
            if (shopGrid) {
                shopGrid.innerHTML = emptyHtml;
            }

            document.querySelectorAll('.fruite-item, .vesitable-item').forEach((card) => {
                card.style.display = 'none';
            });
            return;
        }

        const liveItems = items.filter((item) => item && item.active !== false && Number(item.quantity || 0) > 0);
        if (liveItems.length === 0) {
            const emptyHtml = '<div class="col-12"><div class="alert alert-warning mb-0">Sin stock disponible por ahora.</div></div>';
            if (primaryGrid) {
                primaryGrid.innerHTML = emptyHtml;
            }
            if (shopGrid) {
                shopGrid.innerHTML = emptyHtml;
            }
            return;
        }

        if (primaryGrid) {
            primaryGrid.innerHTML = liveItems.map(buildCatalogCard).join('');
        }

        if (shopGrid) {
            shopGrid.innerHTML = liveItems.map(buildCatalogCard).join('');
        }

        hydrateAllStaticCards(liveItems);
    }

    function parseSafeJson(text, fallback) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return fallback;
        }
    }

    function formatCurrency(value) {
        const amount = Number(value || 0);
        return `$${amount.toFixed(2)}`;
    }

    function loadCart() {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = parseSafeJson(raw, []);
        return Array.isArray(parsed) ? parsed : [];
    }

    function getShippingAddressFromStorage() {
        return localStorage.getItem(SHIPPING_ADDRESS_KEY) || '';
    }

    function setShippingAddressToStorage(value) {
        localStorage.setItem(SHIPPING_ADDRESS_KEY, String(value || '').trim());
    }

    function saveCart(items) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        updateCartBadge();
    }

    async function syncCartFromBackendIfAuthenticated() {
        if (!isAuthenticatedUser()) {
            return;
        }

        try {
            const response = await FlashStockApi.getCart();
            const serverItems = Array.isArray(response?.data) ? response.data : [];
            const local = serverItems.map((item) => ({
                id: item.inventoryId,
                sku: item.sku,
                name: item.productName || item.sku,
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unitPrice || 0),
                imageUrl: item.imageUrl || 'img/vegetable-item-2.jpg'
            })).filter((item) => item.quantity > 0);
            saveCart(local);
        } catch (error) {
            // Keep storefront available even if cart backend is temporarily unavailable.
        }
    }

    async function getBackendCartAsLocalModel() {
        const response = await FlashStockApi.getCart();
        const serverItems = Array.isArray(response?.data) ? response.data : [];
        return serverItems.map((item) => ({
            id: item.inventoryId,
            sku: item.sku,
            name: item.productName || item.sku,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            imageUrl: item.imageUrl || 'img/vegetable-item-2.jpg'
        })).filter((item) => item.quantity > 0);
    }

    async function pushCartToBackendIfAuthenticated() {
        if (!isAuthenticatedUser()) {
            return;
        }

        

        try {
            const payload = loadCart().map((item) => ({
                inventoryId: item.id,
                sku: item.sku,
                quantity: Number(item.quantity || 0)
            }));

            const response = await FlashStockApi.syncCart(payload);
            const serverItems = Array.isArray(response?.data) ? response.data : [];
            const local = serverItems.map((item) => ({
                id: item.inventoryId,
                sku: item.sku,
                name: item.productName || item.sku,
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unitPrice || 0),
                imageUrl: item.imageUrl || 'img/vegetable-item-2.jpg'
            })).filter((item) => item.quantity > 0);
            saveCart(local);
        } catch (error) {
            showToast('No se pudo sincronizar el carrito con tu cuenta.', 'error');
        }
    }

    function getCartBadgeElement() {
        const icon = document.querySelector('i.fa-shopping-bag');
        if (!icon) {
            return null;
        }

        return icon.parentElement?.querySelector('span') || null;
    }

    function updateCartBadge() {
        const badge = getCartBadgeElement();
        if (!badge) {
            return;
        }

        const units = loadCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        badge.textContent = String(units);
    }

    function showCartMessage(message, isError) {
        const result = document.getElementById('cartApiResult') || document.getElementById('checkoutApiResult');
        if (!result) {
            showToast(message, isError ? 'error' : 'success');
            return;
        }

        result.textContent = message;
        result.classList.toggle('text-danger', Boolean(isError));
        result.classList.toggle('text-muted', !isError);
        showToast(message, isError ? 'error' : 'success');
    }

    function getInventoryMap(items) {
        const map = new Map();
        (items || []).forEach((item) => {
            if (item?.sku) {
                map.set(item.sku, item);
            }
        });
        return map;
    }

    function normalizeCart(inventoryItems) {
        const inventoryMap = getInventoryMap(inventoryItems);
        const cart = loadCart();
        const normalized = [];

        cart.forEach((item) => {
            const sku = item?.sku;
            if (!sku || !inventoryMap.has(sku)) {
                return;
            }

            const inventory = inventoryMap.get(sku);
            const stock = Number(inventory.quantity || 0);
            if (inventory.active === false || stock <= 0) {
                return;
            }

            const requestedQty = Number(item.quantity || 1);
            const quantity = Math.max(1, Math.min(requestedQty, stock));

            normalized.push({
                id: inventory.id,
                sku,
                quantity,
                name: inventory.name || item.name || sku,
                unitPrice: Number(inventory.unitPrice || item.unitPrice || 0),
                imageUrl: inventory.imageUrl || item.imageUrl || 'img/vegetable-item-2.jpg'
            });
        });

        saveCart(normalized);
        return normalized;
    }

    function upsertCartItem(item) {
        if (!item?.sku && !item?.id) {
            return { success: false, message: 'Producto invalido para carrito.' };
        }

        const inventory = inventoryCache.find((candidate) => {
            if (item.id != null && candidate?.id != null) {
                return Number(candidate.id) === Number(item.id);
            }
            return candidate?.sku === item.sku;
        });
        const stock = Number(inventory?.quantity || 0);
        if (stock <= 0) {
            return { success: false, message: `Sin stock disponible para ${item.name || item.sku}.` };
        }

        const requestedQty = Math.max(0, Number(item.quantity || 0));
        if (requestedQty <= 0) {
            return { success: false, message: 'La cantidad debe ser mayor que 0.' };
        }

        const cart = loadCart();
        const index = cart.findIndex((cartItem) => {
            if (item.id != null && cartItem?.id != null) {
                return Number(cartItem.id) === Number(item.id);
            }
            return cartItem.sku === item.sku;
        });
        let finalQty = requestedQty;

        if (index >= 0) {
            const mergedQty = Number(cart[index].quantity || 0) + requestedQty;
            finalQty = Math.min(mergedQty, stock);
            cart[index].id = inventory?.id || item.id || cart[index].id;
            cart[index].sku = inventory?.sku || item.sku || cart[index].sku;
            cart[index].quantity = finalQty;
            cart[index].name = item.name || cart[index].name;
            cart[index].unitPrice = Number(item.unitPrice || cart[index].unitPrice || 0);
            cart[index].imageUrl = item.imageUrl || cart[index].imageUrl;
        } else {
            finalQty = Math.min(requestedQty, stock);
            cart.push({
                id: inventory?.id || item.id,
                sku: inventory?.sku || item.sku,
                name: item.name || inventory?.name || item.sku,
                quantity: finalQty,
                unitPrice: Number(item.unitPrice || 0),
                imageUrl: item.imageUrl || 'img/vegetable-item-2.jpg'
            });
        }

        saveCart(cart);
        pushCartToBackendIfAuthenticated();
        return {
            success: true,
            limited: finalQty < requestedQty,
            finalQty,
            message: finalQty < requestedQty
                ? `Se agrego stock disponible (${finalQty}) para ${item.name || item.sku}.`
                : `Producto agregado: ${item.name || item.sku}`
        };
    }

    function resolveCatalogItemFromCard(cardElement) {
        const card = cardElement.closest('.fruite-item, .vesitable-item');
        if (!card) {
            return null;
        }

        const title = card.querySelector('h4, h5, h6')?.textContent?.trim() || '';
        const idFromButton = cardElement.getAttribute('data-id');
        const skuFromButton = cardElement.getAttribute('data-sku');
        const idFromCard = card.getAttribute('data-id');
        const skuFromCard = card.getAttribute('data-sku');

        let fromApi = null;

        const idCandidate = idFromButton || idFromCard;
        if (idCandidate) {
            fromApi = inventoryCache.find((item) => Number(item?.id) === Number(idCandidate)) || null;
        }

        if (!fromApi) {
            const skuCandidate = skuFromButton || skuFromCard;
            if (skuCandidate) {
                fromApi = inventoryCache.find((item) => item?.sku === skuCandidate) || null;
            }
        }

        if (!fromApi && title) {
            const normalizedTitle = normalizeForMatch(title);
            fromApi = inventoryCache.find((item) => normalizeForMatch(item?.name) === normalizedTitle)
                || inventoryCache.find((item) => normalizeForMatch(item?.name).includes(normalizedTitle) || normalizedTitle.includes(normalizeForMatch(item?.name)));
        }

        if (!fromApi) {
            const cardsInSameGrid = Array.from((card.parentElement?.parentElement || document).querySelectorAll('.fruite-item, .vesitable-item'));
            const currentCardIndex = cardsInSameGrid.indexOf(card);
            if (currentCardIndex >= 0) {
                const liveItems = inventoryCache.filter((item) => item && item.active !== false && Number(item.quantity || 0) > 0);
                fromApi = liveItems[currentCardIndex] || null;
            }
        }

        if (!fromApi) {
            return null;
        }

        const sku = fromApi.sku;
        const imageUrl = card.querySelector('img')?.getAttribute('src') || fromApi.imageUrl || 'img/vegetable-item-2.jpg';
        const unitPrice = Number(fromApi.unitPrice || 0);

        return {
            id: fromApi.id,
            sku,
            name: fromApi.name || title,
            description: fromApi.description || '',
            availableQuantity: Number(fromApi.quantity || 0),
            quantity: 1,
            unitPrice,
            imageUrl
        };
    }

    function ensureAddToCartModal() {
        let modal = document.getElementById('addToCartModal');
        if (modal) {
            return modal;
        }

        const style = document.createElement('style');
        style.id = 'addToCartModalStyles';
        style.textContent = `
            .fs-modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.45);
                z-index: 1200;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            .fs-modal-panel {
                width: min(720px, 100%);
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.2);
                padding: 20px;
            }
            .fs-qty-btn {
                border: 1px solid #d6d6d6;
                background: #fff;
                width: 40px;
                height: 40px;
                border-radius: 999px;
                font-size: 20px;
                line-height: 1;
            }
            .fs-qty-value {
                min-width: 52px;
                text-align: center;
                font-weight: 700;
                font-size: 20px;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'addToCartModal';
        modal.className = 'fs-modal-backdrop';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="fs-modal-panel" role="dialog" aria-modal="true" aria-labelledby="addToCartTitle">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h4 id="addToCartTitle" class="mb-0">Añadir al carrito</h4>
                    <button type="button" id="addToCartClose" class="btn-close" aria-label="Close"></button>
                </div>
                <div class="row g-4 align-items-start">
                    <div class="col-md-5">
                        <img id="addToCartImage" src="img/vegetable-item-2.jpg" class="img-fluid rounded" alt="Producto">
                    </div>
                    <div class="col-md-7">
                        <h5 id="addToCartName" class="mb-2"></h5>
                        <p id="addToCartDescription" class="text-muted small mb-2"></p>
                        <p class="mb-1"><strong>Precio:</strong> <span id="addToCartPrice"></span></p>
                        <p class="mb-3"><strong>Disponible:</strong> <span id="addToCartStock"></span></p>
                        <div class="d-flex align-items-center gap-3 mb-3">
                            <span class="small text-muted">Cantidad</span>
                            <button type="button" id="addToCartMinus" class="fs-qty-btn">-</button>
                            <span id="addToCartQty" class="fs-qty-value">1</span>
                            <button type="button" id="addToCartPlus" class="fs-qty-btn">+</button>
                        </div>
                        <div id="addToCartHint" class="small text-danger mb-3" style="min-height: 20px;"></div>
                        <div class="d-flex justify-content-end gap-2">
                            <button type="button" id="addToCartCancel" class="btn" style="background:#fff;border:2px solid #dc3545;color:#dc3545;">Cancelar</button>
                            <button type="button" id="addToCartConfirm" class="btn" style="background:#fff;border:2px solid #f0ad00;color:#f0ad00;">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    function closeAddToCartModal() {
        const modal = document.getElementById('addToCartModal');
        if (!modal) {
            return;
        }
        modal.style.display = 'none';
        pendingAddItem = null;
    }

    function setPendingQuantity(nextQty) {
        if (!pendingAddItem) {
            return;
        }

        const stock = Number(pendingAddItem.availableQuantity || 0);
        const bounded = Math.max(0, Math.min(Number(nextQty || 0), stock));
        pendingAddItem.selectedQuantity = bounded;

        const qtyElement = document.getElementById('addToCartQty');
        const hintElement = document.getElementById('addToCartHint');
        const confirmButton = document.getElementById('addToCartConfirm');
        if (qtyElement) {
            qtyElement.textContent = String(bounded);
        }

        if (hintElement) {
            hintElement.textContent = bounded <= 0
                ? 'Debes seleccionar una cantidad mayor a 0.'
                : '';
        }

        if (confirmButton) {
            confirmButton.disabled = bounded <= 0;
            confirmButton.style.opacity = bounded <= 0 ? '0.55' : '1';
            confirmButton.style.cursor = bounded <= 0 ? 'not-allowed' : 'pointer';
        }
    }

    function openAddToCartModal(item) {
        const modal = ensureAddToCartModal();
        pendingAddItem = {
            ...item,
            selectedQuantity: item.availableQuantity > 0 ? 1 : 0
        };

        const image = document.getElementById('addToCartImage');
        const name = document.getElementById('addToCartName');
        const description = document.getElementById('addToCartDescription');
        const price = document.getElementById('addToCartPrice');
        const stock = document.getElementById('addToCartStock');

        if (image) {
            image.src = item.imageUrl || 'img/vegetable-item-2.jpg';
            image.alt = item.name || item.sku;
        }
        if (name) {
            name.textContent = item.name || item.sku;
        }
        if (description) {
            description.textContent = item.description || 'Producto disponible para despacho inmediato.';
        }
        if (price) {
            price.textContent = formatCurrency(item.unitPrice);
        }
        if (stock) {
            stock.textContent = String(item.availableQuantity || 0);
        }

        setPendingQuantity(pendingAddItem.selectedQuantity);
        modal.style.display = 'flex';
    }

    function bindAddToCartModalActions() {
        const modal = ensureAddToCartModal();
        if (modal.dataset.bound === 'true') {
            return;
        }
        modal.dataset.bound = 'true';

        document.getElementById('addToCartClose')?.addEventListener('click', closeAddToCartModal);
        document.getElementById('addToCartCancel')?.addEventListener('click', closeAddToCartModal);

        document.getElementById('addToCartMinus')?.addEventListener('click', () => {
            setPendingQuantity((pendingAddItem?.selectedQuantity || 0) - 1);
        });

        document.getElementById('addToCartPlus')?.addEventListener('click', () => {
            setPendingQuantity((pendingAddItem?.selectedQuantity || 0) + 1);
        });

        document.getElementById('addToCartConfirm')?.addEventListener('click', () => {
            if (!pendingAddItem) {
                return;
            }

            const result = upsertCartItem({
                id: pendingAddItem.id,
                sku: pendingAddItem.sku,
                name: pendingAddItem.name,
                imageUrl: pendingAddItem.imageUrl,
                unitPrice: pendingAddItem.unitPrice,
                quantity: pendingAddItem.selectedQuantity
            });

            if (!result.success) {
                setPendingQuantity(0);
                const hintElement = document.getElementById('addToCartHint');
                if (hintElement) {
                    hintElement.textContent = result.message;
                }
                return;
            }

            showCartMessage(result.message, false);
            closeAddToCartModal();
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeAddToCartModal();
            }
        });
    }

    function bindAddToCartActions() {
        bindAddToCartModalActions();

        document.addEventListener('click', async (event) => {
            const target = event.target.closest('a.btn');
            if (!target) {
                return;
            }

            if (target.getAttribute('data-disabled') === 'true' || target.classList.contains('disabled')) {
                event.preventDefault();
                showToast('Producto agotado por el momento.', 'error');
                return;
            }

            const hasBagIcon = target.querySelector('i.fa-shopping-bag');
            if (!hasBagIcon) {
                return;
            }

            let item = resolveCatalogItemFromCard(target);
            if (!item) {
                await refreshStorefrontInventory();
                item = resolveCatalogItemFromCard(target);
            }
            if (!item) {
                showToast('No se pudo identificar el producto. Recarga la pagina e intenta nuevamente.', 'error');
                return;
            }

            event.preventDefault();
            openAddToCartModal(item);
        });
    }

    function calculateCartTotals(cart) {
        const subtotal = cart.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
        const shipping = cart.length > 0 ? 3 : 0;
        const discount = checkoutCouponState?.valid ? Number(checkoutCouponState.discountAmount || 0) : 0;
        const gross = subtotal + shipping;
        return {
            subtotal,
            shipping,
            discount,
            total: Math.max(gross - discount, 0)
        };
    }

    function renderCartTable(cart) {
        const body = document.getElementById('cartItemsBody');
        if (!body) {
            return;
        }

        if (!Array.isArray(cart) || cart.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center py-4">Tu carrito esta vacio.</td></tr>';
        } else {
            body.innerHTML = cart.map((item) => {
                const rowTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
                return `
                    <tr data-sku="${item.sku}">
                        <th scope="row">
                            <div class="d-flex align-items-center">
                                <img src="${item.imageUrl || 'img/vegetable-item-2.jpg'}" class="img-fluid me-5 rounded-circle" style="width: 80px; height: 80px;" alt="${item.name}">
                            </div>
                        </th>
                        <td><p class="mb-0 mt-4">${item.name}</p><small class="text-muted">${item.sku}</small></td>
                        <td><p class="mb-0 mt-4">${formatCurrency(item.unitPrice)}</p></td>
                        <td>
                            <div class="input-group quantity mt-4" style="width: 120px;">
                                <button class="btn btn-sm btn-minus rounded-circle bg-light border" type="button" data-action="minus"><i class="fa fa-minus"></i></button>
                                <input type="number" class="form-control form-control-sm text-center border-0" min="1" value="${item.quantity}" data-action="qty-input">
                                <button class="btn btn-sm btn-plus rounded-circle bg-light border" type="button" data-action="plus"><i class="fa fa-plus"></i></button>
                            </div>
                        </td>
                        <td><p class="mb-0 mt-4">${formatCurrency(rowTotal)}</p></td>
                        <td>
                            <button class="btn btn-md rounded-circle bg-light border mt-4" type="button" data-action="remove">
                                <i class="fa fa-times text-danger"></i>
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        }

        const totals = calculateCartTotals(cart);
        const subtotalElement = document.getElementById('cartSubtotal');
        const totalElement = document.getElementById('cartTotal');
        if (subtotalElement) {
            subtotalElement.textContent = formatCurrency(totals.subtotal);
        }
        if (totalElement) {
            totalElement.textContent = formatCurrency(totals.total);
        }
    }

    function changeCartQuantity(sku, delta, inventoryMap) {
        const cart = loadCart();
        const index = cart.findIndex((item) => item.sku === sku);
        if (index < 0) {
            return;
        }

        const stockFromInventory = Number(inventoryMap.get(sku)?.quantity || 0);
        const currentQty = Number(cart[index].quantity || 1);
        const editableStock = stockFromInventory > 0 ? stockFromInventory : (isAuthenticatedUser() ? currentQty : 0);

        if (editableStock <= 0) {
            cart.splice(index, 1);
            saveCart(cart);
            return;
        }

        const nextQty = Math.max(1, currentQty + delta);
        cart[index].quantity = Math.min(nextQty, editableStock);
        saveCart(cart);
        pushCartToBackendIfAuthenticated();
    }

    function setCartQuantity(sku, quantity, inventoryMap) {
        const cart = loadCart();
        const index = cart.findIndex((item) => item.sku === sku);
        if (index < 0) {
            return;
        }

        const stockFromInventory = Number(inventoryMap.get(sku)?.quantity || 0);
        const currentQty = Number(cart[index].quantity || 1);
        const editableStock = stockFromInventory > 0 ? stockFromInventory : (isAuthenticatedUser() ? currentQty : 0);

        if (editableStock <= 0) {
            cart.splice(index, 1);
            saveCart(cart);
            return;
        }

        const normalized = Math.max(1, Math.min(Number(quantity || 1), editableStock));
        cart[index].quantity = normalized;
        saveCart(cart);
        pushCartToBackendIfAuthenticated();
    }

    function removeCartItem(sku) {
        const cart = loadCart().filter((item) => item.sku !== sku);
        saveCart(cart);
        pushCartToBackendIfAuthenticated();
    }

    async function refreshCartRealtime() {
        let cart;
        let inventoryMap = new Map();

        if (isAuthenticatedUser()) {
            cart = await getBackendCartAsLocalModel();
            saveCart(cart);

            const inventoryResp = await FlashStockApi.listInventory();
            const inventoryItems = inventoryResp?.data || [];
            inventoryMap = getInventoryMap(inventoryItems);
        } else {
            const inventoryResp = await FlashStockApi.listInventory();
            const inventoryItems = inventoryResp?.data || [];
            cart = normalizeCart(inventoryItems);
            inventoryMap = getInventoryMap(inventoryItems);
        }

        renderCartTable(cart);
        bindCartTableActions(inventoryMap);
    }

    function bindCartTableActions(inventoryMap) {
        const body = document.getElementById('cartItemsBody');
        if (!body || body.dataset.bound === 'true') {
            return;
        }

        body.dataset.bound = 'true';
        body.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) {
                return;
            }

            const row = button.closest('tr[data-sku]');
            const sku = row?.getAttribute('data-sku');
            if (!sku) {
                return;
            }

            const action = button.getAttribute('data-action');
            if (action === 'minus') {
                changeCartQuantity(sku, -1, inventoryMap);
            } else if (action === 'plus') {
                changeCartQuantity(sku, 1, inventoryMap);
            } else if (action === 'remove') {
                removeCartItem(sku);
            }

            refreshCartRealtime().catch(() => showCartMessage('No se pudo refrescar el carrito.', true));
        });

        body.addEventListener('change', (event) => {
            const input = event.target.closest('input[data-action="qty-input"]');
            if (!input) {
                return;
            }

            const row = input.closest('tr[data-sku]');
            const sku = row?.getAttribute('data-sku');
            if (!sku) {
                return;
            }

            setCartQuantity(sku, Number(input.value || 1), inventoryMap);
            refreshCartRealtime().catch(() => showCartMessage('No se pudo refrescar el carrito.', true));
        });
    }

    async function initCartPage() {
        const proceedBtn = document.getElementById('btnProceedCheckout');
        if (!proceedBtn) {
            return;
        }

        await refreshCartRealtime();

        const shippingInput = document.getElementById('cartShippingAddress');
        if (shippingInput) {
            shippingInput.value = getShippingAddressFromStorage();
            shippingInput.addEventListener('input', () => {
                setShippingAddressToStorage(shippingInput.value);
            });
        }

        proceedBtn.addEventListener('click', () => {
            const items = loadCart();
            if (items.length === 0) {
                showCartMessage('Tu carrito esta vacio.', true);
                return;
            }

            if (shippingInput && !String(shippingInput.value || '').trim()) {
                showCartMessage('Debes ingresar una direccion de envio.', true);
                return;
            }

            if (shippingInput) {
                setShippingAddressToStorage(shippingInput.value);
            }

            showCartMessage(`Carrito validado con ${items.length} producto(s). Redirigiendo a checkout...`);
            setTimeout(() => {
                window.location.href = 'chackout.html';
            }, 500);
        });

        window.setInterval(() => {
            refreshCartRealtime().catch(() => {
                showCartMessage('No se pudo sincronizar stock en tiempo real.', true);
            });
        }, CART_REFRESH_MS);
    }

    function getCheckoutCarrier() {
        const select = document.getElementById('shippingCarrier');
        return select?.value || 'DHL';
    }

    function getCheckoutCustomerData() {
        const firstName = document.getElementById('checkoutFirstName')?.value?.trim() || '';
        const lastName = document.getElementById('checkoutLastName')?.value?.trim() || '';
        const email = document.getElementById('checkoutEmail')?.value?.trim() || (currentSession?.email || '');
        const shippingAddress = document.getElementById('checkoutAddress')?.value?.trim() || getShippingAddressFromStorage();
        return { firstName, lastName, email, shippingAddress };
    }

    function validateCheckoutCustomer(customer) {
        if (!customer.firstName) {
            throw new Error('Ingresa el nombre del cliente.');
        }
        if (!customer.lastName) {
            throw new Error('Ingresa el apellido del cliente.');
        }
        if (!customer.email) {
            throw new Error('Ingresa el correo del cliente.');
        }
        if (!customer.shippingAddress) {
            throw new Error('Ingresa la direccion de envio.');
        }
    }

    function isValidReceiptPayload(receipt) {
        if (!receipt || typeof receipt !== 'object') {
            return false;
        }

        const hasHeader = Boolean(receipt.receiptNumber || receipt.createdAt || receipt.customerEmail);
        const hasItems = Array.isArray(receipt.items) && receipt.items.length > 0;
        const hasShipments = Array.isArray(receipt.shipments) && receipt.shipments.length > 0;

        return hasHeader || hasItems || hasShipments;
    }

    function saveReceipt(receipt) {
        if (!isValidReceiptPayload(receipt)) {
            return;
        }

        const serialized = JSON.stringify(receipt);
        localStorage.setItem(RECEIPT_STORAGE_KEY, serialized);
        sessionStorage.setItem(RECEIPT_SESSION_KEY, serialized);
    }

    function loadReceipt() {
        const localRaw = localStorage.getItem(RECEIPT_STORAGE_KEY);
        const localReceipt = localRaw ? parseSafeJson(localRaw, null) : null;
        if (isValidReceiptPayload(localReceipt)) {
            return localReceipt;
        }

        const sessionRaw = sessionStorage.getItem(RECEIPT_SESSION_KEY);
        const sessionReceipt = sessionRaw ? parseSafeJson(sessionRaw, null) : null;
        if (isValidReceiptPayload(sessionReceipt)) {
            localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(sessionReceipt));
            return sessionReceipt;
        }

        return null;
    }

    function generateReceiptNumber() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `BOL-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
    }

    function buildReceiptPayload(items, shipments, customer) {
        const totals = calculateCartTotals(items);
        return {
            receiptNumber: generateReceiptNumber(),
            createdAt: new Date().toISOString(),
            customerFirstName: customer.firstName,
            customerLastName: customer.lastName,
            customerEmail: customer.email,
            shippingAddress: customer.shippingAddress,
            subtotal: Number(totals.subtotal || 0),
            shipping: Number(totals.shipping || 0),
            discount: Number(totals.discount || 0),
            total: Number(totals.total || 0),
            items: (items || []).map((item) => ({
                inventoryId: item.id,
                sku: item.sku,
                productName: item.name,
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unitPrice || 0),
                lineTotal: Number(item.quantity || 0) * Number(item.unitPrice || 0),
                orderNumber: item.orderNumber || ''
            })),
            shipments: shipments || []
        };
    }

    function renderCheckoutSummaryTable(items) {
        const body = document.getElementById('checkoutItemsBody');
        if (!body) {
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay productos en el carrito.</td></tr>';
            return;
        }

        const detailRows = items.map((item) => {
            const rowTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
            return `
                <tr>
                    <th scope="row">
                        <div class="d-flex align-items-center mt-2">
                            <img src="${item.imageUrl || 'img/vegetable-item-2.jpg'}" class="img-fluid rounded-circle" style="width: 90px; height: 90px;" alt="${item.name}">
                        </div>
                    </th>
                    <td class="py-5">${item.name}</td>
                    <td class="py-5">${formatCurrency(item.unitPrice)}</td>
                    <td class="py-5">${item.quantity}</td>
                    <td class="py-5">${formatCurrency(rowTotal)}</td>
                </tr>`;
        }).join('');

        const totals = calculateCartTotals(items);
        const summaryRows = `
            <tr>
                <th scope="row"></th>
                <td class="py-5"></td>
                <td class="py-5"></td>
                <td class="py-5"><p class="mb-0 text-dark py-3">Subtotal</p></td>
                <td class="py-5"><div class="py-3 border-bottom border-top"><p class="mb-0 text-dark" id="checkoutSubtotal">${formatCurrency(totals.subtotal)}</p></div></td>
            </tr>
            <tr>
                <th scope="row"></th>
                <td class="py-5"><p class="mb-0 text-dark py-4">Envio</p></td>
                <td colspan="3" class="py-5"><p class="mb-0">Tarifa plana: ${formatCurrency(totals.shipping)}</p></td>
            </tr>
            <tr>
                <th scope="row"></th>
                <td class="py-5"><p class="mb-0 text-dark py-4">Descuento</p></td>
                <td colspan="3" class="py-5"><p class="mb-0" id="checkoutDiscount">-${formatCurrency(totals.discount)}</p></td>
            </tr>
            <tr>
                <th scope="row"></th>
                <td class="py-5"><p class="mb-0 text-dark text-uppercase py-3">TOTAL</p></td>
                <td class="py-5"></td>
                <td class="py-5"></td>
                <td class="py-5"><div class="py-3 border-bottom border-top"><p class="mb-0 text-dark" id="checkoutTotal">${formatCurrency(totals.total)}</p></div></td>
            </tr>`;

        body.innerHTML = detailRows + summaryRows;
    }

    async function syncCheckoutSummary() {
        let cart;

        if (isAuthenticatedUser()) {
            cart = await getBackendCartAsLocalModel();
            saveCart(cart);
        } else {
            const inventoryResp = await FlashStockApi.listInventory();
            const inventoryItems = inventoryResp?.data || [];
            cart = normalizeCart(inventoryItems);
        }

        renderCheckoutSummaryTable(cart);
    }

    async function applyCouponOnCheckout() {
        const codeInput = document.getElementById('checkoutCouponCode');
        const statusLabel = document.getElementById('checkoutCouponStatus');
        const code = codeInput?.value?.trim() || '';
        const cart = loadCart();
        const subtotal = cart.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);

        if (!code) {
            checkoutCouponState = { code: null, discountAmount: 0, finalTotal: 0, valid: false };
            await syncCheckoutSummary();
            if (statusLabel) {
                statusLabel.textContent = 'Ingresa un cupón para aplicar descuento.';
            }
            return;
        }

        const response = await FlashStockApi.validateCoupon(code, subtotal);
        const validation = response?.data;
        checkoutCouponState = {
            code: validation?.code || code,
            discountAmount: Number(validation?.discountAmount || 0),
            finalTotal: Number(validation?.finalTotal || 0),
            valid: Boolean(validation?.valid)
        };

        await syncCheckoutSummary();
        if (statusLabel) {
            statusLabel.textContent = validation?.reason || 'Validacion de cupon completada.';
            statusLabel.classList.toggle('text-danger', !validation?.valid);
            statusLabel.classList.toggle('text-success', Boolean(validation?.valid));
        }
    }

    function resetCheckoutPaymentState() {
        checkoutPaymentState = {
            guestPaymentApproved: false,
            transactionReference: null,
            paymentData: null
        };
    }

    function getCheckoutGooglePayStatusElement() {
        return document.getElementById('googlePayStatus');
    }

    function setCheckoutGooglePayStatus(message, kind) {
        const status = getCheckoutGooglePayStatusElement();
        if (!status) {
            return;
        }

        status.textContent = message || '';
        status.classList.remove('text-danger', 'text-success', 'text-muted');
        if (kind === 'error') {
            status.classList.add('text-danger');
        } else if (kind === 'success') {
            status.classList.add('text-success');
        } else {
            status.classList.add('text-muted');
        }
    }

    function renderGooglePayCheckoutMeta(isAuthenticated) {
        const section = document.getElementById('googlePayCheckoutSection');
        const title = document.getElementById('googlePayCheckoutTitle');
        const amount = document.getElementById('googlePayCheckoutAmount');
        if (!section || !title || !amount) {
            return;
        }

        const totals = calculateCartTotals(loadCart());
        section.style.display = 'block';
        title.textContent = isAuthenticated
            ? 'Pagar y finalizar compra con Google Pay (usuario logueado).'
            : 'Compra como invitado: completa el pago con Google Pay (modo prueba).';
        amount.textContent = `Total a pagar: ${formatCurrency(totals.total)}`;
    }

    async function ensureGooglePayScriptLoaded() {
        if (window.google?.payments?.api?.PaymentsClient) {
            return;
        }

        if (googlePayScriptLoader) {
            await googlePayScriptLoader;
            return;
        }

        googlePayScriptLoader = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src="https://pay.google.com/gp/p/js/pay.js"]');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Pay SDK.')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://pay.google.com/gp/p/js/pay.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar Google Pay SDK.'));
            document.head.appendChild(script);
        });

        await googlePayScriptLoader;
    }

    async function getGooglePayCheckoutConfig() {
        if (googlePayConfigCache) {
            return googlePayConfigCache;
        }

        const response = await FlashStockApi.getGooglePayConfig();
        googlePayConfigCache = response?.data || null;
        if (!googlePayConfigCache) {
            throw new Error('No se pudo obtener configuracion de Google Pay.');
        }

        return googlePayConfigCache;
    }

    function buildGooglePayCardPaymentMethod(config) {
        return {
            type: 'CARD',
            parameters: {
                allowedAuthMethods: config.allowedAuthMethods || ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                allowedCardNetworks: config.allowedCardNetworks || ['VISA', 'MASTERCARD'],
                billingAddressRequired: true,
                billingAddressParameters: {
                    format: 'FULL'
                }
            },
            tokenizationSpecification: {
                type: 'PAYMENT_GATEWAY',
                parameters: {
                    gateway: config.gateway || 'example',
                    gatewayMerchantId: config.gatewayMerchantId || 'exampleGatewayMerchantId'
                }
            }
        };
    }

    function buildGooglePayPaymentRequest(config) {
        const cart = loadCart();
        const totals = calculateCartTotals(cart);
        const totalPrice = Number(totals.total || 0).toFixed(2);

        return {
            apiVersion: 2,
            apiVersionMinor: 0,
            merchantInfo: {
                merchantId: config.merchantId || '12345678901234567890',
                merchantName: config.merchantName || 'FlashStock'
            },
            allowedPaymentMethods: [buildGooglePayCardPaymentMethod(config)],
            transactionInfo: {
                totalPriceStatus: 'FINAL',
                totalPrice,
                currencyCode: config.currencyCode || 'CLP',
                countryCode: config.countryCode || 'CL'
            },
            emailRequired: true
        };
    }

    async function ensureGooglePayClient() {
        await ensureGooglePayScriptLoaded();
        const config = await getGooglePayCheckoutConfig();

        if (!googlePayClient) {
            googlePayClient = new google.payments.api.PaymentsClient({
                environment: (config.environment || 'TEST').toUpperCase()
            });
        }

        return { client: googlePayClient, config };
    }

    async function processCheckoutWithGooglePay() {
        const customer = getCheckoutCustomerData();
        validateCheckoutCustomer(customer);

        const cart = loadCart();
        if (!Array.isArray(cart) || cart.length === 0) {
            throw new Error('No hay productos en el carrito.');
        }

        const { client, config } = await ensureGooglePayClient();
        const request = buildGooglePayPaymentRequest(config);
        const paymentData = await client.loadPaymentData(request);

        const token = paymentData?.paymentMethodData?.tokenizationData?.token;
        const info = paymentData?.paymentMethodData?.info || {};
        if (!token) {
            throw new Error('Google Pay no entrego token de pago.');
        }

        const totals = calculateCartTotals(cart);
        const authResp = await FlashStockApi.authorizeGooglePayPayment({
            paymentDataToken: token,
            cardNetwork: info.cardNetwork || '',
            cardDetails: info.cardDetails || '',
            totalPrice: Number(totals.total || 0).toFixed(2),
            currencyCode: config.currencyCode || 'CLP'
        });

        const auth = authResp?.data;
        if (!auth?.approved) {
            throw new Error(auth?.message || 'Google Pay no aprobo el pago.');
        }

        checkoutPaymentState.guestPaymentApproved = true;
        checkoutPaymentState.transactionReference = auth.transactionReference || null;
        checkoutPaymentState.paymentData = paymentData;
        setCheckoutGooglePayStatus(`Pago aprobado (${checkoutPaymentState.transactionReference || 'OK'}). Procesando pedido...`, 'success');
    }

    async function renderGooglePayButtonForCheckout(isAuthenticated) {
        const section = document.getElementById('googlePayCheckoutSection');
        const container = document.getElementById('googlePayButtonContainer');
        if (!section || !container) {
            return;
        }

        renderGooglePayCheckoutMeta(isAuthenticated);
        container.innerHTML = '';
        setCheckoutGooglePayStatus('Preparando Google Pay...', 'neutral');

        try {
            const { client, config } = await ensureGooglePayClient();
            const isReadyRequest = {
                apiVersion: 2,
                apiVersionMinor: 0,
                allowedPaymentMethods: [buildGooglePayCardPaymentMethod(config)]
            };
            const ready = await client.isReadyToPay(isReadyRequest);

            if (!ready?.result) {
                setCheckoutGooglePayStatus('Google Pay no esta disponible en este navegador/dispositivo.', 'error');
                return;
            }

            const button = client.createButton({
                buttonColor: 'default',
                buttonType: 'buy',
                buttonRadius: 6,
                buttonBorderType: 'default_border',
                allowedPaymentMethods: isReadyRequest.allowedPaymentMethods,
                onClick: async () => {
                    const placeBtn = document.getElementById('btnPlaceOrder');
                    const result = document.getElementById('checkoutApiResult');
                    if (placeBtn) {
                        placeBtn.disabled = true;
                    }
                    if (result) {
                        result.textContent = 'Abriendo Google Pay...';
                    }

                    try {
                        await processCheckoutWithGooglePay();
                        await completeCheckoutFlow(result);
                    } catch (error) {
                        const message = error?.message || 'No se pudo procesar el pago con Google Pay.';
                        setCheckoutGooglePayStatus(message, 'error');
                        if (result) {
                            result.textContent = message;
                        }
                    } finally {
                        if (placeBtn) {
                            placeBtn.disabled = false;
                        }
                    }
                }
            });

            container.appendChild(button);
            setCheckoutGooglePayStatus('Usa Google Pay para pagar como invitado (modo TEST).', 'neutral');
        } catch (error) {
            setCheckoutGooglePayStatus(`No se pudo inicializar Google Pay: ${error.message}`, 'error');
        }
    }

    async function completeCheckoutFlow(resultNode) {
        if (!isAuthenticatedUser() && !checkoutPaymentState.guestPaymentApproved) {
            throw new Error('Debes completar el pago con Google Pay para continuar como invitado.');
        }

        const checkoutItems = loadCart();
        const customer = getCheckoutCustomerData();
        const created = await placeCheckoutOrders();
        const shipments = created.map((entry) => ({
            orderNumber: entry.orderNumber,
            trackingNumber: entry.shippingTracking,
            carrier: entry.carrier,
            courierName: entry.courierName,
            status: entry.shippingStatus,
            eta: entry.shippingEta
        }));
        const itemsForReceipt = (Array.isArray(checkoutItems) && checkoutItems.length > 0)
            ? checkoutItems.map((item) => {
                const bySku = created.find((entry) => entry.sku === item.sku);
                return {
                    ...item,
                    name: item.name || bySku?.productName || item.sku,
                    unitPrice: Number(item.unitPrice || bySku?.unitPrice || 0),
                    quantity: Number(item.quantity || bySku?.quantity || 0),
                    orderNumber: bySku?.orderNumber || ''
                };
            })
            : created.map((entry) => ({
                id: entry.inventoryId,
                sku: entry.sku,
                name: entry.productName || entry.sku,
                quantity: Number(entry.quantity || 0),
                unitPrice: Number(entry.unitPrice || 0),
                orderNumber: entry.orderNumber || ''
            }));
        const receiptPayload = buildReceiptPayload(itemsForReceipt, shipments, customer);
        saveReceipt(receiptPayload);

        if (resultNode) {
            const last = created[created.length - 1];
            resultNode.textContent = `Listo. Pedidos creados: ${created.length}. Ultimo pedido: ${last.orderNumber}, tracking: ${last.shippingTracking}.`;
        }
        localStorage.removeItem(CART_STORAGE_KEY);
        updateCartBadge();
        await pushCartToBackendIfAuthenticated();
        checkoutCouponState = { code: null, discountAmount: 0, finalTotal: 0, valid: false };
        resetCheckoutPaymentState();
        await syncCheckoutSummary();
        await refreshMyOrdersPanel();
        const orderNumbersCsv = created.map((entry) => entry.orderNumber).filter(Boolean).join(',');
        window.location.href = `boleta.html?receipt=${encodeURIComponent(receiptPayload.receiptNumber)}&orders=${encodeURIComponent(orderNumbersCsv)}`;
    }

    async function createOrderAndShipment(item, carrier, customer) {
        const orderResp = await FlashStockApi.createOrder({
            inventoryId: item.id,
            sku: item.sku,
            quantity: item.quantity,
            customerFirstName: customer.firstName,
            customerLastName: customer.lastName,
            customerEmail: customer.email,
            shippingAddress: customer.shippingAddress
        });

        const order = orderResp.data;
        const shippingResp = await FlashStockApi.createShipping({
            orderNumber: order.orderNumber,
            carrier: carrier
        });

        return {
            inventoryId: item.id,
            sku: item.sku,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice || 0),
            orderNumber: order.orderNumber,
            shippingTracking: shippingResp.data?.trackingNumber || 'N/A',
            carrier: shippingResp.data?.carrier || carrier,
            courierName: shippingResp.data?.courierName || `Repartidor ${carrier}`,
            shippingStatus: shippingResp.data?.status || '',
            shippingEta: shippingResp.data?.eta || ''
        };
    }

    async function placeCheckoutOrders() {
        const items = loadCart();
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('No hay productos en el carrito.');
        }

        const carrier = getCheckoutCarrier();
        const customer = getCheckoutCustomerData();
        validateCheckoutCustomer(customer);
        const created = [];

        for (const item of items) {
            const result = await createOrderAndShipment(item, carrier, customer);
            created.push(result);
        }

        return created;
    }

    async function initCheckoutPage() {
        const placeBtn = document.getElementById('btnPlaceOrder');
        if (!placeBtn) {
            return;
        }

        resetCheckoutPaymentState();

        const checkoutAddress = document.getElementById('checkoutAddress');
        if (checkoutAddress && !checkoutAddress.value.trim()) {
            checkoutAddress.value = getShippingAddressFromStorage();
        }

        await syncCheckoutSummary();

        const couponBtn = document.getElementById('btnApplyCheckoutCoupon');
        if (couponBtn) {
            couponBtn.addEventListener('click', async () => {
                try {
                    await applyCouponOnCheckout();
                    renderGooglePayCheckoutMeta(isAuthenticatedUser());
                } catch (error) {
                    showToast(`No se pudo aplicar el cupon: ${error.message}`, 'error');
                }
            });
        }

        const googlePayCheckoutSection = document.getElementById('googlePayCheckoutSection');
        if (isAuthenticatedUser()) {
            if (googlePayCheckoutSection) {
                googlePayCheckoutSection.style.display = 'block';
            }
            placeBtn.style.display = '';
            await renderGooglePayButtonForCheckout(true);
        } else {
            placeBtn.style.display = 'none';
            await renderGooglePayButtonForCheckout(false);
        }

        placeBtn.addEventListener('click', async () => {
            if (!isAuthenticatedUser()) {
                showToast('Para compra como invitado usa el boton de Google Pay.', 'error');
                return;
            }

            const result = document.getElementById('checkoutApiResult');
            placeBtn.disabled = true;
            if (result) {
                result.textContent = 'Procesando pedido y envio...';
            }

            try {
                await completeCheckoutFlow(result);
            } catch (error) {
                if (result) {
                    result.textContent = `No se pudo completar la operacion: ${error.message}`;
                }
            } finally {
                placeBtn.disabled = false;
            }
        });

        await refreshMyOrdersPanel();
        await initDriverLivePanel();
        window.setInterval(() => {
            refreshMyOrdersPanel().catch(() => {
                // Keep checkout interactive when order history cannot refresh.
            });
        }, 5000);
    }

    async function initDeliveryPage() {
        const root = document.getElementById('deliveryPageRoot');
        if (!root) {
            return;
        }

        const redirected = await maybeRedirectDeliveryToOrderStatus();
        if (redirected) {
            return;
        }

        const manualTrackBtn = document.getElementById('btnManualTrack');
        if (manualTrackBtn) {
            manualTrackBtn.addEventListener('click', async () => {
                const trackingInput = document.getElementById('manualTrackingNumber');
                const feedback = document.getElementById('manualTrackResult');
                const tracking = trackingInput?.value?.trim();

                if (!tracking) {
                    if (feedback) {
                        feedback.textContent = 'Ingresa un tracking valido.';
                    }
                    return;
                }

                manualTrackBtn.disabled = true;
                if (feedback) {
                    feedback.textContent = 'Cargando seguimiento...';
                }

                try {
                    await openTrackingMap(tracking);
                    if (feedback) {
                        feedback.textContent = `Tracking ${tracking} cargado correctamente.`;
                    }
                    const driverTrackingInput = document.getElementById('driverTrackingNumber');
                    if (driverTrackingInput) {
                        driverTrackingInput.value = tracking;
                    }
                } catch (error) {
                    if (feedback) {
                        feedback.textContent = `No se pudo cargar tracking: ${error.message}`;
                    }
                } finally {
                    manualTrackBtn.disabled = false;
                }
            });
        }

        await refreshMyOrdersPanel();
        await initDriverLivePanel();
        window.setInterval(() => {
            refreshMyOrdersPanel().catch(() => {
                // Keep delivery board visible if one refresh fails.
            });
        }, 5000);
    }

    async function refreshMyOrdersPanel() {
        const panel = document.getElementById('myOrdersPanel');
        const list = document.getElementById('myOrdersList');
        if (!panel || !list) {
            return;
        }

        if (!isAuthenticatedUser()) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        const rows = await fetchOrdersForCurrentRole();
        if (rows.length === 0) {
            list.innerHTML = '<div class="small text-muted">Aun no tienes pedidos.</div>';
            return;
        }

        list.innerHTML = rows.map((order) => {
            const orderStatus = order.orderStatus || 'N/A';
            const shipmentStatus = String(order.shipmentStatus || 'PENDING');
            const shipmentStatusUpper = shipmentStatus.toUpperCase();
            const badgeClass = shipmentStatusUpper.includes('DELIVER') || shipmentStatusUpper.includes('COMPLET')
                ? 'success'
                : (shipmentStatusUpper.includes('TRANSIT') || shipmentStatusUpper.includes('ENVI') ? 'warning' : 'secondary');
            const tracking = order.shipmentTrackingNumber || '';
            return `
                <div class="border rounded p-3 mb-2 bg-light">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong>${order.orderNumber || 'ORD-N/A'}</strong>
                        <span class="badge bg-${badgeClass}">${shipmentStatus}</span>
                    </div>
                    <div class="small text-muted mt-1">Estado pedido: ${orderStatus}</div>
                    <div class="small text-muted">Tracking: ${order.shipmentTrackingNumber || 'Sin tracking'}</div>
                    <div class="small text-muted">Carrier: ${order.carrier || 'Pendiente'}</div>
                    ${tracking ? `<button type="button" class="btn btn-sm border-secondary text-primary mt-2 js-track-order" data-tracking="${tracking}">Ver envio en mapa</button>` : ''}
                </div>`;
        }).join('');

        list.querySelectorAll('.js-track-order').forEach((button) => {
            button.addEventListener('click', async () => {
                const tracking = button.getAttribute('data-tracking');
                if (!tracking) {
                    return;
                }
                await openTrackingMap(tracking);
                const trackingInput = document.getElementById('driverTrackingNumber');
                if (trackingInput) {
                    trackingInput.value = tracking;
                }
            });
        });
    }

    function renderReceipt(receipt) {
        const number = document.getElementById('receiptNumber');
        const date = document.getElementById('receiptDate');
        const customer = document.getElementById('receiptCustomer');
        const email = document.getElementById('receiptEmail');
        const address = document.getElementById('receiptAddress');
        const subtotal = document.getElementById('receiptSubtotal');
        const shipping = document.getElementById('receiptShipping');
        const discount = document.getElementById('receiptDiscount');
        const total = document.getElementById('receiptTotal');
        const itemsBody = document.getElementById('receiptItemsBody');
        const shipmentBody = document.getElementById('receiptShipmentBody');

        if (number) number.textContent = receipt.receiptNumber || '-';
        if (date) date.textContent = receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : '-';
        if (customer) customer.textContent = `${receipt.customerFirstName || ''} ${receipt.customerLastName || ''}`.trim() || '-';
        if (email) email.textContent = receipt.customerEmail || '-';
        if (address) address.textContent = receipt.shippingAddress || '-';

        if (subtotal) subtotal.textContent = formatCurrency(receipt.subtotal || 0);
        if (shipping) shipping.textContent = formatCurrency(receipt.shipping || 0);
        if (discount) discount.textContent = `-${formatCurrency(receipt.discount || 0)}`;
        if (total) total.textContent = formatCurrency(receipt.total || 0);

        if (itemsBody) {
            const rows = (receipt.items || []).map((item) => `
                <tr>
                    <td>${item.productName || '-'}</td>
                    <td>${item.sku || '-'}</td>
                    <td>${Number(item.quantity || 0)}</td>
                    <td>${formatCurrency(item.unitPrice || 0)}</td>
                    <td>${formatCurrency(item.lineTotal || 0)}</td>
                </tr>`).join('');
            itemsBody.innerHTML = rows || '<tr><td colspan="5" class="text-center text-muted py-3">Sin productos</td></tr>';
        }

        if (shipmentBody) {
            const rows = (receipt.shipments || []).map((shipment) => `
                <tr>
                    <td>${shipment.orderNumber || '-'}</td>
                    <td>${shipment.trackingNumber || '-'}</td>
                    <td>${shipment.carrier || '-'}</td>
                    <td>${shipment.courierName || '-'}</td>
                    <td>${shipment.status || '-'}</td>
                    <td>${shipment.eta || '-'}</td>
                </tr>`).join('');
            shipmentBody.innerHTML = rows || '<tr><td colspan="6" class="text-center text-muted py-3">Sin envios asociados</td></tr>';
        }
    }

    async function initReceiptPage() {
        const downloadBtn = document.getElementById('btnDownloadReceipt');
        const emailBtn = document.getElementById('btnEmailReceipt');
        if (!downloadBtn || !emailBtn) {
            return;
        }

        let receipt = loadReceipt();
        if (!receipt) {
            const params = new URLSearchParams(window.location.search || '');
            const orders = params.get('orders') || '';
            if (orders) {
                try {
                    const response = await FlashStockApi.getReceiptFromOrders(orders);
                    receipt = response?.data || null;
                    if (receipt) {
                        saveReceipt(receipt);
                    }
                } catch (error) {
                    receipt = null;
                }
            }
        }

        if (!receipt) {
            try {
                const historyResp = await FlashStockApi.getMyOrderHistory();
                const historyRows = Array.isArray(historyResp?.data) ? historyResp.data : [];
                const orderNumbers = historyRows
                    .map((row) => row?.orderNumber)
                    .filter((value) => typeof value === 'string' && value.trim().length > 0)
                    .slice(0, 5);

                if (orderNumbers.length > 0) {
                    const response = await FlashStockApi.getReceiptFromOrders(orderNumbers.join(','));
                    receipt = response?.data || null;
                    if (receipt) {
                        saveReceipt(receipt);
                    }
                }
            } catch (error) {
                receipt = null;
            }
        }

        if (!receipt) {
            const status = document.getElementById('receiptActionStatus');
            if (status) {
                status.textContent = 'No se pudo recuperar la boleta. Vuelve a completar el checkout para generarla.';
                status.classList.remove('text-success');
                status.classList.add('text-danger');
            }
            showToast('No existe una boleta para mostrar.', 'error');
            return;
        }

        renderReceipt(receipt);

        downloadBtn.addEventListener('click', () => {
            window.print();
        });

        emailBtn.addEventListener('click', async () => {
            const status = document.getElementById('receiptActionStatus');
            emailBtn.disabled = true;
            if (status) {
                status.textContent = 'Enviando boleta por correo...';
            }

            try {
                await FlashStockApi.sendReceiptEmail(receipt);
                if (status) {
                    status.textContent = `Boleta enviada correctamente a ${receipt.customerEmail}.`;
                    status.classList.remove('text-danger');
                    status.classList.add('text-success');
                }
                showToast('Boleta enviada por correo.', 'success');
            } catch (error) {
                if (status) {
                    status.textContent = `No se pudo enviar la boleta: ${error.message}`;
                    status.classList.remove('text-success');
                    status.classList.add('text-danger');
                }
                showToast('Error al enviar correo de boleta.', 'error');
            } finally {
                emailBtn.disabled = false;
            }
        });
    }

    async function ensureGoogleMapsLoaded() {
        if (window.google && window.google.maps) {
            return;
        }

        if (googleMapsLoader) {
            await googleMapsLoader;
            return;
        }

        googleMapsLoader = (async () => {
            const configResp = await FlashStockApi.getMapsConfig();
            const key = configResp?.data?.googleApiKey || '';

            if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY') {
                throw new Error('Configura app.maps.google.api-key en application.properties');
            }

            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry`;
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('No se pudo cargar Google Maps JavaScript API'));
                document.head.appendChild(script);
            });
        })();

        await googleMapsLoader;
    }

    async function ensureTrackingMap() {
        const mapContainer = document.getElementById('deliveryTrackingMap');
        if (!mapContainer) {
            return null;
        }

        await ensureGoogleMapsLoaded();

        if (!trackingMap) {
            trackingMap = new window.google.maps.Map(mapContainer, {
                center: { lat: -33.4489, lng: -70.6693 },
                zoom: 12,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                restriction: {
                    latLngBounds: CHILE_BOUNDS,
                    strictBounds: true
                }
            });
        }

        return trackingMap;
    }

    function renderTrackingMeta(data) {
        const status = document.getElementById('trackingStatus');
        const progress = document.getElementById('trackingProgress');
        const courier = document.getElementById('trackingCourier');
        const address = document.getElementById('trackingAddress');
        const etaTotal = document.getElementById('trackingEtaTotal');
        const etaRemaining = document.getElementById('trackingEtaRemaining');

        if (status) {
            status.textContent = `${data.orderStatus || 'proceso'} / ${data.shipmentStatus || 'proceso'}`;
        }
        if (progress) {
            progress.textContent = `${Number(data.progressPercent || 0)}%`;
        }
        if (courier) {
            courier.textContent = data.courierName || 'Repartidor FlashStock';
        }
        if (address) {
            address.textContent = data.shippingAddress || 'Direccion no disponible';
        }
        if (etaTotal) {
            etaTotal.textContent = data.totalDurationText || '-';
        }
        if (etaRemaining) {
            etaRemaining.textContent = data.remainingDurationText || '-';
        }

        renderTrackingSegments(data.routeSteps || []);
    }

    function renderTrackingSegments(steps) {
        const container = document.getElementById('trackingSegments');
        if (!container) {
            return;
        }

        if (!Array.isArray(steps) || steps.length === 0) {
            container.innerHTML = '<div class="text-muted">Sin datos de tramos.</div>';
            return;
        }

        container.innerHTML = steps.map((step) => {
            const idx = step.stepIndex || 0;
            const instruction = step.instruction || 'Tramo';
            const distance = step.distanceText || 'N/A';
            const duration = step.durationText || 'N/A';
            return `<div class="border rounded p-2 mb-2"><strong>Tramo ${idx}:</strong> ${instruction}<br><span class="text-muted">Distancia: ${distance} | Duracion: ${duration}</span></div>`;
        }).join('');
    }

    function animateCourierMarker(target) {
        const marker = trackingMarkers.courier;
        if (!marker) {
            return;
        }

        if (!lastCourierPosition) {
            marker.setPosition(target);
            lastCourierPosition = { lat: target.lat, lng: target.lng };
            return;
        }

        const start = { lat: lastCourierPosition.lat, lng: lastCourierPosition.lng };
        const duration = 700;
        const startedAt = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            const lat = start.lat + (target.lat - start.lat) * progress;
            const lng = start.lng + (target.lng - start.lng) * progress;
            marker.setPosition({ lat, lng });

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                lastCourierPosition = { lat: target.lat, lng: target.lng };
            }
        };

        requestAnimationFrame(tick);
    }

    async function renderTrackingMap(data) {
        const map = await ensureTrackingMap();
        if (!map) {
            return;
        }

        const panel = document.getElementById('deliveryTrackingPanel');
        if (panel) {
            panel.style.display = 'block';
        }

        renderTrackingMeta(data);

        const origin = { lat: Number(data.originLat), lng: Number(data.originLng) };
        const destination = { lat: Number(data.destinationLat), lng: Number(data.destinationLng) };
        const courier = { lat: Number(data.courierLat), lng: Number(data.courierLng) };
        const orderPin = { lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 };

        let route = [];
        try {
            const parsed = JSON.parse(data.routeGeoJson || '{}');
            route = Array.isArray(parsed?.geometry?.coordinates)
                ? parsed.geometry.coordinates.map((pair) => ({ lat: Number(pair[1]), lng: Number(pair[0]) }))
                : [];
        } catch (e) {
            route = [];
        }

        if (route.length < 2) {
            route = [origin, destination];
        }

        if (trackingRoute) {
            trackingRoute.setMap(null);
        }

        trackingRoute = new window.google.maps.Polyline({
            path: route,
            geodesic: true,
            strokeColor: '#f0ad00',
            strokeOpacity: 0.95,
            strokeWeight: 6
        });
        trackingRoute.setMap(map);

        const upsertMarker = (key, position, title, iconUrl) => {
            if (!trackingMarkers[key]) {
                trackingMarkers[key] = new window.google.maps.Marker({
                    map,
                    position,
                    title,
                    icon: iconUrl ? { url: iconUrl, scaledSize: new window.google.maps.Size(32, 32) } : undefined
                });
            } else {
                if (key !== 'courier') {
                    trackingMarkers[key].setPosition(position);
                }
                trackingMarkers[key].setTitle(title);
            }
        };

        upsertMarker('store', origin, 'Tienda / origen', 'https://maps.google.com/mapfiles/ms/icons/green-dot.png');
        upsertMarker('customer', destination, 'Cliente / destino', 'https://maps.google.com/mapfiles/ms/icons/red-dot.png');
        upsertMarker('courier', courier, 'GPS repartidor', 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png');
        animateCourierMarker(courier);
        upsertMarker('order', orderPin, 'GPS pedido', 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png');

        const bounds = new window.google.maps.LatLngBounds();
        route.forEach((p) => bounds.extend(p));
        bounds.extend(courier);
        map.fitBounds(bounds);
    }

    async function refreshActiveTracking() {
        if (!activeTrackingNumber) {
            return;
        }
        const response = await FlashStockApi.getShippingTracking(activeTrackingNumber);
        const data = response?.data;
        if (!data) {
            return;
        }
        await renderTrackingMap(data);
    }

    async function openTrackingMap(trackingNumber) {
        activeTrackingNumber = trackingNumber;
        await refreshActiveTracking();

        if (trackingTimer) {
            window.clearInterval(trackingTimer);
        }
        trackingTimer = window.setInterval(() => {
            refreshActiveTracking().catch(() => {
                // Keep map visible even if one polling call fails.
            });
        }, TRACKING_REFRESH_MS);
    }

    async function initDriverLivePanel() {
        const panel = document.getElementById('driverLivePanel');
        const btn = document.getElementById('btnDriverUpdateLive');
        if (!panel || !btn) {
            return;
        }

        const hasAdminRole = Array.isArray(currentSession?.authorities) && currentSession.authorities.includes('ROLE_ADMIN');
        const isAdmin = Boolean(currentSession?.admin) || hasAdminRole;
        if (!isAdmin) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';

        btn.addEventListener('click', async () => {
            const tracking = document.getElementById('driverTrackingNumber')?.value?.trim();
            const status = document.getElementById('driverStatus')?.value?.trim();
            const courierName = document.getElementById('driverName')?.value?.trim();
            const latRaw = document.getElementById('driverLat')?.value;
            const lngRaw = document.getElementById('driverLng')?.value;
            const result = document.getElementById('driverLiveResult');

            if (!tracking) {
                if (result) {
                    result.textContent = 'Ingresa un tracking para actualizar.';
                }
                return;
            }

            const payload = {
                status,
                courierName,
                courierLat: latRaw === '' ? null : Number(latRaw),
                courierLng: lngRaw === '' ? null : Number(lngRaw)
            };

            btn.disabled = true;
            try {
                await FlashStockApi.updateTrackingLive(tracking, payload);
                if (result) {
                    result.textContent = 'Tracking actualizado correctamente.';
                }
                await openTrackingMap(tracking);
            } catch (error) {
                if (result) {
                    result.textContent = `No se pudo actualizar: ${error.message}`;
                }
            } finally {
                btn.disabled = false;
            }
        });
    }

    function ensureAdminMetricWidget() {
        let widget = document.getElementById('adminLiveWidget');
        if (widget) {
            return widget;
        }

        widget = document.createElement('div');
        widget.id = 'adminLiveWidget';
        widget.style.position = 'fixed';
        widget.style.right = '16px';
        widget.style.bottom = '16px';
        widget.style.zIndex = '1090';
        widget.style.background = 'rgba(15, 118, 110, 0.92)';
        widget.style.color = '#fff';
        widget.style.padding = '10px 12px';
        widget.style.borderRadius = '12px';
        widget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.2)';
        widget.style.fontSize = '12px';
        widget.style.maxWidth = '280px';
        widget.style.display = 'none';
        widget.innerHTML = '<div><strong>Admin Live</strong></div><div id="adminLiveWidgetContent">Cargando...</div>';

        document.body.appendChild(widget);
        return widget;
    }

    function renderAdminMetricWidget(data) {
        const widget = ensureAdminMetricWidget();
        const content = document.getElementById('adminLiveWidgetContent');
        if (!content) {
            return;
        }

        content.textContent = `Inv:${data.inventorySkuCount || 0} | Ord:${data.totalOrders || 0} | Env:${data.totalShipments || 0} | Cash:${data.grossCashflow || 0}`;
        widget.style.display = 'block';
    }

    async function startAdminRealtimeWidget() {
        try {
            const first = await FlashStockApi.getAdminMetrics();
            renderAdminMetricWidget(first.data || {});
        } catch (e) {
            return;
        }

        window.setInterval(async () => {
            try {
                const resp = await FlashStockApi.getAdminMetrics();
                renderAdminMetricWidget(resp.data || {});
            } catch (e) {
                const widget = document.getElementById('adminLiveWidget');
                if (widget) {
                    widget.style.display = 'none';
                }
            }
        }, 1000);
    }

    async function attachAdminShortcut() {
        const userLink = getUserLink();
        if (!userLink) {
            return;
        }

        try {
            const authResp = await FlashStockApi.getCurrentUser();
            const session = authResp?.data;
            const hasAdminRole = Array.isArray(session?.authorities) && session.authorities.includes('ROLE_ADMIN');
            const isAdmin = Boolean(session?.admin) || hasAdminRole;

            if (!session?.authenticated || !isAdmin) {
                return;
            }

            let inventoryLink = document.getElementById('adminInventoryShortcut');
            if (!inventoryLink) {
                inventoryLink = document.createElement('a');
                inventoryLink.id = 'adminInventoryShortcut';
                inventoryLink.href = '/admin/inventory';
                inventoryLink.className = 'btn border border-secondary rounded-pill px-3 text-primary me-2 my-auto';
                inventoryLink.innerHTML = '<i class="fas fa-boxes me-2"></i>Inventario Admin';
                userLink.parentElement?.insertBefore(inventoryLink, userLink);
            }

            let dashboardLink = document.getElementById('adminDashboardShortcut');
            if (!dashboardLink) {
                dashboardLink = document.createElement('a');
                dashboardLink.id = 'adminDashboardShortcut';
                dashboardLink.href = '/admin/dashboard';
                dashboardLink.className = 'btn border border-secondary rounded-pill px-3 text-primary me-2 my-auto';
                dashboardLink.innerHTML = '<i class="fas fa-chart-line me-2"></i>Dashboard';
                userLink.parentElement?.insertBefore(dashboardLink, userLink);
            }

            startAdminRealtimeWidget();
        } catch (error) {
            // Keep storefront usable even if auth endpoint is unavailable.
        }
    }

    function ensureLogoutLink(userLink) {
        let logoutLink = document.getElementById('navbarLogoutLink');
        if (logoutLink) {
            return logoutLink;
        }

        logoutLink = document.createElement('a');
        logoutLink.id = 'navbarLogoutLink';
        logoutLink.href = '/logout';
        logoutLink.className = 'btn border border-secondary rounded-pill px-3 text-primary me-3 my-auto';
        logoutLink.innerHTML = '<i class="fas fa-sign-out-alt me-2"></i>Cerrar sesion';
        logoutLink.style.display = 'none';
        userLink.parentElement?.insertBefore(logoutLink, userLink);
        return logoutLink;
    }

    async function attachSessionUi() {
        const userLink = getUserLink();
        if (!userLink) {
            return;
        }

        const logoutLink = ensureLogoutLink(userLink);
        const icon = userLink.querySelector('i');

        try {
            const authResp = await FlashStockApi.getCurrentUser();
            const session = authResp?.data;
            currentSession = session || null;

            if (session?.authenticated) {
                userLink.href = '/';
                userLink.title = `Sesion iniciada: ${session.email || 'usuario'}`;
                if (icon) {
                    icon.className = 'fas fa-user-check fa-2x text-success';
                }
                logoutLink.style.display = 'inline-flex';
            } else {
                userLink.href = '/static/login.html';
                userLink.title = 'Iniciar sesion';
                if (icon) {
                    icon.className = 'fas fa-user fa-2x';
                }
                logoutLink.style.display = 'none';
            }
        } catch (error) {
            currentSession = null;
            userLink.href = '/static/login.html';
            userLink.title = 'Iniciar sesion';
            if (icon) {
                icon.className = 'fas fa-user fa-2x';
            }
            logoutLink.style.display = 'none';
        }
    }

    async function refreshStorefrontInventory() {
        try {
            const inventoryResp = await FlashStockApi.listInventory();
            const inventoryItems = inventoryResp?.data || [];
            inventoryCache = inventoryItems;
            renderInventoryOnTemplate(inventoryItems);
            normalizeCart(inventoryItems);
            updateCartBadge();
        } catch (error) {
            // Keep current catalog rendered if one realtime refresh fails.
        }
    }

    async function bootstrapFlashStockFrontend() {
        ensureOrderStatusNavbarLink();
        await attachSessionUi();
        await syncCartFromBackendIfAuthenticated();
        await refreshOrderStatusVisibility();

        await refreshStorefrontInventory();

        bindAddToCartActions();
        updateCartBadge();
        await initCartPage();
        await initCheckoutPage();
        await initReceiptPage();
        await initDeliveryPage();
        await attachAdminShortcut();

        const hasCatalogView = document.querySelector('.fruite-item, .vesitable-item, #tab-1, .Vegetal-carousel');
        if (hasCatalogView) {
            window.setInterval(() => {
                refreshStorefrontInventory();
            }, INVENTORY_REFRESH_MS);
        }

        window.setInterval(() => {
            refreshOrderStatusVisibility().catch(() => {
                // Avoid breaking UI if order status visibility refresh fails.
            });
        }, 15000);
    }

    bootstrapFlashStockFrontend();

})(jQuery);

