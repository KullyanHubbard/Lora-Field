// Fungsi utama shared antar halaman

const DEG_C = '\u00B0C';

// Threshold disimpan di localStorage supaya tetap aktif setelah refresh.
const ThresholdManager = {
    DEFAULT_LOWER: 40,
    DEFAULT_UPPER: 70,

    get lower() {
        const value = Number.parseInt(localStorage.getItem('lf_threshold_lower'), 10);
        return Number.isFinite(value) ? value : this.DEFAULT_LOWER;
    },
    get upper() {
        const value = Number.parseInt(localStorage.getItem('lf_threshold_upper'), 10);
        return Number.isFinite(value) ? value : this.DEFAULT_UPPER;
    },
    set lower(val) {
        localStorage.setItem('lf_threshold_lower', String(val));
    },
    set upper(val) {
        localStorage.setItem('lf_threshold_upper', String(val));
    },
    reset() {
        localStorage.removeItem('lf_threshold_lower');
        localStorage.removeItem('lf_threshold_upper');
    },
    getActiveString() {
        return `${this.lower}%-${this.upper}%`;
    }
};

// Logika keputusan irigasi berdasarkan threshold aktif dan cuaca BMKG.
function makeIrrigationDecision(soilMoisture, rainPrediction) {
    const lower = ThresholdManager.lower;
    const upper = ThresholdManager.upper;
    
    let currentValveState = localStorage.getItem('lf_valve_state') || 'Tertutup';
    let result;

    if (soilMoisture < lower && !rainPrediction) {
        result = {
            valve: 'Terbuka',
            decision: 'Irigasi dijalankan',
            type: 'open',
            reason: `Kelembapan tanah (${soilMoisture}%) berada di bawah threshold bawah (${lower}%) dan tidak ada prediksi hujan 3 jam ke depan, maka valve dibuka.`
        };
    } else if (soilMoisture < lower && rainPrediction) {
        result = {
            valve: 'Tertutup',
            decision: 'Irigasi ditunda',
            type: 'delayed',
            reason: `Kelembapan tanah (${soilMoisture}%) berada di bawah threshold bawah (${lower}%), namun BMKG memprediksi hujan dalam 3 jam ke depan. Irigasi ditunda untuk mencegah pemborosan air.`
        };
    } else if (soilMoisture > upper) {
        result = {
            valve: 'Tertutup',
            decision: 'Irigasi dihentikan',
            type: 'closed',
            reason: `Kelembapan tanah (${soilMoisture}%) berada di atas threshold atas (${upper}%). Tanah terlalu basah, valve ditutup.`
        };
    } else {
        // Hysteresis logic: maintain previous state inside the normal band
        if (currentValveState === 'Terbuka') {
            result = {
                valve: 'Terbuka',
                decision: 'Irigasi dilanjutkan',
                type: 'open',
                reason: `Kelembapan tanah (${soilMoisture}%) berada dalam rentang normal (${lower}%-${upper}%). Valve dipertahankan terbuka karena sedang dalam proses irigasi.`
            };
        } else {
            result = {
                valve: 'Tertutup',
                decision: 'Kondisi normal',
                type: 'normal',
                reason: `Kelembapan tanah (${soilMoisture}%) berada dalam rentang normal (${lower}%-${upper}%). Tidak ada tindakan diperlukan.`
            };
        }
    }

    localStorage.setItem('lf_valve_state', result.valve);
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
        open: { label: 'Irigasi Dijalankan', className: 'badge-green' },
        delayed: { label: 'Irigasi Ditunda', className: 'badge-yellow' },
        closed: { label: 'Valve Tertutup', className: 'badge-blue' },
        normal: { label: 'Normal', className: 'badge-blue' },
        warning: { label: 'Warning', className: 'badge-red' }
    };
    return map[type] || map.normal;
}

function getValveBadge(valve) {
    if (valve === 'Terbuka') return 'badge-green';
    if (valve === 'Ditunda') return 'badge-yellow';
    return 'badge-blue';
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
