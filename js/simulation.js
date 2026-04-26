// Simulasi data sensor — nanti diganti WebSocket dari backend

let simulationInterval = null;
let currentRainOverride = null;

function randomInRange(min, max, decimals = 1) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Update nilai sensor secara random (simulasi pembacaan dari node LoRa)
function simulateSensorData() {
    NODES.forEach(node => {
        if (node.status === 'offline') return;
        node.soilMoisture = randomInRange(30, 80, 0);
        node.soilTemp = randomInRange(24, 32, 1);
        node.airTemp = randomInRange(26, 34, 1);
        node.airHumidity = randomInRange(60, 90, 0);
        node.lastUpdate = new Date();
    });
}

// Dipanggil dari tombol simulasi di halaman irigasi
function simulateCondition(type) {
    const node = NODES[0];
    const lower = ThresholdManager.lower;
    const upper = ThresholdManager.upper;

    switch (type) {
        case 'dry':
            node.soilMoisture = randomInRange(Math.max(lower - 15, 10), lower - 1, 0);
            currentRainOverride = false;
            WEATHER_DATA.rainPrediction = false;
            break;
        case 'normal':
            node.soilMoisture = randomInRange(lower + 5, upper - 5, 0);
            currentRainOverride = false;
            WEATHER_DATA.rainPrediction = false;
            break;
        case 'wet':
            node.soilMoisture = randomInRange(upper + 1, 95, 0);
            currentRainOverride = false;
            WEATHER_DATA.rainPrediction = false;
            break;
        case 'rain':
            node.soilMoisture = randomInRange(Math.max(lower - 15, 10), lower - 1, 0);
            currentRainOverride = true;
            WEATHER_DATA.rainPrediction = true;
            WEATHER_DATA.forecast[2] = { label: '+3 Jam', condition: 'Hujan Ringan', code: 60, temp: 25 };
            break;
    }
    node.lastUpdate = new Date();
    updateAllUI();
}

// Reset rain override
function resetRainOverride() {
    currentRainOverride = null;
    WEATHER_DATA.rainPrediction = false;
    WEATHER_DATA.forecast[2] = { label: '+3 Jam', condition: 'Cerah Berawan', code: 2, temp: 27 };
}

// Check if rain is predicted
function isRainPredicted() {
    if (currentRainOverride !== null) return currentRainOverride;
    return WEATHER_DATA.rainPrediction;
}

// Panggil updater masing-masing halaman kalau fungsinya ada
function updateAllUI() {
    if (typeof updateDashboardUI === 'function') updateDashboardUI();
    if (typeof updateMonitoringUI === 'function') updateMonitoringUI();
    if (typeof updateIrrigationUI === 'function') updateIrrigationUI();
    if (typeof updateWeatherUI === 'function') updateWeatherUI();
}

// Auto-update setiap 8 detik (nanti pakai WebSocket event dari MQTT)
function startSimulation() {
    if (simulationInterval) return;
    simulationInterval = setInterval(() => {
        simulateSensorData();
        if (currentRainOverride === null) {
            WEATHER_DATA.rainPrediction = Math.random() < 0.15;
            if (WEATHER_DATA.rainPrediction) {
                const rainCodes = [60, 61, 63];
                const code = rainCodes[Math.floor(Math.random() * rainCodes.length)];
                const info = getWeatherInfo(code);
                WEATHER_DATA.forecast[2] = { label: '+3 Jam', condition: info.label, code, temp: randomInRange(24, 28, 0) };
            } else {
                WEATHER_DATA.forecast[2] = { label: '+3 Jam', condition: 'Cerah Berawan', code: 2, temp: randomInRange(26, 29, 0) };
            }
        }
        updateAllUI();
    }, 8000);
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

// Add a new log entry dynamically
function addLogEntry(node, soilMoisture, weather, weatherCode, decision, valve, type, note) {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    DECISION_LOGS.unshift({
        time, node: node.name, location: node.location,
        soilMoisture, threshold: ThresholdManager.getActiveString(),
        soilTemp: node.soilTemp, weather, weatherCode,
        decision, valve, type, note
    });
    if (DECISION_LOGS.length > 50) DECISION_LOGS.pop();
}

// Push sensor history for charts
function pushSensorHistory(node) {
    const now = new Date();
    const label = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    SENSOR_HISTORY_LABELS.push(label);
    SENSOR_HISTORY.soilMoisture.push(node.soilMoisture);
    SENSOR_HISTORY.soilTemp.push(node.soilTemp);
    SENSOR_HISTORY.airTemp.push(node.airTemp);
    SENSOR_HISTORY.airHumidity.push(node.airHumidity);

    // Keep last 20 points
    if (SENSOR_HISTORY_LABELS.length > 20) {
        SENSOR_HISTORY_LABELS.shift();
        SENSOR_HISTORY.soilMoisture.shift();
        SENSOR_HISTORY.soilTemp.shift();
        SENSOR_HISTORY.airTemp.shift();
        SENSOR_HISTORY.airHumidity.shift();
    }
}
