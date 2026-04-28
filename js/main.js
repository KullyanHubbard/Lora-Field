// Fungsi utama shared antar halaman

const DEG_C = '\u00B0C';

const STORAGE_KEYS = {
    THRESHOLD_LOWER: 'lf_threshold_lower',
    THRESHOLD_UPPER: 'lf_threshold_upper',
    VALVE_STATE: 'lf_valve_state'
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

// Threshold disimpan di localStorage supaya tetap aktif setelah refresh.
const ThresholdManager = {
    DEFAULT_LOWER: 40,
    DEFAULT_UPPER: 70,

    get lower() {
        const value = Number.parseInt(localStorage.getItem(STORAGE_KEYS.THRESHOLD_LOWER), 10);
        return Number.isFinite(value) ? value : this.DEFAULT_LOWER;
    },
    get upper() {
        const value = Number.parseInt(localStorage.getItem(STORAGE_KEYS.THRESHOLD_UPPER), 10);
        return Number.isFinite(value) ? value : this.DEFAULT_UPPER;
    },
    set lower(val) {
        localStorage.setItem(STORAGE_KEYS.THRESHOLD_LOWER, String(val));
    },
    set upper(val) {
        localStorage.setItem(STORAGE_KEYS.THRESHOLD_UPPER, String(val));
    },
    reset() {
        localStorage.removeItem(STORAGE_KEYS.THRESHOLD_LOWER);
        localStorage.removeItem(STORAGE_KEYS.THRESHOLD_UPPER);
    },
    getActiveString() {
        return `${this.lower}%-${this.upper}%`;
    }
};

function getCurrentValveState() {
    return localStorage.getItem(STORAGE_KEYS.VALVE_STATE) || VALVE_STATE.CLOSED;
}

function saveValveState(state) {
    localStorage.setItem(STORAGE_KEYS.VALVE_STATE, state);
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
    if (value > upper) return { label: 'Terlalu Basah', color: 'blue', className: 'status-wet' };
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

function getDecisionBadge(type) {
    const map = {
        [DECISION_TYPE.OPEN]: { label: 'Irigasi Dijalankan', className: 'badge-green' },
        [DECISION_TYPE.DELAYED]: { label: 'Irigasi Ditunda', className: 'badge-yellow' },
        [DECISION_TYPE.CLOSED]: { label: 'Valve Tertutup', className: 'badge-blue' },
        [DECISION_TYPE.NORMAL]: { label: 'Normal', className: 'badge-blue' },
        [DECISION_TYPE.WARNING]: { label: 'Warning', className: 'badge-red' }
    };
    return map[type] || map[DECISION_TYPE.NORMAL];
}

function getWeatherInfo(code) {
    return WEATHER_CODES.find(w => w.code === code) || {
        code,
        label: 'Tidak diketahui',
        icon: 'fas fa-circle-question',
        isRain: false
    };
}

function renderWeatherIcon(info) {
    return `<i class="${info.icon}" aria-hidden="true"></i>`;
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

    function tick() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = now.toLocaleDateString('id-ID', options);
        const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.textContent = `${date} - ${time}`;
    }

    tick();
    setInterval(tick, 1000);
}

function setActivePage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');

        const href = link.getAttribute('href');
        if (href === path || (path === '' && href === 'index.html')) {
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

    toggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        if (overlay) overlay.classList.toggle('active', isOpen);
    });

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
        });
    }
}

function timeAgo(date) {
    if (!date) return 'Tidak tersedia';
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `${diff} detik lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
}

document.addEventListener('DOMContentLoaded', () => {
    startClock();
    setActivePage();
    initSidebar();
});
