/**
 * api.js — Koneksi frontend LoraField ke FastAPI backend.
 *
 * - loadFarmsFromAPI()       → GET /api/farms?user_id=...
 * - loadFarmSummaryFromAPI() → GET /api/farms/{id}/summary
 *
 * Kedua fungsi mengisi array/object global (FARMS, NODES, WEATHER_DATA)
 * yang dideklarasikan di dummy-data.js.
 */

const API_BASE = 'http://localhost:8000';
const CURRENT_USER_ID = 'user-01';

// ---------------------------------------------------------------------------
// Normalisasi response API → format frontend
// ---------------------------------------------------------------------------

/**
 * Normalisasi satu farm dari /api/farms ke shape yang dipakai komponen frontend.
 */
function normalizeFarm(apiFarm) {
    const regionRaw = (apiFarm.location || '').split(',')[0].trim();
    return {
        id: apiFarm.id,
        name: apiFarm.name,
        owner: apiFarm.owner || '',
        location: apiFarm.location || '',
        region: regionRaw,
        crop: apiFarm.crop_type || '',
        area: apiFarm.area_ha != null ? apiFarm.area_ha + ' ha' : '—',
        bmkgCode: apiFarm.bmkg_adm4_code || '',
        latitude: apiFarm.latitude || 0,
        longitude: apiFarm.longitude || 0,
        status: apiFarm.status === 'active' ? 'normal' : (apiFarm.status || 'normal'),
        // Gateway diisi sementara; diperbarui saat loadFarmSummaryFromAPI dipanggil
        gateway: {
            id: 'gw-' + apiFarm.id,
            name: 'Gateway ' + apiFarm.name,
            model: 'LoRa Gateway',
            status: 'online',
            internet: '4G LTE',
            quality: 'Baik',
            lastSeen: new Date()
        },
        nodeIds: [],
        valve: 'Tertutup',
        irrigation: 'Normal',
        weather: '—',
        rainPrediction: false,
        warning: null,
        lastUpdate: apiFarm.updated_at ? new Date(apiFarm.updated_at) : new Date()
    };
}

/**
 * Normalisasi satu node dari /api/farms/{id}/summary ke shape frontend.
 */
function normalizeNode(nodeData) {
    const node = nodeData.node || {};
    const reading = nodeData.latest_reading;
    const decision = nodeData.decision;

    let valveState = 'Tidak diketahui';
    if (decision) {
        valveState = decision.valve_state === 'open' ? 'Terbuka' : 'Tertutup';
    } else if (node.status !== 'offline') {
        valveState = 'Tertutup';
    }

    return {
        id: node.id,
        backendId: node.id,
        name: node.name || node.id,
        farmId: node.farm_id || '',
        location: node.location || '',
        region: node.region || '',
        latitude: node.latitude || 0,
        longitude: node.longitude || 0,
        status: node.status || 'offline',
        frequency: '921.2 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: reading ? reading.soil_moisture : 0,
        soilTemp: reading ? reading.soil_temp : 0,
        airTemp: reading ? reading.air_temp : 0,
        airHumidity: reading ? reading.air_humidity : 0,
        battery: node.battery || 0,
        rssi: null,
        valveState,
        lastUpdate: node.updated_at ? new Date(node.updated_at) : null
    };
}

/**
 * Normalisasi response cuaca BMKG dari summary ke shape WEATHER_DATA.
 * Mapping weather_desc → kode integer yang dipakai WEATHER_CODES frontend.
 */
function normalizeWeather(apiWeather) {
    if (!apiWeather) return null;

    const desc = (apiWeather.condition || '').toLowerCase();
    let code = 3; // default berawan
    if (desc.includes('hujan lebat') || desc.includes('thunderstorm')) code = 63;
    else if (desc.includes('hujan sedang')) code = 61;
    else if (desc.includes('hujan ringan') || desc.includes('hujan') || desc.includes('shower')) code = 60;
    else if (desc.includes('berawan tebal')) code = 4;
    else if (desc.includes('cerah berawan')) code = 2;
    else if (desc.includes('cerah')) code = 0;

    const rawForecast = Array.isArray(apiWeather.forecast) ? apiWeather.forecast.slice(0, 3) : [];
    const forecast = rawForecast.length
        ? rawForecast.map((f, i) => {
              const fd = (f.weather_desc || '').toLowerCase();
              let fc = 3;
              if (fd.includes('hujan lebat')) fc = 63;
              else if (fd.includes('hujan sedang')) fc = 61;
              else if (fd.includes('hujan')) fc = 60;
              else if (fd.includes('berawan tebal')) fc = 4;
              else if (fd.includes('cerah berawan')) fc = 2;
              else if (fd.includes('cerah')) fc = 0;
              return {
                  label: i === 0 ? 'Sekarang' : `+${i * 3} Jam`,
                  condition: f.weather_desc || 'Berawan',
                  code: fc,
                  temp: f.t || apiWeather.temperature || 27
              };
          })
        : [{ label: 'Sekarang', condition: apiWeather.condition || 'Berawan', code, temp: apiWeather.temperature || 27 }];

    return {
        location: apiWeather.location || '',
        status: 'Tersedia',
        lastUpdate: apiWeather.updated_at || 'Baru saja',
        current: {
            temp: apiWeather.temperature || 27,
            humidity: apiWeather.humidity || 75,
            windSpeed: 0,
            condition: apiWeather.condition || 'Berawan',
            code
        },
        forecast,
        rainPrediction: apiWeather.rain_next_3h || false
    };
}

// ---------------------------------------------------------------------------
// Loader utama
// ---------------------------------------------------------------------------

/**
 * Muat daftar kebun user dari API dan isi array FARMS global.
 */
async function loadFarmsFromAPI(userId) {
    const uid = userId || CURRENT_USER_ID;
    try {
        const res = await fetch(`${API_BASE}/api/farms?user_id=${encodeURIComponent(uid)}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const normalized = (data.items || []).map(normalizeFarm);

        if (typeof FARMS !== 'undefined' && Array.isArray(FARMS)) {
            FARMS.length = 0;
            normalized.forEach(f => FARMS.push(f));
        }

        return normalized;
    } catch (err) {
        console.warn('[LoraField] Gagal memuat kebun dari API:', err.message);
        return [];
    }
}

/**
 * Muat summary lengkap satu kebun dari API.
 * Mengisi FARMS, NODES, dan WEATHER_DATA dengan data dari backend.
 */
async function loadFarmSummaryFromAPI(farmId) {
    try {
        const res = await fetch(`${API_BASE}/api/farms/${encodeURIComponent(farmId)}/summary`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const summary = await res.json();

        // --- Perbarui farm di FARMS ---
        if (typeof FARMS !== 'undefined' && Array.isArray(FARMS)) {
            const farm = FARMS.find(f => f.id === farmId);
            if (farm) {
                farm.gateway.status = summary.gateway_status || 'offline';
                farm.gateway.lastSeen = summary.gateway_status === 'online' ? new Date() : farm.gateway.lastSeen;

                const nodeIds = (summary.nodes || []).map(nd => nd.node && nd.node.id).filter(Boolean);
                farm.nodeIds = nodeIds;

                farm.warning = summary.nodes_problem > 0
                    ? `${summary.nodes_problem} node bermasalah`
                    : null;

                if (summary.weather) {
                    farm.rainPrediction = summary.weather.rain_next_3h || false;
                    farm.weather = summary.weather.condition || '—';
                    farm.irrigation = summary.gateway_status === 'offline'
                        ? 'Perlu cek gateway'
                        : (summary.weather.rain_next_3h ? 'Ditunda (prediksi hujan)' : 'Normal');
                }
            }
        }

        // --- Perbarui NODES ---
        const newNodes = (summary.nodes || []).map(normalizeNode);
        if (typeof NODES !== 'undefined' && Array.isArray(NODES)) {
            newNodes.forEach(newNode => {
                const idx = NODES.findIndex(n => n.id === newNode.id);
                if (idx >= 0) {
                    Object.assign(NODES[idx], newNode);
                } else {
                    NODES.push(newNode);
                }
            });
        }

        // --- Perbarui WEATHER_DATA ---
        if (summary.weather && typeof WEATHER_DATA !== 'undefined') {
            const normalized = normalizeWeather(summary.weather);
            if (normalized) {
                Object.assign(WEATHER_DATA, normalized);
            }
        }

        return summary;
    } catch (err) {
        console.warn('[LoraField] Gagal memuat summary kebun dari API:', err.message);
        return null;
    }
}
