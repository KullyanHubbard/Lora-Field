// Fungsi utama shared antar halaman

// Threshold disimpan di localStorage supaya persist kalau refresh
const ThresholdManager = {
    DEFAULT_LOWER: 40,
    DEFAULT_UPPER: 70,

    get lower() {
        return parseInt(localStorage.getItem('lf_threshold_lower')) || this.DEFAULT_LOWER;
    },
    get upper() {
        return parseInt(localStorage.getItem('lf_threshold_upper')) || this.DEFAULT_UPPER;
    },
    set lower(val) {
        localStorage.setItem('lf_threshold_lower', val);
    },
    set upper(val) {
        localStorage.setItem('lf_threshold_upper', val);
    },
    reset() {
        localStorage.removeItem('lf_threshold_lower');
        localStorage.removeItem('lf_threshold_upper');
    },
    getActiveString() {
        return `${this.lower}%-${this.upper}%`;
    }
};

// Logika keputusan irigasi berdasarkan threshold aktif & cuaca BMKG
function makeIrrigationDecision(soilMoisture, rainPrediction) {
    const lower = ThresholdManager.lower;
    const upper = ThresholdManager.upper;

    if (soilMoisture < lower && !rainPrediction) {
        return { valve: 'Terbuka', decision: 'Irigasi dijalankan', type: 'open', reason: `Kelembapan tanah (${soilMoisture}%) berada di bawah threshold bawah (${lower}%) dan tidak ada prediksi hujan 3 jam ke depan, maka valve dibuka.` };
    }
    if (soilMoisture < lower && rainPrediction) {
        return { valve: 'Tertutup', decision: 'Irigasi ditunda', type: 'delayed', reason: `Kelembapan tanah (${soilMoisture}%) berada di bawah threshold bawah (${lower}%), namun BMKG memprediksi hujan dalam 3 jam ke depan. Irigasi ditunda untuk mencegah pemborosan air.` };
    }
    if (soilMoisture > upper) {
        return { valve: 'Tertutup', decision: 'Irigasi dihentikan', type: 'closed', reason: `Kelembapan tanah (${soilMoisture}%) berada di atas threshold atas (${upper}%). Tanah terlalu basah, valve ditutup.` };
    }
    return { valve: 'Tertutup', decision: 'Kondisi normal', type: 'normal', reason: `Kelembapan tanah (${soilMoisture}%) berada dalam rentang normal (${lower}%-${upper}%). Tidak ada tindakan diperlukan.` };
}

// Cek status kelembapan berdasarkan threshold yang sedang aktif
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
    return WEATHER_CODES.find(w => w.code === code) || { code, label: 'Tidak diketahui', icon: '❓', isRain: false };
}

// Jam real-time di topbar, format Indonesia
function startClock() {
    const el = document.getElementById('realtime-clock');
    if (!el) return;
    function tick() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const date = now.toLocaleDateString('id-ID', options);
        const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.textContent = `${date} • ${time}`;
    }
    tick();
    setInterval(tick, 1000);
}


function setActivePage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path || (path === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}


function initSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
    });
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
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
