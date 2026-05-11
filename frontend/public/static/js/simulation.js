// Simulasi data sensor - nanti diganti WebSocket dari backend.

let simulationInterval = null;
let currentRainOverride = null;

const SIMULATION_INTERVAL_MS = 8000;
const MAX_LOG_ENTRIES = 50;
const MAX_HISTORY_POINTS = 20;
const FORECAST_TARGET_INDEX = 2;
const RAIN_WEATHER_CODES = [60, 61, 63];

const SENSOR_RANGES = {
    soilMoisture: [30, 80, 0],
    soilTemp: [24, 32, 1],
    airTemp: [26, 34, 1],
    airHumidity: [60, 90, 0]
};

function randomInRange(min, max, decimals = 1) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return parseFloat((Math.random() * (high - low) + low).toFixed(decimals));
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function randomPercent(min, max) {
    return clamp(randomInRange(min, max, 0), 0, 100);
}

function setForecast(code, temp = 27) {
    if (typeof WEATHER_DATA === 'undefined' || !Array.isArray(WEATHER_DATA.forecast)) return;
    const info = getWeatherInfo(code);
    WEATHER_DATA.rainPrediction = info.isRain;
    WEATHER_DATA.forecast[FORECAST_TARGET_INDEX] = {
        label: '+3 Jam',
        condition: info.label,
        code,
        temp
    };
}

function setNoRainForecast(temp = 27) {
    setForecast(2, temp);
}

function simulateSensorData() {
    if (typeof NODES === 'undefined' || !Array.isArray(NODES)) return;
    NODES.forEach(node => {
        if (node.status === 'offline') return;

        node.soilMoisture = randomInRange(...SENSOR_RANGES.soilMoisture);
        node.soilTemp = randomInRange(...SENSOR_RANGES.soilTemp);
        node.airTemp = randomInRange(...SENSOR_RANGES.airTemp);
        node.airHumidity = randomInRange(...SENSOR_RANGES.airHumidity);
        node.lastUpdate = new Date();
    });
}

function getPrimarySimulationNode() {
    if (typeof NODES === 'undefined' || !Array.isArray(NODES)) return null;

    const farm = typeof getCurrentFarm === 'function' ? getCurrentFarm() : null;
    const farmNodes = farm && typeof getFarmNodes === 'function' ? getFarmNodes(farm) : [];
    const activeFarmNode = farmNodes.find(node => node.status !== 'offline') || null;
    if (activeFarmNode) return activeFarmNode;
    if (farmNodes.length) return null;

    return NODES.find(node => node.status !== 'offline') || null;
}

function getScenarioSoilMoisture(type, lower, upper) {
    switch (type) {
        case 'dry':
            return lower <= 0 ? 0 : randomPercent(Math.max(lower - 15, 0), lower - 1);
        case 'normal':
            return randomPercent(lower, upper);
        case 'wet':
            return upper >= 100 ? 100 : randomPercent(upper + 1, 100);
        case 'rain':
            return lower <= 0 ? 0 : randomPercent(Math.max(lower - 15, 0), lower - 1);
        default:
            return null;
    }
}

function simulateCondition(type) {
    const node = getPrimarySimulationNode();
    if (!node) return;

    const lower = ThresholdManager.lower;
    const upper = ThresholdManager.upper;
    const soilMoisture = getScenarioSoilMoisture(type, lower, upper);

    if (soilMoisture === null) return;

    node.soilMoisture = soilMoisture;

    switch (type) {
        case 'dry':
        case 'normal':
        case 'wet':
            currentRainOverride = false;
            setNoRainForecast();
            break;
        case 'rain':
            currentRainOverride = true;
            setForecast(60, 25);
            break;
    }

    node.lastUpdate = new Date();
    recordDecisionSnapshot(node);
    updateAllUI();
}

function resetRainOverride() {
    currentRainOverride = null;
    setNoRainForecast();
}

function isRainPredicted() {
    if (currentRainOverride !== null) return currentRainOverride;
    if (typeof WEATHER_DATA === 'undefined' || !Array.isArray(WEATHER_DATA.forecast)) return false;
    return WEATHER_DATA.rainPrediction || WEATHER_DATA.forecast.some(item => getWeatherInfo(item.code).isRain);
}

function getPredictedRainItem() {
    if (typeof WEATHER_DATA === 'undefined' || !Array.isArray(WEATHER_DATA.forecast)) return null;
    return WEATHER_DATA.forecast.find(item => getWeatherInfo(item.code).isRain) || null;
}

function getWeatherLogSnapshot() {
    if (typeof WEATHER_DATA === 'undefined') {
        return { weather: 'Tidak tersedia', weatherCode: '-' };
    }

    const currentInfo = getWeatherInfo(WEATHER_DATA.current.code);
    const rainItem = getPredictedRainItem();

    if (isRainPredicted()) {
        if (rainItem) {
            const rainInfo = getWeatherInfo(rainItem.code);
            return { weather: rainInfo.label, weatherCode: rainItem.code };
        }

        return {
            weather: currentInfo.isRain ? currentInfo.label : 'Hujan',
            weatherCode: WEATHER_DATA.current.code
        };
    }

    return {
        weather: currentInfo.isRain ? currentInfo.label : 'Tidak hujan',
        weatherCode: WEATHER_DATA.current.code
    };
}

function recordDecisionSnapshot(node) {
    pushSensorHistory(node);

    const rain = isRainPredicted();
    const decision = makeIrrigationDecision(node.soilMoisture, rain);
    const weatherLog = getWeatherLogSnapshot();

    addLogEntry(
        node,
        node.soilMoisture,
        weatherLog.weather,
        weatherLog.weatherCode,
        decision.decision,
        decision.valve,
        decision.type,
        decision.reason
    );
}

function updateAllUI() {
    requestAnimationFrame(() => {
        [
            () => typeof updateDashboardUI === 'function' && updateDashboardUI(),
            () => typeof updateMonitoringUI === 'function' && updateMonitoringUI(),
            () => typeof updateIrrigationUI === 'function' && updateIrrigationUI(),
            () => typeof updateWeatherUI === 'function' && updateWeatherUI(),
            () => typeof renderLogs === 'function' && renderLogs(),
        ].forEach(fn => {
            try { fn(); } catch (err) { console.error('[LoraField] UI update error:', err); }
        });
    });
}

function startSimulation() {
    if (simulationInterval) return;
    if (typeof NODES === 'undefined' || !Array.isArray(NODES) || !NODES.length) return;
    if (typeof WEATHER_DATA === 'undefined') return;
    simulationInterval = setInterval(() => {
        simulateSensorData();

        if (currentRainOverride === null) {
            WEATHER_DATA.rainPrediction = Math.random() < 0.15;
            if (WEATHER_DATA.rainPrediction) {
                const code = RAIN_WEATHER_CODES[Math.floor(Math.random() * RAIN_WEATHER_CODES.length)];
                setForecast(code, randomInRange(24, 28, 0));
            } else {
                setNoRainForecast(randomInRange(26, 29, 0));
            }
        }

        const node = getPrimarySimulationNode();
        if (node) recordDecisionSnapshot(node);
        updateAllUI();
    }, SIMULATION_INTERVAL_MS);
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

let lastLoggedDecisionType = typeof DECISION_LOGS !== 'undefined' && DECISION_LOGS.length ? DECISION_LOGS[0].type : null;

function addLogEntry(node, soilMoisture, weather, weatherCode, decision, valve, type, note) {
    if (typeof DECISION_LOGS === 'undefined' || !Array.isArray(DECISION_LOGS)) return;
    // Simpan hanya jika tipe keputusan berubah agar log tidak cepat penuh.
    if (lastLoggedDecisionType === type) return;
    lastLoggedDecisionType = type;

    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    DECISION_LOGS.unshift({
        time,
        node: node.name,
        location: node.location,
        soilMoisture,
        threshold: ThresholdManager.getActiveString(),
        soilTemp: node.soilTemp,
        weather,
        weatherCode,
        decision,
        valve,
        type,
        note
    });

    if (DECISION_LOGS.length > MAX_LOG_ENTRIES) DECISION_LOGS.pop();
}

function pushSensorHistory(node) {
    if (
        typeof SENSOR_HISTORY_LABELS === 'undefined' ||
        typeof SENSOR_HISTORY === 'undefined' ||
        !Array.isArray(SENSOR_HISTORY_LABELS) ||
        !Array.isArray(SENSOR_HISTORY.soilMoisture) ||
        !Array.isArray(SENSOR_HISTORY.soilTemp) ||
        !Array.isArray(SENSOR_HISTORY.airTemp) ||
        !Array.isArray(SENSOR_HISTORY.airHumidity)
    ) {
        return;
    }

    const now = new Date();
    const label = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    SENSOR_HISTORY_LABELS.push(label);
    SENSOR_HISTORY.soilMoisture.push(node.soilMoisture);
    SENSOR_HISTORY.soilTemp.push(node.soilTemp);
    SENSOR_HISTORY.airTemp.push(node.airTemp);
    SENSOR_HISTORY.airHumidity.push(node.airHumidity);

    if (SENSOR_HISTORY_LABELS.length > MAX_HISTORY_POINTS) {
        SENSOR_HISTORY_LABELS.shift();
        SENSOR_HISTORY.soilMoisture.shift();
        SENSOR_HISTORY.soilTemp.shift();
        SENSOR_HISTORY.airTemp.shift();
        SENSOR_HISTORY.airHumidity.shift();
    }
}
