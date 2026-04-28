/*
 * Data dummy untuk simulasi frontend.
 * Nanti diganti fetch() ke FastAPI:
 *   GET /api/v1/nodes
 *   GET /api/v1/nodes/{id}/sensors
 *   GET /api/v1/weather?adm4=34.02.01.2001
 */

const NODES = [
    {
        id: '01',
        name: 'Node 01',
        location: 'Lahan Padi Bantul',
        region: 'Bantul',
        status: 'online',
        frequency: '921.2 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 38,
        soilTemp: 27.5,
        airTemp: 30.2,
        airHumidity: 78,
        lastUpdate: new Date()
    },
    {
        id: '02',
        name: 'Node 02',
        location: 'Kebun Salak Sleman',
        region: 'Sleman',
        status: 'standby',
        frequency: '921.4 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 55,
        soilTemp: 26.8,
        airTemp: 29.7,
        airHumidity: 75,
        lastUpdate: new Date(Date.now() - 300000)
    },
    {
        id: '03',
        name: 'Node 03',
        location: 'Lahan Uji',
        region: 'Bantul',
        status: 'offline',
        frequency: '921.6 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 0,
        soilTemp: 0,
        airTemp: 0,
        airHumidity: 0,
        lastUpdate: null
    }
];

const WEATHER_DATA = {
    location: 'Bantul, D.I. Yogyakarta',
    source: 'BMKG Public API',
    status: 'Available',
    lastUpdate: '10 menit lalu',
    current: {
        temp: 29,
        humidity: 80,
        windSpeed: 12,
        condition: 'Berawan',
        code: 3
    },
    forecast: [
        { label: 'Sekarang', condition: 'Berawan', code: 3, temp: 29 },
        { label: '+1 Jam', condition: 'Berawan', code: 3, temp: 28 },
        { label: '+3 Jam', condition: 'Cerah Berawan', code: 2, temp: 27 }
    ],
    rainPrediction: false
};

const WEATHER_CODES = [
    { code: 0, label: 'Cerah', icon: 'fas fa-sun', isRain: false },
    { code: 1, label: 'Cerah Berawan', icon: 'fas fa-cloud-sun', isRain: false },
    { code: 2, label: 'Cerah Berawan', icon: 'fas fa-cloud-sun', isRain: false },
    { code: 3, label: 'Berawan', icon: 'fas fa-cloud', isRain: false },
    { code: 4, label: 'Berawan Tebal', icon: 'fas fa-cloud', isRain: false },
    { code: 60, label: 'Hujan Ringan', icon: 'fas fa-cloud-rain', isRain: true },
    { code: 61, label: 'Hujan Sedang', icon: 'fas fa-cloud-showers-heavy', isRain: true },
    { code: 63, label: 'Hujan Lebat', icon: 'fas fa-cloud-bolt', isRain: true }
];

const SYSTEM_STATUS = {
    nodeActive: { label: 'Node Aktif', value: '1 Node', status: 'Online', color: 'green' },
    gateway: { label: 'Gateway LoRa', value: 'Online', status: 'Connected', color: 'green' },
    mqtt: { label: 'MQTT Broker', value: 'Connected', status: 'Mosquitto', color: 'green' },
    bmkg: { label: 'BMKG API', value: 'Available', status: 'Terhubung', color: 'green' }
};

// Urutan log terbaru ke terlama karena dashboard mengambil data dari awal array.
const DECISION_LOGS = [
    {
        time: '11:50',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 38,
        threshold: '40%-70%',
        soilTemp: 27.5,
        weather: 'Tidak hujan',
        weatherCode: 3,
        decision: 'Irigasi dijalankan',
        valve: 'Terbuka',
        type: 'open',
        note: 'Kelembapan di bawah threshold bawah'
    },
    {
        time: '11:40',
        node: 'Node 02',
        location: 'Kebun Salak Sleman',
        soilMoisture: 39,
        threshold: '40%-70%',
        soilTemp: 26.2,
        weather: 'Tidak hujan',
        weatherCode: 2,
        decision: 'Irigasi dijalankan',
        valve: 'Terbuka',
        type: 'open',
        note: 'Kelembapan di bawah threshold bawah'
    },
    {
        time: '11:30',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 45,
        threshold: '40%-70%',
        soilTemp: 27.6,
        weather: 'Tidak hujan',
        weatherCode: 3,
        decision: 'Kondisi normal',
        valve: 'Tertutup',
        type: 'normal',
        note: 'Kelembapan dalam rentang normal'
    },
    {
        time: '11:20',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 37,
        threshold: '40%-70%',
        soilTemp: 28.3,
        weather: 'Hujan Sedang',
        weatherCode: 61,
        decision: 'Irigasi ditunda',
        valve: 'Tertutup',
        type: 'delayed',
        note: 'Prediksi hujan sedang dari BMKG'
    },
    {
        time: '11:10',
        node: 'Node 03',
        location: 'Lahan Uji',
        soilMoisture: 0,
        threshold: '40%-70%',
        soilTemp: 0,
        weather: '-',
        weatherCode: '-',
        decision: 'Warning',
        valve: '-',
        type: 'warning',
        note: 'Node offline, tidak ada data'
    },
    {
        time: '11:00',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 68,
        threshold: '40%-70%',
        soilTemp: 27.9,
        weather: 'Tidak hujan',
        weatherCode: 3,
        decision: 'Irigasi dilanjutkan',
        valve: 'Terbuka',
        type: 'open',
        note: 'Kelembapan dalam rentang normal, valve dipertahankan terbuka'
    },
    {
        time: '10:50',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 33,
        threshold: '40%-70%',
        soilTemp: 28.1,
        weather: 'Tidak hujan',
        weatherCode: 1,
        decision: 'Irigasi dijalankan',
        valve: 'Terbuka',
        type: 'open',
        note: 'Kelembapan di bawah threshold bawah'
    },
    {
        time: '10:40',
        node: 'Node 02',
        location: 'Kebun Salak Sleman',
        soilMoisture: 55,
        threshold: '40%-70%',
        soilTemp: 26.5,
        weather: 'Tidak hujan',
        weatherCode: 2,
        decision: 'Kondisi normal',
        valve: 'Tertutup',
        type: 'normal',
        note: 'Kelembapan dalam rentang normal'
    },
    {
        time: '10:30',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 42,
        threshold: '40%-70%',
        soilTemp: 27.2,
        weather: 'Tidak hujan',
        weatherCode: 3,
        decision: 'Kondisi normal',
        valve: 'Tertutup',
        type: 'normal',
        note: 'Kelembapan dalam rentang normal'
    },
    {
        time: '10:20',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 35,
        threshold: '40%-70%',
        soilTemp: 27.8,
        weather: 'Hujan Ringan',
        weatherCode: 60,
        decision: 'Irigasi ditunda',
        valve: 'Tertutup',
        type: 'delayed',
        note: 'Prediksi hujan dari BMKG'
    },
    {
        time: '10:10',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 72,
        threshold: '40%-70%',
        soilTemp: 28.0,
        weather: 'Tidak hujan',
        weatherCode: 3,
        decision: 'Irigasi dihentikan',
        valve: 'Tertutup',
        type: 'closed',
        note: 'Kelembapan di atas threshold atas'
    },
    {
        time: '10:00',
        node: 'Node 01',
        location: 'Lahan Padi Bantul',
        soilMoisture: 42,
        threshold: '40%-70%',
        soilTemp: 27.5,
        weather: 'Tidak hujan',
        weatherCode: 3,
        decision: 'Kondisi normal',
        valve: 'Tertutup',
        type: 'normal',
        note: 'Kelembapan dalam rentang normal'
    }
];

// Riwayat ini dipakai grafik dashboard/monitoring untuk Node 01.
const SENSOR_HISTORY_LABELS = ['10:50', '11:00', '11:10', '11:20', '11:30', '11:40', '11:50'];

const SENSOR_HISTORY = {
    soilMoisture: [33, 68, 64, 37, 45, 40, 38],
    soilTemp: [28.1, 27.9, 27.8, 28.3, 27.6, 27.7, 27.5],
    airTemp: [30.4, 30.1, 30.0, 30.3, 30.0, 29.9, 30.2],
    airHumidity: [76, 77, 79, 82, 80, 79, 78]
};

const TECH_STACK = [
    { name: 'Node Sensor', value: 'LILYGO LoRa32 V2.1', icon: 'fas fa-microchip' },
    { name: 'Komunikasi', value: 'LoRa P2P', icon: 'fas fa-broadcast-tower' },
    { name: 'Frekuensi', value: '921-922 MHz (AS923-2)', icon: 'fas fa-signal' },
    { name: 'Gateway', value: 'LILYGO LoRa32', icon: 'fas fa-server' },
    { name: 'Broker', value: 'Mosquitto MQTT', icon: 'fas fa-exchange-alt' },
    { name: 'Backend (Rencana)', value: 'FastAPI', icon: 'fas fa-code' },
    { name: 'Database (Rencana)', value: 'SQLite', icon: 'fas fa-database' },
    { name: 'Dashboard', value: 'HTML, CSS, JS, WebSocket', icon: 'fas fa-desktop' },
    { name: 'Cuaca', value: 'API BMKG', icon: 'fas fa-cloud-sun' }
];

const SENSORS_INFO = [
    { name: 'Capacitive Soil Moisture Sensor V1.2', purpose: 'Kelembapan tanah', type: 'Kapasitif' },
    { name: 'DS18B20 Waterproof', purpose: 'Suhu tanah', type: 'Digital' },
    { name: 'DHT22 AM2302', purpose: 'Suhu dan kelembapan udara', type: 'Digital' }
];

const ACTUATORS_INFO = [
    { name: 'Relay Module', purpose: 'Kontrol on/off solenoid valve' },
    { name: 'Solenoid Valve 12V DC', purpose: 'Buka/tutup aliran air' },
    { name: 'Aki VRLA 12V', purpose: 'Sumber daya listrik utama' },
    { name: 'Solar Panel 10W', purpose: 'Pengisian daya dari matahari' },
    { name: 'Solar Charge Controller', purpose: 'Pengatur pengisian aki dari solar panel' }
];

const TOPOLOGY_STEPS = [
    { label: 'Node Sensor', icon: 'fas fa-microchip', desc: 'LILYGO LoRa32' },
    { label: 'LoRa P2P', icon: 'fas fa-broadcast-tower', desc: '921 MHz' },
    { label: 'Gateway LoRa', icon: 'fas fa-server', desc: 'LILYGO LoRa32' },
    { label: 'MQTT', icon: 'fas fa-exchange-alt', desc: 'Mosquitto' },
    { label: 'FastAPI', icon: 'fas fa-code', desc: 'Backend' },
    { label: 'SQLite', icon: 'fas fa-database', desc: 'Database' },
    { label: 'Dashboard', icon: 'fas fa-desktop', desc: 'Web App' }
];
