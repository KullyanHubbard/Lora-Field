# Codex Audit & Fix Prompt — LoraField Frontend Pages

## Konteks Proyek

LoraField adalah web dashboard monitoring pertanian berbasis LoRa. Stack:
- Backend: FastAPI + SQLite di `backend/app/main.py`
- Frontend: HTML/CSS/JS vanilla di `frontend/public/static/`

### File shared (jangan diubah strukturnya):
- `js/dummy-data.js` — data fallback, mendefinisikan global `const FARMS`, `const NODES`, `const WEATHER_DATA`, `const DECISION_LOGS`
- `js/api.js` — layer koneksi ke backend, menyediakan `loadFarmsFromAPI(userId)` dan `loadFarmSummaryFromAPI(farmId)`, keduanya **async** dan memutasi array global di atas
- `js/main.js` — helper shared: `getCurrentFarm()`, `getFarmNodes()`, `getSelectedFarmId()`, `renderFarmSwitcher()`, `renderContextSidebar()`, `setActivePage()`, dll.
- `js/simulation.js` — simulasi sensor, menyediakan `startSimulation()`, `simulateCondition()`, `isRainPredicted()`
- `js/charts.js` — chart helpers untuk monitoring

### Konstanta penting:
- `CURRENT_USER_ID = 'user-01'` (didefinisikan di `api.js`)
- `DEG_C` = string derajat Celsius (di `main.js`)

### API Backend endpoints yang relevan:
- `GET /api/farms?user_id=user-01` → list kebun user
- `GET /api/farms/{farm_id}/summary` → farm + nodes + weather + decisions
- `GET /api/farms/{farm_id}/weather` → cuaca BMKG per kebun
- `GET /api/logs?limit=50` → decision logs dari DB (format: `{id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at}`)
- `GET /api/nodes?farm_id={farm_id}` → list node per kebun

---

## Root Cause Bug (Semua Halaman)

**Semua halaman di bawah ini mengalami bug yang sama:**

`DOMContentLoaded` dipanggil **synchronous** tanpa await API. Akibatnya:
1. `getCurrentFarm()` dipanggil sebelum `FARMS` diisi data real dari backend
2. `getFarmById(farmId_dari_URL)` gagal karena FARMS masih berisi dummy data (ID: `salak-bantul`, `cabai-sleman`) — bukan ID backend (`farm-01`, `farm-02`)
3. Data yang ditampilkan adalah dummy, bukan dari API

**Fix pattern yang harus diterapkan di SEMUA halaman:**

```javascript
// SEBELUM (salah):
document.addEventListener('DOMContentLoaded', () => {
    renderSomething();
    startSimulation();
});

// SESUDAH (benar):
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);

    // Refresh farm switcher & sidebar (main.js sempat render sebelum API selesai)
    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    renderSomething();       // render utama halaman ini
    startSimulation();       // jika halaman pakai simulasi
});
```

**Script tag api.js harus ditambahkan ke setiap halaman:**
```html
<!-- Tambahkan setelah dummy-data.js, sebelum main.js -->
<script src="js/dummy-data.js"></script>
<script src="js/api.js"></script>   <!-- TAMBAHKAN INI -->
<script src="js/main.js"></script>
```

---

## Halaman yang Harus Difix

### 1. `monitoring.html`

**Bug:**
- Tidak ada `<script src="js/api.js"></script>`
- `DOMContentLoaded` synchronous → `getMonitoringNodes()` returns node dummy atau kosong
- `getFarmNodes(getCurrentFarm())` gagal resolve farm dari URL karena FARMS belum diisi API

**Fix yang diperlukan:**
1. Tambah `<script src="js/api.js"></script>` setelah `dummy-data.js`
2. Ubah `DOMContentLoaded` menjadi async dengan pattern di atas
3. Panggil `initMonitoringFilters()` dan `initMonitoringCharts()` setelah await API selesai
4. Jaga `startSimulation()` tetap dipanggil setelah render

**Urutan yang benar setelah fix:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);

    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    initMonitoringFilters();
    document.getElementById('monitoring-refresh').addEventListener('click', updateMonitoringUI);
    initMonitoringCharts();
    updateMonitoringUI();
    startSimulation();
});
```

---

### 2. `irrigation.html`

**Bug:**
- Tidak ada `<script src="js/api.js"></script>`
- `DOMContentLoaded` synchronous
- `getCurrentFarm()` dan `getFarmNodes()` resolve ke dummy data
- `isRainPredicted()` membaca `WEATHER_DATA` dummy (bukan dari BMKG)

**Fix yang diperlukan:**
1. Tambah `<script src="js/api.js"></script>`
2. Ubah `DOMContentLoaded` menjadi async dengan pattern di atas
3. Jaga `startSimulation()` tetap dipanggil setelah render

**Urutan yang benar setelah fix:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);

    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    document.querySelectorAll('[data-sim-condition]').forEach(button => {
        button.addEventListener('click', () => simulateCondition(button.dataset.simCondition));
    });
    updateIrrigationUI();
    startSimulation();
});
```

---

### 3. `gateway.html`

**Bug:**
- Tidak ada `<script src="js/api.js"></script>`
- `DOMContentLoaded` synchronous, langsung `renderGateways()`
- `farm.gateway` masih object dummy (`{id: 'gw-salak-bantul', internet: 'WiFi', ...}`)
- Tidak ada refresh periodik

**Fix yang diperlukan:**
1. Tambah `<script src="js/api.js"></script>`
2. Ubah `DOMContentLoaded` menjadi async
3. Jaga `renderGateways()` dipanggil setelah await API (data `farm.gateway.status` dan `farm.gateway.lastSeen` sudah diisi oleh `loadFarmSummaryFromAPI`)

**Urutan yang benar:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);

    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    renderGateways();
    // Catatan: gateway.html tidak perlu startSimulation()
});
```

---

### 4. `nodes.html`

**Bug:**
- Tidak ada `<script src="js/api.js"></script>`
- `DOMContentLoaded` synchronous, langsung `renderNodes()`
- `getFarmNodes(getCurrentFarm())` returns dummy nodes (ID: '01', '02') bukan backend nodes (ID: 'node-01', 'node-02')
- `node.rssi` selalu `null` (belum ditrack di backend) — tampilkan `-` bukan error

**Fix yang diperlukan:**
1. Tambah `<script src="js/api.js"></script>`
2. Ubah `DOMContentLoaded` menjadi async

**Urutan yang benar:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);

    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    renderNodes();
    // Catatan: nodes.html tidak perlu startSimulation()
});
```

---

### 5. `weather.html`

**Bug:**
- Tidak ada `<script src="js/api.js"></script>`
- `DOMContentLoaded` synchronous
- `updateWeatherUI()` membaca langsung dari `WEATHER_DATA` dummy
- Cuaca yang tampil bukan dari BMKG real, melainkan data statis (`{temp: 29, condition: 'Berawan', ...}`)
- Setelah `loadFarmSummaryFromAPI` selesai, `WEATHER_DATA` sudah diisi data BMKG real — tinggal panggil `updateWeatherUI()` setelah await

**Fix yang diperlukan:**
1. Tambah `<script src="js/api.js"></script>`
2. Ubah `DOMContentLoaded` menjadi async
3. Alternatif lebih akurat: fetch langsung ke `/api/farms/{farmId}/weather` dan isi `WEATHER_DATA` dari response itu sebelum `updateWeatherUI()`. Gunakan helper `normalizeWeather()` dari `api.js` untuk konversi format.

**Urutan yang benar (pakai summary yang sudah diload):**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);
    // WEATHER_DATA sudah diisi dari summary di atas

    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    renderWeatherCodes();
    updateWeatherUI();
    startSimulation();
});
```

---

### 6. `logs.html`

**Bug:**
- Tidak ada `<script src="js/api.js"></script>`
- `DOMContentLoaded` synchronous
- `getScopedLogs()` memfilter `DECISION_LOGS` dummy berdasarkan `farmNodeNames`
- Node names dummy: `'Node 01'`, `'Node 02'` — bisa cocok dengan data backend
- **Bug utama:** Logs ditampilkan dari `DECISION_LOGS` (in-memory, hanya simulasi) — bukan dari `/api/logs` backend
- Format log API berbeda dari format dummy: API tidak punya field `time` (hanya `created_at`), tidak punya `threshold`, tidak punya `soilTemp` dari log itu sendiri, tidak punya `type` (hanya `valve_state` dan `decision`)

**Fix yang diperlukan:**
1. Tambah `<script src="js/api.js"></script>`
2. Ubah `DOMContentLoaded` menjadi async
3. Fetch logs dari `/api/logs?limit=50` setelah API farms/summary loaded
4. Map format API log ke format yang dipakai `renderLogs()`:

```javascript
// Mapping API log → format frontend
function mapApiLog(apiLog) {
    const dt = new Date(apiLog.created_at);
    const time = isNaN(dt) ? apiLog.created_at : dt.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Tentukan type dari valve_state dan decision
    let type = 'normal';
    if (apiLog.valve_state === 'open') type = 'open';
    else if (apiLog.decision && apiLog.decision.toLowerCase().includes('ditunda')) type = 'delayed';
    else if (apiLog.valve_state === 'closed' && apiLog.decision && apiLog.decision.toLowerCase().includes('berhenti')) type = 'closed';

    return {
        time,
        node: apiLog.node_id,       // node_id dari backend
        location: apiLog.node_id,   // tidak ada location di log API, fallback ke node_id
        soilMoisture: apiLog.soil_moisture,
        threshold: `${ThresholdManager.lower}%-${ThresholdManager.upper}%`,
        soilTemp: '—',              // tidak ada di log API
        weather: apiLog.weather || '—',
        weatherCode: '-',
        decision: apiLog.decision,
        valve: apiLog.valve_state === 'open' ? 'Terbuka' : 'Tertutup',
        type,
        note: apiLog.reason || '—'
    };
}
```

5. Setelah fetch, **replace** isi `DECISION_LOGS` dengan hasil mapping:
```javascript
const logsRes = await fetch(`${API_BASE}/api/logs?limit=50`);
if (logsRes.ok) {
    const logsData = await logsRes.json();
    DECISION_LOGS.length = 0;
    (logsData.items || []).map(mapApiLog).forEach(l => DECISION_LOGS.push(l));
}
```

6. `getScopedLogs()` perlu disesuaikan karena log API menggunakan `node_id` (`node-01`) bukan nama node (`Node 01`). Filter berdasarkan node IDs dari farm, bukan nama:
```javascript
function getScopedLogs() {
    const farm = getCurrentFarm();
    // Gunakan nodeIds dari farm (array of node IDs seperti 'node-01', 'node-02')
    const farmNodeIds = new Set(farm ? (farm.nodeIds || []) : []);
    // Fallback: juga cek nama node jika log masih format dummy
    const farmNodeNames = new Set(getFarmNodes(farm).map(node => node.name));
    return DECISION_LOGS.filter(log =>
        farmNodeIds.has(log.node) || farmNodeNames.has(log.node)
    );
}
```

**Urutan yang benar:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const farmId = urlParams.get('farm');

    await loadFarmsFromAPI(CURRENT_USER_ID);
    if (farmId) await loadFarmSummaryFromAPI(farmId);

    // Load logs real dari backend
    try {
        const logsRes = await fetch(`${API_BASE}/api/logs?limit=50`);
        if (logsRes.ok) {
            const logsData = await logsRes.json();
            DECISION_LOGS.length = 0;
            (logsData.items || []).map(mapApiLog).forEach(l => DECISION_LOGS.push(l));
        }
    } catch (err) {
        console.warn('[LoraField] Gagal load logs dari API, pakai data lokal:', err.message);
    }

    const oldSwitcher = document.getElementById('farm-switcher');
    if (oldSwitcher) oldSwitcher.remove();
    renderFarmSwitcher();
    renderContextSidebar();
    setActivePage();

    document.getElementById('btn-export-csv').addEventListener('click', exportLogsCSV);
    renderLogs();
    startSimulation();
});
```

---

## Checklist Setelah Fix

Untuk setiap halaman, verifikasi:
- [ ] `<script src="js/api.js"></script>` ada di antara `dummy-data.js` dan `main.js`
- [ ] `DOMContentLoaded` sudah `async`
- [ ] Ada `await loadFarmsFromAPI(CURRENT_USER_ID)` sebelum render
- [ ] Ada `await loadFarmSummaryFromAPI(farmId)` sebelum render (jika farmId ada di URL)
- [ ] Farm switcher di-remove dan di-render ulang setelah API selesai
- [ ] `renderContextSidebar()` dan `setActivePage()` dipanggil ulang setelah API selesai
- [ ] Render utama halaman dipanggil **setelah** semua await selesai
- [ ] `startSimulation()` dipanggil terakhir (hanya untuk halaman yang perlu: monitoring, irrigation, weather, logs)
- [ ] Tidak ada error di browser console terkait `getCurrentFarm()` returns null atau wrong farm

## Hal yang JANGAN Diubah

- Jangan ubah struktur HTML, CSS class, atau ID elemen apapun
- Jangan ubah logika di `js/main.js`, `js/simulation.js`, `js/charts.js`, `js/dummy-data.js`
- Jangan ubah `renderLogs()`, `updateMonitoringUI()`, `renderGateways()`, `renderNodes()`, `updateWeatherUI()`, `updateIrrigationUI()` — hanya ubah **kapan** mereka dipanggil (setelah await API)
- Pertahankan fallback ke dummy data jika API gagal (sudah dihandle di `api.js`)
- Jangan hapus `startSimulation()` dari halaman yang sudah memanggilnya
