// Fungsi utama shared antar halaman

const DEG_C = '\u00B0C';

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readLocalStorage(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function writeLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        return false;
    }
}

function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        // Browser tetap bisa berjalan tanpa penyimpanan lokal.
    }
}

function clampPercent(value, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, 0), 100);
}

const STORAGE_KEYS = {
    THRESHOLD_LOWER: 'lf_threshold_lower',
    THRESHOLD_UPPER: 'lf_threshold_upper',
    VALVE_STATE: 'lf_valve_state',
    THEME: 'lf_theme',
    SELECTED_FARM: 'lf_selected_farm'
};

const VALVE_STATE = {
    OPEN: 'Terbuka',
    CLOSED: 'Tertutup'
};

const DECISION_TYPE = {
    OPEN: 'open',
    DELAYED: 'delayed',
    CLOSED: 'closed',
    NORMAL: 'normal',
    WARNING: 'warning'
};

const THEME = {
    LIGHT: 'light',
    DARK: 'dark'
};

function getSavedTheme() {
    const savedTheme = readLocalStorage(STORAGE_KEYS.THEME, THEME.DARK);
    return savedTheme === THEME.LIGHT ? THEME.LIGHT : THEME.DARK;
}

function applyTheme(theme) {
    const nextTheme = theme === THEME.LIGHT ? THEME.LIGHT : THEME.DARK;
    document.documentElement.dataset.theme = nextTheme;

    if (readLocalStorage(STORAGE_KEYS.THEME) !== nextTheme) {
        writeLocalStorage(STORAGE_KEYS.THEME, nextTheme);
    }

    document.querySelectorAll('.theme-switcher').forEach(switcher => {
        switcher.dataset.active = nextTheme;
    });

    document.querySelectorAll('.theme-option').forEach(button => {
        const isActive = button.dataset.themeValue === nextTheme;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function enableThemeTransitions() {
    const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 0));
    schedule(() => {
        document.documentElement.classList.add('theme-ready');
    });
}

function clearThemeAnimationState(switcher, button) {
    document.documentElement.classList.remove('theme-changing');
    if (switcher) switcher.classList.remove('is-changing');
    if (button) button.classList.remove('is-pressed');
}

function setThemeTransitionOrigin(button) {
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    document.documentElement.style.setProperty('--theme-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-y', `${y}px`);
}

function animateThemeChange(theme, button) {
    const nextTheme = theme === THEME.LIGHT ? THEME.LIGHT : THEME.DARK;
    if (document.documentElement.dataset.theme === nextTheme) return;

    const switcher = button ? button.closest('.theme-switcher') : null;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mobile / touch device: skip View Transition (clip-path 145vmax + recomposite
    // semua glassmorphic layer = jank di GPU mobile). Gunakan transisi snappy saja.
    const isTouchDevice = window.matchMedia && (
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(max-width: 768px)').matches
    );
    const skipFancyTransition = reduceMotion || isTouchDevice;

    setThemeTransitionOrigin(button);
    if (button) button.classList.add('is-pressed');

    const finish = (delay = 260) => {
        window.setTimeout(() => clearThemeAnimationState(switcher, button), delay);
    };

    if (document.startViewTransition && !skipFancyTransition) {
        document.documentElement.classList.add('theme-changing');
        if (switcher) switcher.classList.add('is-changing');
        const transition = document.startViewTransition(() => applyTheme(nextTheme));
        transition.finished.then(() => finish(), () => finish());
        return;
    }

    // Snappy path: tidak ada view-transition, tidak ada glow/settle animation,
    // hanya CSS transition pendek (lihat .theme-fast di style.css/responsive.css).
    // Cancel timer sebelumnya kalau user spam toggle — cegah class dilepas
    // di tengah transisi click berikutnya.
    document.documentElement.classList.add('theme-fast');
    if (animateThemeChange._fastTimer) {
        window.clearTimeout(animateThemeChange._fastTimer);
    }
    applyTheme(nextTheme);
    animateThemeChange._fastTimer = window.setTimeout(() => {
        document.documentElement.classList.remove('theme-fast');
        animateThemeChange._fastTimer = 0;
    }, 220);
    finish(220);
}

function initThemeSwitcher() {
    const topbarRight = document.querySelector('.topbar-right');
    const authThemeSlot = document.querySelector('.auth-theme-slot');
    const switcherHost = topbarRight || authThemeSlot;
    if (!switcherHost || document.getElementById('theme-switcher')) return;

    const switcher = document.createElement('div');
    switcher.className = 'theme-switcher';
    switcher.id = 'theme-switcher';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Pilih tema tampilan');
    switcher.innerHTML = `
        <button class="theme-option" type="button" data-theme-value="light" aria-pressed="false" aria-label="Tema terang" title="Terang">
            <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="m4.93 4.93 1.41 1.41"></path>
                <path d="m17.66 17.66 1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="m6.34 17.66-1.41 1.41"></path>
                <path d="m19.07 4.93-1.41 1.41"></path>
            </svg>
            <span>Terang</span>
        </button>
        <button class="theme-option" type="button" data-theme-value="dark" aria-pressed="false" aria-label="Tema gelap" title="Gelap">
            <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.99 12.38A8.5 8.5 0 1 1 11.62 3.01 6.5 6.5 0 0 0 20.99 12.38Z"></path>
            </svg>
            <span>Gelap</span>
        </button>
    `;

    const clock = document.getElementById('realtime-clock');
    if (clock && clock.parentElement === topbarRight) {
        clock.insertAdjacentElement('afterend', switcher);
    } else {
        switcherHost.prepend(switcher);
    }
    switcher.addEventListener('click', event => {
        const button = event.target.closest('.theme-option');
        if (!button) return;
        animateThemeChange(button.dataset.themeValue, button);
    });

    applyTheme(getSavedTheme());
}

// Threshold disimpan di localStorage supaya tetap aktif setelah refresh.
const ThresholdManager = {
    DEFAULT_LOWER: 40,
    DEFAULT_UPPER: 70,

    get lower() {
        const lower = clampPercent(readLocalStorage(STORAGE_KEYS.THRESHOLD_LOWER), this.DEFAULT_LOWER);
        const upper = this.upper;
        return lower < upper ? lower : this.DEFAULT_LOWER;
    },
    get upper() {
        const upper = clampPercent(readLocalStorage(STORAGE_KEYS.THRESHOLD_UPPER), this.DEFAULT_UPPER);
        const rawLower = clampPercent(readLocalStorage(STORAGE_KEYS.THRESHOLD_LOWER), this.DEFAULT_LOWER);
        return rawLower < upper ? upper : this.DEFAULT_UPPER;
    },
    set lower(val) {
        writeLocalStorage(STORAGE_KEYS.THRESHOLD_LOWER, String(clampPercent(val, this.DEFAULT_LOWER)));
    },
    set upper(val) {
        writeLocalStorage(STORAGE_KEYS.THRESHOLD_UPPER, String(clampPercent(val, this.DEFAULT_UPPER)));
    },
    reset() {
        removeLocalStorage(STORAGE_KEYS.THRESHOLD_LOWER);
        removeLocalStorage(STORAGE_KEYS.THRESHOLD_UPPER);
    },
    getActiveString() {
        return `${this.lower}%-${this.upper}%`;
    }
};

function getCurrentValveState() {
    return readLocalStorage(STORAGE_KEYS.VALVE_STATE, VALVE_STATE.CLOSED);
}

function saveValveState(state) {
    writeLocalStorage(STORAGE_KEYS.VALVE_STATE, state);
}

// Logika keputusan irigasi berdasarkan threshold aktif dan cuaca BMKG.
function makeIrrigationDecision(soilMoisture, rainPrediction) {
    const lower = ThresholdManager.lower;
    const upper = ThresholdManager.upper;
    const currentValveState = getCurrentValveState();
    const isDry = soilMoisture < lower;
    const isWet = soilMoisture > upper;

    let result;

    if (isDry && !rainPrediction) {
        result = {
            valve: VALVE_STATE.OPEN,
            decision: 'Irigasi dijalankan',
            type: DECISION_TYPE.OPEN,
            reason: `Kelembapan tanah (${soilMoisture}%) berada di bawah threshold bawah (${lower}%) dan tidak ada prediksi hujan 3 jam ke depan, maka valve dibuka.`
        };
    } else if (isDry && rainPrediction) {
        result = {
            valve: VALVE_STATE.CLOSED,
            decision: 'Irigasi ditunda',
            type: DECISION_TYPE.DELAYED,
            reason: `Kelembapan tanah (${soilMoisture}%) berada di bawah threshold bawah (${lower}%), namun BMKG memprediksi hujan dalam 3 jam ke depan. Irigasi ditunda untuk mencegah pemborosan air.`
        };
    } else if (isWet) {
        result = {
            valve: VALVE_STATE.CLOSED,
            decision: 'Irigasi dihentikan',
            type: DECISION_TYPE.CLOSED,
            reason: `Kelembapan tanah (${soilMoisture}%) berada di atas threshold atas (${upper}%). Tanah terlalu basah, valve ditutup.`
        };
    } else {
        // Histeresis: di rentang normal, valve mengikuti status sebelumnya.
        if (currentValveState === VALVE_STATE.OPEN) {
            result = {
                valve: VALVE_STATE.OPEN,
                decision: 'Irigasi dilanjutkan',
                type: DECISION_TYPE.OPEN,
                reason: `Kelembapan tanah (${soilMoisture}%) berada dalam rentang normal (${lower}%-${upper}%). Valve dipertahankan terbuka karena sedang dalam proses irigasi.`
            };
        } else {
            result = {
                valve: VALVE_STATE.CLOSED,
                decision: 'Kondisi normal',
                type: DECISION_TYPE.NORMAL,
                reason: `Kelembapan tanah (${soilMoisture}%) berada dalam rentang normal (${lower}%-${upper}%). Tidak ada tindakan diperlukan.`
            };
        }
    }

    saveValveState(result.valve);
    return result;
}

function getSoilStatus(value) {
    const lower = ThresholdManager.lower;
    const upper = ThresholdManager.upper;
    if (value <= 0) return { label: 'Tidak Ada Data', color: 'gray', className: 'status-offline' };
    if (value < lower) return { label: 'Butuh Irigasi', color: 'red', className: 'status-danger' };
    if (value > upper) return { label: 'Terlalu Basah', color: 'yellow', className: 'status-wet' };
    return { label: 'Normal', color: 'green', className: 'status-ok' };
}

function getNodeStatusBadge(status) {
    const map = {
        online: { label: 'Online', className: 'badge-green' },
        standby: { label: 'Standby', className: 'badge-yellow' },
        offline: { label: 'Offline', className: 'badge-red' }
    };
    return map[status] || map.offline;
}

function getGatewayStatusBadge(status) {
    const map = {
        online: { label: 'Online', className: 'badge-green' },
        offline: { label: 'Offline', className: 'badge-red' },
        degraded: { label: 'Gangguan', className: 'badge-yellow' }
    };
    return map[status] || map.offline;
}

function getValveStatusBadge(valve) {
    const map = {
        Terbuka: { label: 'Terbuka', className: 'badge-green' },
        Tertutup: { label: 'Tertutup', className: 'badge-yellow' },
        'Tidak diketahui': { label: 'Tidak diketahui', className: 'badge-red' }
    };
    return map[valve] || map['Tidak diketahui'];
}

function getIrrigationStatusBadge(status) {
    if (status === 'Aktif') return { label: status, className: 'badge-green' };
    if (status === 'Normal') return { label: status, className: 'badge-green' };
    if (status === 'Perlu cek gateway') return { label: status, className: 'badge-red' };
    return { label: status || 'Perlu cek', className: 'badge-yellow' };
}

function getFarmById(farmId) {
    if (typeof FARMS === 'undefined' || !Array.isArray(FARMS)) return null;
    return FARMS.find(farm => farm.id === farmId) || null;
}

function getFarmNodes(farm) {
    if (!farm || typeof NODES === 'undefined' || !Array.isArray(NODES)) return [];
    const nodeIds = Array.isArray(farm.nodeIds) ? farm.nodeIds : [];
    return NODES.filter(node => node.farmId === farm.id || nodeIds.includes(node.id));
}

function getFarmNodeStats(farm) {
    const nodes = getFarmNodes(farm);
    const active = nodes.filter(node => node.status === 'online' || node.status === 'standby').length;
    const troubled = nodes.filter(node => node.status === 'offline').length;
    return { total: nodes.length, active, troubled };
}

function getFarmAverageMoisture(farm) {
    const validNodes = getFarmNodes(farm).filter(node => node.status !== 'offline' && node.soilMoisture > 0);
    if (!validNodes.length) return null;
    const total = validNodes.reduce((sum, node) => sum + node.soilMoisture, 0);
    return Math.round(total / validNodes.length);
}

function getFarmLastUpdate(farm) {
    const dates = [farm && farm.lastUpdate, ...getFarmNodes(farm).map(node => node.lastUpdate)].filter(Boolean);
    if (!dates.length) return null;
    return dates.reduce((latest, date) => {
        const nextTime = new Date(date).getTime();
        const latestTime = new Date(latest).getTime();
        if (!Number.isFinite(nextTime)) return latest;
        if (!Number.isFinite(latestTime)) return date;
        return nextTime > latestTime ? date : latest;
    }, dates[0]);
}

function getSelectedFarmId() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('farm');
    if (fromUrl && getFarmById(fromUrl)) return fromUrl;
    const savedFarmId = readLocalStorage(STORAGE_KEYS.SELECTED_FARM);
    return getFarmById(savedFarmId) ? savedFarmId : null;
}

function setSelectedFarmId(farmId) {
    if (!getFarmById(farmId)) return;
    writeLocalStorage(STORAGE_KEYS.SELECTED_FARM, farmId);
}

function getCurrentFarm() {
    if (typeof FARMS === 'undefined' || !Array.isArray(FARMS) || !FARMS.length) return null;
    return getFarmById(getSelectedFarmId()) || FARMS[0];
}

function getDecisionBadge(type) {
    const map = {
        [DECISION_TYPE.OPEN]: { label: 'Irigasi Dijalankan', className: 'badge-green' },
        [DECISION_TYPE.DELAYED]: { label: 'Irigasi Ditunda', className: 'badge-yellow' },
        [DECISION_TYPE.CLOSED]: { label: 'Valve Tertutup', className: 'badge-yellow' },
        [DECISION_TYPE.NORMAL]: { label: 'Normal', className: 'badge-green' },
        [DECISION_TYPE.WARNING]: { label: 'Peringatan', className: 'badge-red' }
    };
    return map[type] || map[DECISION_TYPE.NORMAL];
}

function getWeatherInfo(code) {
    const weatherCodes = typeof WEATHER_CODES !== 'undefined' && Array.isArray(WEATHER_CODES) ? WEATHER_CODES : [];
    return weatherCodes.find(w => w.code === code) || {
        code,
        label: 'Tidak diketahui',
        icon: 'fas fa-circle-question',
        isRain: false
    };
}

function renderWeatherIcon(info) {
    return `<i class="${escapeHtml(info.icon)}" aria-hidden="true"></i>`;
}

function setWeatherIcon(elementId, info) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = renderWeatherIcon(info);
    el.setAttribute('aria-label', info.label);
}

function startClock() {
    const el = document.getElementById('realtime-clock');
    if (!el) return;

    el.innerHTML = `
        <svg class="topbar-clock-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
        </svg>
        <span class="topbar-clock-time"></span>
    `;
    const timeEl = el.querySelector('.topbar-clock-time');

    function tick() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = now.toLocaleDateString('id-ID', options);
        const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (timeEl) timeEl.textContent = time;
        el.title = `${date} - ${time}`;
        el.setAttribute('aria-label', `${date} - ${time}`);

        const nextSecondDelay = 1000 - now.getMilliseconds();
        window.setTimeout(tick, nextSecondDelay);
    }

    tick();
}

// Helper: jadwalkan DOM update di frame berikutnya untuk mencegah layout thrashing.
function scheduleUpdate(fn) {
    requestAnimationFrame(fn);
}

const FARM_NAV_ITEMS = [
    { href: 'farm-detail.html', icon: 'fas fa-th-large', label: 'Dashboard' },
    { href: 'monitoring.html', icon: 'fas fa-chart-area', label: 'Monitoring' },
    { href: 'irrigation.html', icon: 'fas fa-tint', label: 'Irigasi' },
    { href: 'gateway.html', icon: 'fas fa-tower-broadcast', label: 'Gateway' },
    { href: 'nodes.html', icon: 'fas fa-microchip', label: 'Node Sensor' },
    { href: 'weather.html', icon: 'fas fa-cloud-sun', label: 'Cuaca' },
    { href: 'logs.html', icon: 'fas fa-list-alt', label: 'Riwayat' }
];

const SELECTOR_NAV_ITEMS = [
    { href: 'index.html', icon: 'fas fa-map-location-dot', label: 'Kebun Saya' },
    { href: 'settings.html', icon: 'fas fa-user-gear', label: 'Pengaturan Akun' }
];

const FARM_PAGE_PATHS = new Set([
    'farm-detail.html',
    'monitoring.html',
    'irrigation.html',
    'gateway.html',
    'nodes.html',
    'weather.html',
    'logs.html'
]);

function getCurrentPagePath() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function getSidebarContext() {
    return FARM_PAGE_PATHS.has(getCurrentPagePath()) ? 'farm' : 'selector';
}

function getFarmScopedHref(href) {
    if (href === 'settings.html') return href;
    const farm = getCurrentFarm();
    if (!farm || !farm.id) return href;
    return `${href}?farm=${encodeURIComponent(farm.id)}`;
}

function renderContextSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    const context = getSidebarContext();
    const items = context === 'farm' ? FARM_NAV_ITEMS : SELECTOR_NAV_ITEMS;
    nav.innerHTML = items.map(item => {
        const href = context === 'farm' ? getFarmScopedHref(item.href) : item.href;
        return `<a href="${escapeHtml(href)}" class="sidebar-link"><i class="${escapeHtml(item.icon)}" aria-hidden="true"></i><span class="sidebar-label">${escapeHtml(item.label)}</span></a>`;
    }).join('');
}

function renderFarmSwitcher() {
    if (getSidebarContext() !== 'farm') return;

    const topbarLeft = document.querySelector('.topbar-left');
    const farm = getCurrentFarm();
    if (!topbarLeft || !farm || document.getElementById('farm-switcher')) return;

    const switcher = document.createElement('a');
    switcher.className = 'farm-switcher';
    switcher.id = 'farm-switcher';
    switcher.href = 'index.html';
    switcher.innerHTML = `
        <i class="fas fa-map-location-dot" aria-hidden="true"></i>
        <span class="farm-switcher-copy">
            <span class="farm-switcher-name">${escapeHtml(farm.name)}</span>
            <span class="farm-switcher-action">Ganti Kebun</span>
        </span>
    `;
    topbarLeft.appendChild(switcher);
}

function renderTopbarUser() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    const existingProfile = document.getElementById('topbar-user');
    if (existingProfile) {
        if (existingProfile.tagName.toLowerCase() === 'a') {
            existingProfile.className = 'topbar-user';
            existingProfile.href = 'settings.html';
            existingProfile.setAttribute('aria-label', 'Akun Pak Budi');
            existingProfile.innerHTML = getTopbarUserMarkup();
            return;
        }

        const replacement = document.createElement('a');
        replacement.className = 'topbar-user';
        replacement.id = 'topbar-user';
        replacement.href = 'settings.html';
        replacement.setAttribute('aria-label', 'Akun Pak Budi');
        replacement.innerHTML = getTopbarUserMarkup();
        existingProfile.replaceWith(replacement);
        return;
    }

    const profile = document.createElement('a');
    profile.className = 'topbar-user';
    profile.id = 'topbar-user';
    profile.href = 'settings.html';
    profile.setAttribute('aria-label', 'Akun Pak Budi');
    profile.innerHTML = getTopbarUserMarkup();

    const switcher = document.getElementById('theme-switcher');
    if (switcher && switcher.parentElement === topbarRight) {
        switcher.insertAdjacentElement('afterend', profile);
    } else {
        topbarRight.appendChild(profile);
    }
}

function getTopbarUserMarkup() {
    return `
        <svg class="topbar-user-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 21a8 8 0 0 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Pak Budi</span>
    `;
}

function setActivePage() {
    const path = getCurrentPagePath();
    const activeMap = {
        'farms.html': 'index.html'
    };
    const activePath = activeMap[path] || path;
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');

        const href = link.getAttribute('href');
        const hrefPath = (href || '').split('?')[0].split('#')[0];
        if (hrefPath === activePath || (activePath === '' && hrefPath === 'index.html')) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
}

function initSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!toggle || !sidebar) return;

    toggle.setAttribute('aria-expanded', 'false');

    const setOpen = isOpen => {
        sidebar.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
        if (overlay) overlay.classList.toggle('active', isOpen);
        // Kunci scroll body saat drawer terbuka di mobile agar tidak double-scroll.
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    toggle.addEventListener('click', () => {
        setOpen(!sidebar.classList.contains('open'));
    });

    if (overlay) {
        overlay.addEventListener('click', () => setOpen(false));
    }

    // Tutup dengan tombol ESC.
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
            setOpen(false);
        }
    });

    // Tutup otomatis saat memilih menu (UX standar mobile drawer).
    sidebar.querySelectorAll('a.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 768px)').matches) {
                setOpen(false);
            }
        });
    });

    // Reset state saat resize dari mobile ke desktop.
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (!window.matchMedia('(max-width: 768px)').matches) {
                setOpen(false);
            }
        }, 120);
    });

    // Swipe-to-close: geser ke kiri saat drawer terbuka.
    let touchStartX = 0;
    let touchStartY = 0;
    let tracking = false;

    sidebar.addEventListener('touchstart', event => {
        if (!sidebar.classList.contains('open')) return;
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        tracking = true;
    }, { passive: true });

    sidebar.addEventListener('touchmove', event => {
        if (!tracking) return;
        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = Math.abs(touch.clientY - touchStartY);
        // Hanya horizontal swipe yang dianggap gesture close.
        if (deltaX < -60 && deltaY < 40) {
            setOpen(false);
            tracking = false;
        }
    }, { passive: true });

    sidebar.addEventListener('touchend', () => {
        tracking = false;
    }, { passive: true });
}

function timeAgo(date) {
    if (!date) return 'Tidak tersedia';
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return 'Tidak tersedia';

    const diff = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);
    if (diff < 5) return 'Baru saja';
    if (diff < 60) return `${diff} detik lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getSavedTheme());
    startClock();
    renderContextSidebar();
    renderFarmSwitcher();
    setActivePage();
    initSidebar();
    initThemeSwitcher();
    renderTopbarUser();
    enableThemeTransitions();
});
