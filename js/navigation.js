/**
 * NAVIGATION.JS v3.5
 * v3.5 (auditoria):
 *  - bloqueia abrir aba que o cargo atual não pode ver
 *  - aba "ads" recarrega também as solicitações do Admin
 *  - aba "ads-requests" usa o cargo atual direto do Auth
 */

const Navigation = {
    sections: ['market', 'bi', 'admin', 'seller', 'ads', 'ads-requests', 'vendor-settings', 'tenants', 'moderation'],
    activeTab: 'market',
    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this._registerDataNavButtons();
        this._registerDataActionButtons();
        this._registerAuthTabs();
        this._registerForms();
        this._initBottomNavHints();
    },

    // ============================================================
    // BARRA DE BAIXO (celular): mostra que dá pra arrastar pro lado
    // 1) degradê + seta na borda onde há mais botões
    // 2) último botão visível fica cortado pela metade
    // 3) uma "balançadinha" na primeira vez (1x por aparelho)
    // ============================================================

    BNAV_HINT_KEY: 'ityrapuan_bnav_swipe_hint_seen',

    _initBottomNavHints() {
        const nav = document.getElementById('bottom-nav');
        if (!nav || this._bnavHintsReady) return;
        this._bnavHintsReady = true;

        const makeFade = (side) => {
            const el = document.createElement('div');
            el.className = `bnav-fade bnav-fade-${side}`;
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = `<span>${side === 'left' ? '‹' : '›'}</span>`;
            document.body.appendChild(el);
            return el;
        };
        this._bnavFadeL = makeFade('left');
        this._bnavFadeR = makeFade('right');

        let userScrolled = false;
        nav.addEventListener('scroll', () => this._updateBnavFades(), { passive: true });
        nav.addEventListener('touchstart', () => { userScrolled = true; this._markBnavHintSeen(); }, { passive: true });

        let frame = 0;
        const refresh = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => { frame = 0; this.updateBottomNavHints(); });
        };
        window.addEventListener('resize', refresh);
        if (window.ResizeObserver) new ResizeObserver(refresh).observe(nav);
        // botões aparecem/somem conforme o cargo (ignora a própria classe da barra)
        if (window.MutationObserver) {
            new MutationObserver((list) => {
                if (list.some(m => m.target !== nav)) refresh();
            }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
        }
        this._bnavUserScrolled = () => userScrolled;
        refresh();
    },

    updateBottomNavHints() {
        const nav = document.getElementById('bottom-nav');
        if (!nav || getComputedStyle(nav).display === 'none') { this._toggleBnavFades(false, false); return; }

        // largura dos botões: se não couber tudo, deixa o último visível cortado ao meio
        const buttons = [...nav.querySelectorAll('.bnav-btn')].filter(b => !b.classList.contains('hidden'));
        const width = nav.clientWidth;
        const MIN = 64;
        if (buttons.length * MIN > width) {
            const fit = Math.max(3, Math.floor(width / MIN));
            nav.style.setProperty('--bnav-btn-w', `${Math.floor(width / (fit - 0.5))}px`);
            nav.classList.add('bnav-overflow');
        } else {
            nav.style.removeProperty('--bnav-btn-w');
            nav.classList.remove('bnav-overflow');
        }

        this._updateBnavFades();
        this._maybeNudgeBottomNav();
    },

    _updateBnavFades() {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;
        const max = nav.scrollWidth - nav.clientWidth;
        const overflow = max > 4;
        this._toggleBnavFades(overflow && nav.scrollLeft > 4, overflow && nav.scrollLeft < max - 4);
        if (overflow && nav.scrollLeft >= max - 4) this._markBnavHintSeen();
    },

    _toggleBnavFades(left, right) {
        this._bnavFadeL?.classList.toggle('show', !!left);
        this._bnavFadeR?.classList.toggle('show', !!right);
    },

    _markBnavHintSeen() {
        try { localStorage.setItem(this.BNAV_HINT_KEY, '1'); } catch { /* ignora */ }
    },

    _maybeNudgeBottomNav() {
        const nav = document.getElementById('bottom-nav');
        if (!nav || this._bnavNudged) return;
        if (nav.scrollWidth - nav.clientWidth < 20) return;
        try { if (localStorage.getItem(this.BNAV_HINT_KEY)) return; } catch { /* segue */ }
        this._bnavNudged = true;

        setTimeout(() => {
            if (this._bnavUserScrolled?.() || document.hidden) return;
            nav.scrollTo({ left: Math.min(90, nav.scrollWidth - nav.clientWidth), behavior: 'smooth' });
            setTimeout(() => {
                nav.scrollTo({ left: 0, behavior: 'smooth' });
                this._markBnavHintSeen();
            }, 900);
        }, 1800);
    },

    _registerDataNavButtons() {
        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', () => this.showTab(btn.getAttribute('data-nav')));
        });
    },

    _registerDataActionButtons() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            this._handleAction(btn.getAttribute('data-action'), btn, e);
        });
    },

    _handleAction(action, btn) {
        const app = window.APP || {};
        switch (action) {
            case 'open-login':          app.auth?.openAuthModal('login'); break;
            case 'open-profile':        app.auth?.openProfileModal(); break;
            case 'close-profile-modal': app.auth?.closeProfileModal(); break;
            case 'logout':              app.auth?.logout(); break;
            case 'close-auth-modal':    app.auth?.closeAuthModal(); break;
            case 'toggle-cart':         app.cart?.toggleCart(); break;
            case 'close-cart':          app.cart?.closeCart(); break;
            case 'checkout':            app.orders?.checkout(); break;
            case 'open-product-modal':  app.products?.openModal(); break;
            case 'close-product-modal': app.products?.closeModal(); break;
            case 'close-checkout-modal': app.orders?.closeCustomerModal?.(); break;
            case 'close-tenant-modal':  app.tenants?.closeTenantDetailsModal?.(); break;
            case 'toggle-ad-type':      app.ads?.toggleAdType?.(btn.getAttribute('data-type')); break;

            case 'add-to-cart': {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const price = parseFloat(btn.getAttribute('data-price'));
                const stock = parseInt(btn.getAttribute('data-stock'), 10);
                let bulkTiers = [];
                try { bulkTiers = JSON.parse(btn.getAttribute('data-bulk-tiers') || '[]'); } catch { bulkTiers = []; }

                if (app.cart) {
                    const before = app.cart.getCount();
                    app.cart.add(id, name, price, bulkTiers, stock);
                    if (app.cart.getCount() > before) this._flashAddButton(btn);
                }
                break;
            }
            default: break;
        }
    },

    _flashAddButton(btn) {
        if (!btn || btn.dataset.flashing === '1') return;
        const original = btn.innerHTML;
        btn.dataset.flashing = '1';
        btn.classList.add('btn-add-success');
        btn.innerHTML = '✓ Adicionado!';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('btn-add-success');
            btn.dataset.flashing = '0';
        }, 1100);
    },

    _registerAuthTabs() {
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                const auth = window.APP?.auth;
                if (!auth) return;
                if (tab === 'login') auth.showLoginTab();
                else if (tab === 'signup') auth.showSignupTab();
                else if (tab === 'forgot') auth.showForgotTab();
            });
        });
    },

    _registerForms() {
        document.addEventListener('submit', (e) => {
            const form = e.target.closest('[data-form]');
            if (!form) return;
            e.preventDefault();

            const app = window.APP || {};
            const formType = form.getAttribute('data-form');
            const subType = form.getAttribute('data-type');

            if (formType === 'auth') {
                if (subType === 'login') app.auth?.loginDirect();
                else if (subType === 'signup') app.auth?.signupDirect();
                else if (subType === 'forgot') app.auth?.resetPasswordDirect();
            } else if (formType === 'product') {
                app.products?.saveProductDirect();
            } else if (formType === 'checkout') {
                app.orders?.sendOrderDirect();
            } else if (formType === 'ads') {
                app.ads?.saveAd(null, subType || app.ads?.adType || 'image');
            } else if (formType === 'new-password') {
                app.auth?.updatePasswordDirect();
            }
        });
    },

    showTab(tab) {
        try {
            if (!this.sections.includes(tab)) return;

            const auth = window.APP?.auth;
            if (tab !== 'market' && auth && !auth.canAccessTab(tab)) {
                if (!auth.isLoggedIn()) auth.openAuthModal('login');
                tab = 'market';
            }

            this.sections.forEach(s => document.getElementById(`${s}-section`)?.classList.add('hidden'));

            const target = document.getElementById(`${tab}-section`);
            if (!target) return;

            target.classList.remove('hidden');
            this.activeTab = tab;
            this._updateActiveButtons(tab);
            this._loadDataForTab(tab);
            document.getElementById('whatsapp-fab')?.classList.toggle('show', tab === 'market');
        } catch (err) {
            log(`❌ Erro na navegação: ${err.message}`, 'error');
        }
    },

    _updateActiveButtons(activeTab) {
        document.querySelectorAll('[data-nav]').forEach(btn => {
            const on = btn.getAttribute('data-nav') === activeTab;
            btn.classList.toggle('bg-white/10', on);
            btn.classList.toggle('text-white', on);
            if (btn.classList.contains('bnav-btn')) btn.classList.toggle('active', on);
        });
    },

    _loadDataForTab(tab) {
        const app = window.APP;
        if (!app) return;
        try {
            switch (tab) {
                case 'bi':
                    app.bi?.loadDashboard();
                    app.notifications?.clearUnseen?.();
                    break;
                case 'admin':
                    app.products?.renderAdmin();
                    window.ImageOptimizer?.renderPanel?.();
                    app.vendorSettings?.refreshGlobalOverride?.();
                    app.notifications?.renderPushCard?.();
                    break;
                case 'seller':
                    app.products?.renderSeller();
                    break;
                case 'tenants':
                    app.tenants?.loadDashboard();
                    break;
                case 'ads':
                    app.ads?.refreshForRole();
                    app.ads?.loadAds();
                    break;
                case 'ads-requests':
                    app.ads?._renderVendorRequestForm();
                    app.ads?._loadVendorRequests();
                    break;
                case 'vendor-settings':
                    app.vendorSettings?.refresh();
                    break;
                case 'moderation':
                    app.moderation?.loadQueue?.();
                    app.moderation?.clearUnseen?.();
                    break;
            }
        } catch (err) {
            log(`⚠️ Erro ao carregar aba ${tab}: ${err.message}`, 'warning');
        }
    },

    getActiveTab() { return this.activeTab; }
};

window.goToTab = function (tab) { Navigation.showTab(tab); };
