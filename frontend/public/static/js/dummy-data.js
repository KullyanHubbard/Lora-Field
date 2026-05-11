/*
 * Data dummy untuk simulasi frontend.
 * Nanti diganti fetch() ke FastAPI:
 *   GET /api/v1/nodes
 *   GET /api/v1/nodes/{id}/sensors
 *   GET /api/v1/weather?adm4=34.02.01.2001
 */

const CURRENT_USER = {
    id: 'user-pak-budi',
    name: 'Pak Budi',
    email: 'pak.budi@lorafield.local',
    role: 'Pemilik Kebun'
};

const FARMS = [
    {
        id: 'salak-bantul',
        name: 'Kebun Salak Bantul',
        owner: 'Pak Budi',
        location: 'Bantul, D.I. Yogyakarta',
        region: 'Bantul',
        crop: 'Salak',
        area: '1.2 ha',
        bmkgCode: '34.02.01.2001',
        latitude: -7.8881,
        longitude: 110.3289,
        status: 'normal',
        gateway: {
            id: 'gw-salak-bantul',
            name: 'Gateway Salak Bantul',
            model: 'LILYGO LoRa32',
            status: 'online',
            internet: 'WiFi',
            quality: 'Baik',
            lastSeen: new Date()
        },
        nodeIds: ['01', '02'],
        valve: 'Terbuka',
        irrigation: 'Aktif',
        weather: 'Tidak ada prediksi hujan',
        rainPrediction: false,
        warning: 'Kelembapan rendah, irigasi sedang berjalan',
        lastUpdate: new Date()
    },
    {
        id: 'cabai-sleman',
        name: 'Kebun Cabai Sleman',
        owner: 'Pak Budi',
        location: 'Sleman, D.I. Yogyakarta',
        region: 'Sleman',
        crop: 'Cabai',
        area: '0.8 ha',
        bmkgCode: '34.04.12.2003',
        latitude: -7.6528,
        longitude: 110.4207,
        status: 'normal',
        gateway: {
            id: 'gw-cabai-sleman',
            name: 'Gateway Cabai Sleman',
            model: 'LILYGO LoRa32',
            status: 'online',
            internet: '4G LTE',
            quality: 'Stabil',
            lastSeen: new Date(Date.now() - 180000)
        },
        nodeIds: ['03', '04'],
        valve: 'Tertutup',
        irrigation: 'Normal',
        weather: 'Berawan',
        rainPrediction: false,
        warning: 'Tidak ada peringatan',
        lastUpdate: new Date(Date.now() - 300000)
    },
    {
        id: 'padi-kulon-progo',
        name: 'Kebun Padi Kulon Progo',
        owner: 'Pak Budi',
        location: 'Kulon Progo, D.I. Yogyakarta',
        region: 'Kulon Progo',
        crop: 'Padi',
        area: '2.4 ha',
        bmkgCode: '34.01.06.2005',
        latitude: -7.8575,
        longitude: 110.1587,
        status: 'warning',
        gateway: {
            id: 'gw-padi-kulon-progo',
            name: 'Gateway Padi Kulon Progo',
            model: 'LILYGO LoRa32',
            status: 'offline',
            internet: '4G LTE',
            quality: 'Terputus',
            lastSeen: new Date(Date.now() - 7200000)
        },
        nodeIds: ['05', '06', '07'],
        valve: 'Tidak diketahui',
        irrigation: 'Perlu cek gateway',
        weather: 'Data terakhir tersimpan',
        rainPrediction: false,
        warning: 'Gateway offline 2 jam lalu',
        lastUpdate: new Date(Date.now() - 7200000)
    }
];

const NODES = [
    {
        id: '01',
        backendId: 'node-01',
        name: 'Node 01',
        farmId: 'salak-bantul',
        location: 'Titik Barat Kebun Salak',
        region: 'Bantul',
        latitude: -7.8881,
        longitude: 110.3289,
        status: 'online',
        frequency: '921.2 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 38,
        soilTemp: 27.5,
        airTemp: 30.2,
        airHumidity: 78,
        battery: 86,
        rssi: -92,
        valveState: 'Terbuka',
        lastUpdate: new Date()
    },
    {
        id: '02',
        backendId: 'node-02',
        name: 'Node 02',
        farmId: 'salak-bantul',
        location: 'Titik Timur Kebun Salak',
        region: 'Bantul',
        latitude: -7.8902,
        longitude: 110.3312,
        status: 'online',
        frequency: '921.4 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 42,
        soilTemp: 26.8,
        airTemp: 29.7,
        airHumidity: 75,
        battery: 79,
        rssi: -96,
        valveState: 'Terbuka',
        lastUpdate: new Date(Date.now() - 300000)
    },
    {
        id: '03',
        backendId: 'node-03',
        name: 'Node 03',
        farmId: 'cabai-sleman',
        location: 'Bedeng Utara Cabai',
        region: 'Sleman',
        latitude: -7.6528,
        longitude: 110.4207,
        status: 'online',
        frequency: '921.6 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 64,
        soilTemp: 26.5,
        airTemp: 29.1,
        airHumidity: 74,
        battery: 91,
        rssi: -88,
        valveState: 'Tertutup',
        lastUpdate: new Date(Date.now() - 180000)
    },
    {
        id: '04',
        backendId: 'node-04',
        name: 'Node 04',
        farmId: 'cabai-sleman',
        location: 'Bedeng Selatan Cabai',
        region: 'Sleman',
        latitude: -7.6544,
        longitude: 110.4225,
        status: 'standby',
        frequency: '921.8 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 63,
        soilTemp: 26.7,
        airTemp: 29.4,
        airHumidity: 73,
        battery: 74,
        rssi: -101,
        valveState: 'Tertutup',
        lastUpdate: new Date(Date.now() - 600000)
    },
    {
        id: '05',
        backendId: 'node-05',
        name: 'Node 05',
        farmId: 'padi-kulon-progo',
        location: 'Petak Barat Padi',
        region: 'Kulon Progo',
        latitude: -7.8575,
        longitude: 110.1587,
        status: 'offline',
        frequency: '922.0 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 0,
        soilTemp: 0,
        airTemp: 0,
        airHumidity: 0,
        battery: 0,
        rssi: null,
        valveState: 'Tidak diketahui',
        lastUpdate: null
    },
    {
        id: '06',
        backendId: 'node-06',
        name: 'Node 06',
        farmId: 'padi-kulon-progo',
        location: 'Petak Tengah Padi',
        region: 'Kulon Progo',
        latitude: -7.8592,
        longitude: 110.1603,
        status: 'offline',
        frequency: '922.2 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 0,
        soilTemp: 0,
        airTemp: 0,
        airHumidity: 0,
        battery: 0,
        rssi: null,
        valveState: 'Tidak diketahui',
        lastUpdate: null
    },
    {
        id: '07',
        backendId: 'node-07',
        name: 'Node 07',
        farmId: 'padi-kulon-progo',
        location: 'Petak Timur Padi',
        region: 'Kulon Progo',
        latitude: -7.8611,
        longitude: 110.1622,
        status: 'offline',
        frequency: '922.4 MHz',
        spreadingFactor: 'SF9',
        syncWord: '0x12',
        updateInterval: '10 menit',
        soilMoisture: 0,
        soilTemp: 0,
        airTemp: 0,
        airHumidity: 0,
        battery: 0,
        rssi: null,
        valveState: 'Tidak diketahui',
        lastUpdate: null
    }
];

const WEATHER_DATA = {
    location: 'Bantul, D.I. Yogyakarta',
    status: 'Tersedia',
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
    nodeActive: { label: 'Node Aktif', value: '4 Node', status: 'Online', color: 'green' },
    gateway: { label: 'Gateway LoRa', value: 'Online', status: 'Connected', color: 'green' },
    mqtt: { label: 'MQTT Broker', value: 'Connected', status: 'Mosquitto', color: 'green' },
    bmkg: { label: 'BMKG API', value: 'Tersedia', status: 'Terhubung', color: 'green' }
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
        node: 'Node 05',
        location: 'Kebun Padi Kulon Progo',
        soilMoisture: 0,
        threshold: '40%-70%',
        soilTemp: 0,
        weather: '-',
        weatherCode: '-',
        decision: 'Peringatan',
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
