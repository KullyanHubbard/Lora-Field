/**
 * api.js — Koneksi frontend LoraField ke FastAPI backend.
 *
 * - loadFarmsFromAPI()       → GET /api/farms
 * - loadFarmSummaryFromAPI() → GET /api/farms/{id}/summary
 *
 * Kedua fungsi mengisi array/object global (FARMS, NODES, WEATHER_DATA)
 * yang dideklarasikan di dummy-data.js.
 */

const API_BASE = (() => {
    const manualBase = localStorage.getItem('lf_api_base');
    if (manualBase) return manualBase;
    if (window.location.port === '8000') return window.location.origin;
            const h = window.location.hostname;
            if (h !== 'localhost' && h !== '127.0.0.1') return window.location.origin;
    return 'http://localhost:8000';
})();

function getAuthHeaders() {
    const token = localStorage.getItem('lf_access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function handleAuthFailure(statusCode) {
    if (statusCode !== 401 && statusCode !== 403) return;
    const path = (window.location.pathname || '').toLowerCase();
    if (path.endsWith('/login.html') || path.endsWith('/register.html') || path.endsWith('/reset-password.html')) {
        return;
    }
    window.location.href = 'login.html';
}

function toNumberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function pickNumber(...values) {
    for (const value of values) {
        const number = toNumberOrNull(value);
        if (number !== null) return number;
    }
    return null;
}

function getWeatherCodeFromDescription(description, fallbackCode = null) {
    const text = String(description || '').toLowerCase();
    if (text.includes('hujan lebat') || text.includes('thunderstorm')) return 63;
    if (text.includes('hujan sedang')) return 61;
    if (text.includes('hujan ringan') || text.includes('hujan') || text.includes('shower')) return 60;
    if (text.includes('berawan tebal')) return 4;
    if (text.includes('cerah berawan')) return 2;
    if (text.includes('cerah')) return 0;
    if (text.includes('berawan')) return 3;
    return fallbackCode;
}

function formatForecastLabel(item, index) {
    const rawTime = item.local_datetime || item.datetime || item.utc_datetime;
    if (!rawTime) return index === 0 ? 'Sekarang' : `+${index * 3} Jam`;

    const normalized = String(rawTime).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        const timePart = String(rawTime).split(' ')[1];
        return timePart ? timePart.slice(0, 5) : (index === 0 ? 'Sekarang' : `+${index * 3} Jam`);
    }

    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

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
        latitude: apiFarm.latitude ?? 0,
        longitude: apiFarm.longitude ?? 0,
        status: apiFarm.status === 'active' ? 'normal' : (apiFarm.status || 'normal'),
        // Gateway diisi sementara dengan status tidak diketahui; diperbarui saat loadFarmSummaryFromAPI dipanggil
        gateway: {
            id: 'gw-' + apiFarm.id,
            name: 'Gateway ' + apiFarm.name,
            model: 'LoRa Gateway',
            status: 'unknown',
            internet: '—',
            quality: '—',
            lastSeen: null
        },
        nodeIds: [],
        valve: 'Tertutup',
        irrigation: 'Normal',
        weather: '—',
        weatherStatus: 'Belum tersedia',
        weatherLocation: '',
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

    const condition = apiWeather.condition || 'Belum tersedia';
    const code = pickNumber(apiWeather.code) ?? getWeatherCodeFromDescription(condition);
    const rawForecast = Array.isArray(apiWeather.forecast) ? apiWeather.forecast.slice(0, 8) : [];
    const firstForecast = rawForecast[0] || {};
    const forecast = rawForecast.map((f, i) => {
        const forecastCondition = f.weather_desc || f.condition || 'Belum tersedia';
        return {
            label: formatForecastLabel(f, i),
            condition: forecastCondition,
            code: pickNumber(f.weather, f.code) ?? getWeatherCodeFromDescription(forecastCondition),
            temp: pickNumber(f.t, f.temperature),
            humidity: pickNumber(f.hu, f.humidity),
            windSpeed: pickNumber(f.ws, f.wind_speed),
            windDirection: f.wd || f.wind_direction || '',
            visibility: f.vs_text || f.visibility || '',
            localDatetime: f.local_datetime || '',
            utcDatetime: f.utc_datetime || f.datetime || ''
        };
    });

    return {
        location: apiWeather.location || '',
        adm4: apiWeather.adm4 || '',
        provider: apiWeather.provider || 'BMKG',
        source: apiWeather.source || '',
        region: apiWeather.region || {},
        locationProfile: apiWeather.location_profile || {},
        status: 'Tersedia',
        lastUpdate: apiWeather.updated_at || apiWeather.forecast_time || 'Baru saja',
        forecastTime: apiWeather.forecast_time || '',
        current: {
            temp: pickNumber(apiWeather.temperature, firstForecast.t),
            humidity: pickNumber(apiWeather.humidity, firstForecast.hu),
            windSpeed: pickNumber(apiWeather.wind_speed, firstForecast.ws),
            windDirection: apiWeather.wind_direction || firstForecast.wd || '',
            visibility: apiWeather.visibility || firstForecast.vs_text || '',
            condition,
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
 * User aktif diambil dari JWT di localStorage; tidak perlu parameter user.
 */
async function loadFarmsFromAPI() {
    try {
        const res = await fetch(`${API_BASE}/api/farms`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            handleAuthFailure(res.status);
            throw new Error('HTTP ' + res.status);
        }
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
        const res = await fetch(`${API_BASE}/api/farms/${encodeURIComponent(farmId)}/summary`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            handleAuthFailure(res.status);
            throw new Error('HTTP ' + res.status);
        }
        const summary = await res.json();

        // --- Perbarui farm di FARMS ---
        if (typeof FARMS !== 'undefined' && Array.isArray(FARMS)) {
            const farm = FARMS.find(f => f.id === farmId);
            if (farm) {
                if (summary.farm) {
                    farm.bmkgCode = summary.farm.bmkg_adm4_code || farm.bmkgCode || '';
                    farm.latitude = summary.farm.latitude ?? farm.latitude;
                    farm.longitude = summary.farm.longitude ?? farm.longitude;
                    farm.location = summary.farm.location || farm.location;
                }
                farm.gateway.status = summary.gateway_status || 'offline';
                farm.gateway.lastSeen = summary.gateway_status === 'online' ? new Date() : farm.gateway.lastSeen;

                const nodeIds = (summary.nodes || []).map(nd => nd.node && nd.node.id).filter(Boolean);
                farm.nodeIds = nodeIds;

                farm.warning = summary.nodes_problem > 0
                    ? `${summary.nodes_problem} node bermasalah`
                    : null;

                if (summary.weather) {
                    farm.rainPrediction = summary.weather.rain_next_3h || false;
                    farm.weatherStatus = 'Tersedia';
                    farm.weatherLocation = summary.weather.location || '';
                    farm.weather = summary.weather.condition || '—';
                    farm.irrigation = summary.gateway_status === 'offline'
                        ? 'Perlu cek gateway'
                        : (summary.weather.rain_next_3h ? 'Ditunda (prediksi hujan)' : 'Normal');
                } else {
                    farm.rainPrediction = false;
                    farm.weather = 'Belum tersedia';
                    farm.weatherStatus = 'Belum tersedia';
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
        if (typeof WEATHER_DATA !== 'undefined' && WEATHER_DATA) {
            if (summary.weather) {
                const normalized = normalizeWeather(summary.weather);
                if (normalized) {
                    Object.assign(WEATHER_DATA, normalized);
                }
            } else {
                Object.assign(WEATHER_DATA, {
                    location: summary.farm ? summary.farm.location : '',
                    adm4: summary.farm ? summary.farm.bmkg_adm4_code || '' : '',
                    provider: 'BMKG',
                    source: '',
                    region: {},
                    locationProfile: {},
                    status: 'Belum tersedia',
                    lastUpdate: 'Belum tersedia',
                    forecastTime: '',
                    current: {
                        temp: null,
                        humidity: null,
                        windSpeed: null,
                        windDirection: '',
                        visibility: '',
                        condition: 'Belum tersedia',
                        code: null
                    },
                    forecast: [],
                    rainPrediction: false
                });
            }
        }

        return summary;
    } catch (err) {
        console.warn('[LoraField] Gagal memuat summary kebun dari API:', err.message);
        return null;
    }
}

async function loadSelectedFarmSummaryFromAPI(requestedFarmId = null) {
    const targetFarmId = requestedFarmId && typeof getFarmById === 'function' && getFarmById(requestedFarmId)
        ? requestedFarmId
        : (typeof getCurrentFarm === 'function' && getCurrentFarm() ? getCurrentFarm().id : null);

    if (!targetFarmId) return null;
    if (typeof setSelectedFarmId === 'function') setSelectedFarmId(targetFarmId);
    return loadFarmSummaryFromAPI(targetFarmId);
}
