// Helper render grafik memakai Chart.js v4.

const CHART_COLORS = {
    green: { border: '#0f9f6e', bg: 'rgba(15,159,110,0.12)' },
    blue: { border: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    orange: { border: '#ea580c', bg: 'rgba(234,88,12,0.12)' },
    cyan: { border: '#0891b2', bg: 'rgba(8,145,178,0.12)' }
};

const CHART_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#475569',
            borderColor: '#dfe7ee',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            padding: 10,
            titleFont: { family: CHART_FONT, size: 12, weight: '700' },
            bodyFont: { family: CHART_FONT, size: 11, weight: '600' }
        }
    },
    scales: {
        x: {
            grid: { color: 'rgba(15,23,42,0.05)', drawBorder: false },
            ticks: { color: '#64748b', font: { size: 10, family: CHART_FONT, weight: '600' } },
            border: { display: false }
        },
        y: {
            grid: { color: 'rgba(15,23,42,0.06)', drawBorder: false },
            ticks: { color: '#64748b', font: { size: 10, family: CHART_FONT, weight: '600' } },
            border: { display: false }
        }
    },
    animation: { duration: 650, easing: 'easeOutQuart' }
};

function createLineChart(canvasId, label, data, labels, color, yMin, yMax, unit) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, color.bg.replace('0.12', '0.24'));
    gradient.addColorStop(1, color.bg.replace('0.12', '0.02'));

    return new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color.border,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: color.border,
                pointBorderWidth: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            scales: {
                ...CHART_DEFAULTS.scales,
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    min: yMin,
                    max: yMax,
                    ticks: {
                        ...CHART_DEFAULTS.scales.y.ticks,
                        callback: value => value + (unit || '')
                    }
                }
            }
        }
    });
}

function updateChartData(chart, newData, newLabels) {
    if (!chart) return;
    chart.data.labels = newLabels || chart.data.labels;
    chart.data.datasets[0].data = newData;
    chart.update('none');
}

let dashSoilChart;
let dashTempChart;
let dashHumChart;

function initDashboardCharts() {
    dashSoilChart = createLineChart(
        'chart-soil-moisture',
        'Kelembapan Tanah',
        SENSOR_HISTORY.soilMoisture,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.green,
        0,
        100,
        '%'
    );

    dashTempChart = createLineChart(
        'chart-soil-temp',
        'Suhu Tanah',
        SENSOR_HISTORY.soilTemp,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.orange,
        15,
        45,
        DEG_C
    );

    dashHumChart = createLineChart(
        'chart-air-humidity',
        'Kelembapan Udara',
        SENSOR_HISTORY.airHumidity,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.blue,
        0,
        100,
        '%'
    );
}

function updateDashboardCharts() {
    updateChartData(dashSoilChart, SENSOR_HISTORY.soilMoisture, SENSOR_HISTORY_LABELS);
    updateChartData(dashTempChart, SENSOR_HISTORY.soilTemp, SENSOR_HISTORY_LABELS);
    updateChartData(dashHumChart, SENSOR_HISTORY.airHumidity, SENSOR_HISTORY_LABELS);
}

let monSoilChart;
let monSoilTempChart;
let monAirTempChart;
let monAirHumChart;

function initMonitoringCharts() {
    monSoilChart = createLineChart(
        'mon-chart-soil',
        'Kelembapan Tanah',
        SENSOR_HISTORY.soilMoisture,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.green,
        0,
        100,
        '%'
    );

    monSoilTempChart = createLineChart(
        'mon-chart-soil-temp',
        'Suhu Tanah',
        SENSOR_HISTORY.soilTemp,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.orange,
        15,
        45,
        DEG_C
    );

    monAirTempChart = createLineChart(
        'mon-chart-air-temp',
        'Suhu Udara',
        SENSOR_HISTORY.airTemp,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.cyan,
        15,
        45,
        DEG_C
    );

    monAirHumChart = createLineChart(
        'mon-chart-air-hum',
        'Kelembapan Udara',
        SENSOR_HISTORY.airHumidity,
        SENSOR_HISTORY_LABELS,
        CHART_COLORS.blue,
        0,
        100,
        '%'
    );
}

function updateMonitoringCharts() {
    updateChartData(monSoilChart, SENSOR_HISTORY.soilMoisture, SENSOR_HISTORY_LABELS);
    updateChartData(monSoilTempChart, SENSOR_HISTORY.soilTemp, SENSOR_HISTORY_LABELS);
    updateChartData(monAirTempChart, SENSOR_HISTORY.airTemp, SENSOR_HISTORY_LABELS);
    updateChartData(monAirHumChart, SENSOR_HISTORY.airHumidity, SENSOR_HISTORY_LABELS);
}
