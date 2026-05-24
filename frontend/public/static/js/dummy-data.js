// Variabel global — diisi dari backend API via api.js.
// Semua halaman bergantung pada deklarasi ini; data diisi saat runtime.

const CURRENT_USER = null;
const FARMS = [];
const NODES = [];
const WEATHER_DATA = null;
const SYSTEM_STATUS = {};
const DECISION_LOGS = [];
const SENSOR_HISTORY_LABELS = [];
const SENSOR_HISTORY = { soilMoisture: [], soilTemp: [], airTemp: [], airHumidity: [] };
const TECH_STACK = [];
const SENSORS_INFO = [];
const ACTUATORS_INFO = [];
const TOPOLOGY_STEPS = [];

// Mapping kode cuaca BMKG → label dan ikon (bukan data dummy).
const WEATHER_CODES = [
    { code: 0,  label: 'Cerah',          icon: 'fas fa-sun',                  isRain: false },
    { code: 1,  label: 'Cerah Berawan',  icon: 'fas fa-cloud-sun',            isRain: false },
    { code: 2,  label: 'Cerah Berawan',  icon: 'fas fa-cloud-sun',            isRain: false },
    { code: 3,  label: 'Berawan',        icon: 'fas fa-cloud',                isRain: false },
    { code: 4,  label: 'Berawan Tebal',  icon: 'fas fa-cloud',                isRain: false },
    { code: 60, label: 'Hujan Ringan',   icon: 'fas fa-cloud-rain',           isRain: true  },
    { code: 61, label: 'Hujan Sedang',   icon: 'fas fa-cloud-showers-heavy',  isRain: true  },
    { code: 63, label: 'Hujan Lebat',    icon: 'fas fa-cloud-bolt',           isRain: true  }
];
