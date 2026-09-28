/**
 * CONFIG.JS v4.8
 * v4.8 (auditoria):
 *  - dispara 'supabase-ready' quando o cliente fica pronto (app.js espera)
 *  - removido console.clear()
 *  - novos helpers: safeUrl(), sanitizeFileName(), onSupabaseReady()
 *  - número central da loja num lugar só (CONFIG.STORE_WHATSAPP)
 */

if (typeof window.CONFIG_LOADED !== 'undefined') {
    console.log('⚠️ Config.js já foi carregado. Ignorando duplicata.');
} else {
    window.CONFIG = {
        SUPABASE_URL: 'https://dkzbpevakiiwzuimzftz.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRremJwZXZha2lpd3p1aW16ZnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc4NDgsImV4cCI6MjA4NDczMzg0OH0.GgDQz3KR2x1vupLWPSd7gU9lLXNCjBAaFXEM6IADYWY',
        DEBUG: false,
        TABLES: {
            PRODUCTS: 'products',
            ORDERS: 'orders',
            ORDER_ITEMS: 'order_items',
            ADS: 'ads',
            PROFILES: 'profiles'
        },
        STORAGE_BUCKET: 'product-images',
        ADS_BUCKET: 'ad-images',
        MAX_IMAGE_SIZE: 5242880,
        STORE_WHATSAPP: '5535991264352',
        // Ferramentas de vendedor para o Admin Supremo (BI, Configurações da
        // loja, estoque, "Novo produto", avisos de venda, missões).
        // false = desligadas, sem apagar nada. Mude para true se precisar de volta.
        ADMIN_SELLER_TOOLS: false,
        // Notificação push (avisos de venda com o site fechado)
        VAPID_PUBLIC_KEY: 'BHh--3pMyxKxd6P49gRpsotKuBYuSsF32JZTqY4gMDw2olImuD75WI1y4_tlwXc4XjU5J6qM2QY-TIAV34u9Pi0',
        PUSH_FUNCTION_URL: 'https://dkzbpevakiiwzuimzftz.supabase.co/functions/v1/send-push'
    };

    window.log = function (message, type = 'info') {
        if (!window.CONFIG || !window.CONFIG.DEBUG) return;
        const styles = {
            info: 'color:#3b82f6;font-weight:bold;',
            success: 'color:#10b981;font-weight:bold;',
            error: 'color:#ef4444;font-weight:bold;',
            warning: 'color:#f59e0b;font-weight:bold;'
        };
        const prefix = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' }[type] || '•';
        console.log(`%c${prefix} ${message}`, styles[type] || '');
    };

    window.formatBRL = function (value, decimals = 2) {
        const num = Number(value) || 0;
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    window.buildWhatsAppLink = function (phone, text) {
        if (!phone) return null;
        const digits = String(phone).replace(/\D/g, '');
        if (!digits) return null;
        const withCountry = digits.length <= 11 ? `55${digits}` : digits;
        return `https://wa.me/${withCountry}` + (text ? `?text=${encodeURIComponent(text)}` : '');
    };

    window.escapeHtml = function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    /** Só deixa passar URL http(s) — bloqueia "javascript:" e afins. */
    window.safeUrl = function (url) {
        if (!url) return '';
        try {
            const u = new URL(String(url).trim(), window.location.href);
            return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
        } catch {
            return '';
        }
    };

    /** Nome de arquivo seguro pro Storage (sem acento, espaço ou símbolo). */
    window.sanitizeFileName = function (name) {
        const clean = String(name || 'arquivo')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return (clean || 'arquivo').slice(-80);
    };

    window.compressImage = function (file, options = {}) {
        const maxWidth = options.maxWidth || 1600;
        const maxHeight = options.maxHeight || 1600;
        const quality = options.quality || 0.75;
        const minSize = options.minSizeToCompress || 300 * 1024;

        return new Promise((resolve) => {
            try {
                if (!file || !file.type || !file.type.startsWith('image/')) return resolve(file);
                if (file.type === 'image/gif' || file.size < minSize) return resolve(file);

                const objectUrl = URL.createObjectURL(file);
                const img = new Image();

                img.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    try {
                        let { width, height } = img;
                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return resolve(file);
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            if (!blob || blob.size >= file.size) return resolve(file);
                            const name = file.name.replace(/\.\w+$/, '') + '.jpg';
                            resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
                        }, 'image/jpeg', quality);
                    } catch {
                        resolve(file);
                    }
                };
                img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
                img.src = objectUrl;
            } catch {
                resolve(file);
            }
        });
    };

    // ── Som de notificação ─────────────────────────────────────
    // Navegadores só liberam som depois do 1º toque na página. O contexto
    // de áudio é criado/"destravado" nesse toque e, se um aviso chegar
    // antes, o som espera o destrave em vez de sumir.
    const SOUND_KEY = 'ityrapuan_sound_enabled';
    let _audioCtx = null;
    let _master = null;

    function _ensureAudioContext() {
        if (!_audioCtx) {
            try {
                _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                // compressor = som mais alto sem estourar
                const comp = _audioCtx.createDynamicsCompressor();
                comp.threshold.value = -18;
                comp.ratio.value = 6;
                _master = _audioCtx.createGain();
                _master.gain.value = 0.9;
                _master.connect(comp);
                comp.connect(_audioCtx.destination);
            } catch { return null; }
        }
        if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
        return _audioCtx;
    }
    ['pointerdown', 'touchstart', 'keydown'].forEach((evt) => {
        document.addEventListener(evt, () => _ensureAudioContext(), { passive: true });
    });

    window.isNotificationSoundEnabled = function () {
        try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
    };
    window.setNotificationSoundEnabled = function (on) {
        try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignora */ }
    };

    // Uma nota de "sino": fundamental + harmônico, ataque rápido e cauda longa
    function _bell(ctx, freq, start, dur, vol = 0.5, type = 'triangle') {
        [[1, vol], [2.01, vol * 0.35], [3.02, vol * 0.12]].forEach(([mult, v]) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = mult === 1 ? type : 'sine';
            osc.frequency.value = freq * mult;
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(v, start + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
            osc.connect(g);
            g.connect(_master);
            osc.start(start);
            osc.stop(start + dur + 0.05);
        });
    }

    // "Tchi" metálico da caixa registradora
    function _chink(ctx, start) {
        const len = Math.floor(ctx.sampleRate * 0.08);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3500;
        const g = ctx.createGain();
        g.gain.value = 0.35;
        src.connect(hp); hp.connect(g); g.connect(_master);
        src.start(start);
    }

    const SOUNDS = {
        // 🎉 venda: "ka-ching" + arpejo alegre (bem diferente dos outros)
        sale: (ctx, t) => {
            _chink(ctx, t);
            _bell(ctx, 1046.5, t + 0.02, 0.35, 0.55);   // C6
            _bell(ctx, 1318.5, t + 0.12, 0.35, 0.55);   // E6
            _bell(ctx, 1568.0, t + 0.22, 0.45, 0.55);   // G6
            _bell(ctx, 2093.0, t + 0.34, 0.9, 0.6);     // C7 (fica soando)
        },
        // 🆕 produto novo: "plim-plom" de campainha
        product: (ctx, t) => {
            _bell(ctx, 1318.5, t, 0.6, 0.55, 'sine');    // E6
            _bell(ctx, 987.8, t + 0.22, 0.9, 0.55, 'sine'); // B5
        },
        // 🚫 moderação: dois toques graves
        moderation: (ctx, t) => {
            _bell(ctx, 523.3, t, 0.25, 0.5, 'square');
            _bell(ctx, 392.0, t + 0.2, 0.4, 0.5, 'square');
        },
        restock: (ctx, t) => {
            _bell(ctx, 784.0, t, 0.3, 0.5);
            _bell(ctx, 1174.7, t + 0.14, 0.5, 0.5);
        },
        default: (ctx, t) => _bell(ctx, 880, t, 0.5, 0.5)
    };
    const VIBRATE = { sale: [200, 100, 200, 100, 400], product: [120, 80, 120], moderation: [300], restock: [120] };

    /**
     * @param {'sale'|'product'|'moderation'|'restock'|'default'} type
     * @param {{force?: boolean}} opts  force = toca mesmo com o som desligado (botão "Testar")
     */
    window.playNotificationSound = function (type = 'default', opts = {}) {
        if (!opts.force && !window.isNotificationSoundEnabled()) return;
        try { navigator.vibrate?.(VIBRATE[type] || 150); } catch { /* ignora */ }
        try {
            const ctx = _ensureAudioContext();
            if (!ctx) return;
            const asked = Date.now();
            const play = () => {
                if (Date.now() - asked > 120000) return; // aviso velho: não toca atrasado
                (SOUNDS[type] || SOUNDS.default)(ctx, ctx.currentTime + 0.03);
            };
            if (ctx.state === 'running') play();
            else {
                // ainda travado: toca assim que a pessoa tocar na tela (até 2 min)
                ctx.resume().then(play).catch(() => {
                    document.addEventListener('pointerdown', () => ctx.resume().then(play).catch(() => {}), { once: true });
                });
            }
        } catch { /* som é opcional */ }
    };

    // ── Supabase ───────────────────────────────────────────────
    window._supabase = null;
    window.SUPABASE_READY = false;

    // Link vindo de e-mail (confirmação de cadastro, recuperação de senha, erro).
    // Precisa ser lido ANTES de criar o cliente: o Supabase limpa a URL ao processar.
    window.AUTH_LINK = (function () {
        try {
            const h = new URLSearchParams(location.hash.replace(/^#/, ''));
            const q = new URLSearchParams(location.search);
            const get = (k) => h.get(k) || q.get(k);
            return {
                type: get('type'),
                error: get('error_code') || get('error'),
                errorDescription: get('error_description'),
                handled: false
            };
        } catch { return { handled: false }; }
    })();

    function initSupabase() {
        if (!window.supabase || !window.supabase.createClient) return false;
        try {
            window._supabase = window.supabase.createClient(
                window.CONFIG.SUPABASE_URL,
                window.CONFIG.SUPABASE_KEY
            );
            // registrado já na criação pra não perder o evento do link de recuperação
            window._supabase.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') {
                    window.AUTH_LINK.type = 'recovery';
                    window.AUTH_LINK.handled = false;
                    window.APP?.auth?._handleAuthLink?.();
                }
            });
            return !!window._supabase;
        } catch (err) {
            console.error('Erro ao criar cliente Supabase:', err);
            return false;
        }
    }

    function showConnectionErrorBanner() {
        if (document.getElementById('supabase-error-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'supabase-error-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;padding:12px 16px;text-align:center;font-weight:700;font-size:13px;font-family:Inter,-apple-system,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.3)';
        banner.innerHTML = `⚠️ Não conseguimos conectar ao servidor agora.
            <button id="supabase-error-retry-btn" style="margin-left:10px;text-decoration:underline;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-size:13px;">Tentar novamente</button>`;
        document.body.appendChild(banner);
        document.getElementById('supabase-error-retry-btn')?.addEventListener('click', () => location.reload());
    }

    function tryInitWithRetry(attemptsLeft = 15, delayMs = 600) {
        if (initSupabase()) {
            window.SUPABASE_READY = true;
            document.dispatchEvent(new Event('supabase-ready'));
            return;
        }
        if (attemptsLeft > 0) {
            setTimeout(() => tryInitWithRetry(attemptsLeft - 1, delayMs), delayMs);
            return;
        }
        showConnectionErrorBanner();
    }

    /** Roda `fn` assim que o Supabase estiver pronto (na hora, se já estiver). */
    window.onSupabaseReady = function (fn) {
        if (window.SUPABASE_READY) fn();
        else document.addEventListener('supabase-ready', fn, { once: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => tryInitWithRetry());
    } else {
        tryInitWithRetry();
    }

    window.CONFIG_LOADED = true;
}
