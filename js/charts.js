// Helper buat render grafik pake Chart.js v4

const CHART_COLORS = {
    green: { border: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    blue: { border: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    orange: { border: '#ea580c', bg: 'rgba(234,88,12,0.12)' },
    cyan: { border: '#0891b2', bg: 'rgba(8,145,178,0.12)' }
};

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1a1a1a',
            bodyColor: '#555555',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { family: 'Inter, system-ui', size: 12, weight: '600' },
            bodyFont: { family: 'Inter, system-ui', size: 11 }
        }
    },
    scales: {
        x: {
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            ticks: { color: '#9ca3af', font: { size: 10, family: 'Inter, system-ui' } },
            border: { display: false }
        },
        y: {
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            ticks: { color: '#9ca3af', font: { size: 10, family: 'Inter, system-ui' } },
            border: { display: false }
        }
    },
    animation: { duration: 800, easing: 'easeOutQuart' }
};

function createLineChart(canvasId, label, data, labels, color, yMin, yMax, unit) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, color.bg.replace('0.12', '0.25'));
    gradient.addColorStop(1, color.bg.replace('0.12', '0.02'));

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color.border,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: '#fff',
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
                        callback: v => v + (unit || '')
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

// Dashboard charts initialization
let dashSoilChart, dashTempChart, dashHumChart;

function initDashboardCharts() {
    dashSoilChart = createLineChart(
        'chart-soil-moisture', 'Kelembapan Tanah',
        SENSOR_HISTORY.soilMoisture, SENSOR_HISTORY_LABELS,
        CHART_COLORS.green, 0, 100, '%'
    );
    dashTempChart = createLineChart(
        'chart-soil-temp', 'Suhu Tanah',
        SENSOR_HISTORY.soilTemp, SENSOR_HISTORY_LABELS,
        CHART_COLORS.orange, 15, 45, '°C'
    );
    dashHumChart = createLineChart(
        'chart-air-humidity', 'Kelembapan Udara',
        SENSOR_HISTORY.airHumidity, SENSOR_HISTORY_LABELS,
        CHART_COLORS.blue, 0, 100, '%'
    );
}

function updateDashboardCharts() {
    updateChartData(dashSoilChart, SENSOR_HISTORY.soilMoisture, SENSOR_HISTORY_LABELS);
    updateChartData(dashTempChart, SENSOR_HISTORY.soilTemp, SENSOR_HISTORY_LABELS);
    updateChartData(dashHumChart, SENSOR_HISTORY.airHumidity, SENSOR_HISTORY_LABELS);
}

// Monitoring charts
let monSoilChart, monSoilTempChart, monAirTempChart, monAirHumChart;

function initMonitoringCharts() {
    monSoilChart = createLineChart(
        'mon-chart-soil', 'Kelembapan Tanah',
        SENSOR_HISTORY.soilMoisture, SENSOR_HISTORY_LABELS,
        CHART_COLORS.green, 0, 100, '%'
    );
    monSoilTempChart = createLineChart(
        'mon-chart-soil-temp', 'Suhu Tanah',
        SENSOR_HISTORY.soilTemp, SENSOR_HISTORY_LABELS,
        CHART_COLORS.orange, 15, 45, '°C'
    );
    monAirTempChart = createLineChart(
        'mon-chart-air-temp', 'Suhu Udara',
        SENSOR_HISTORY.airTemp, SENSOR_HISTORY_LABELS,
        CHART_COLORS.cyan, 15, 45, '°C'
    );
    monAirHumChart = createLineChart(
        'mon-chart-air-hum', 'Kelembapan Udara',
        SENSOR_HISTORY.airHumidity, SENSOR_HISTORY_LABELS,
        CHART_COLORS.blue, 0, 100, '%'
    );
}

function updateMonitoringCharts() {
    updateChartData(monSoilChart, SENSOR_HISTORY.soilMoisture, SENSOR_HISTORY_LABELS);
    updateChartData(monSoilTempChart, SENSOR_HISTORY.soilTemp, SENSOR_HISTORY_LABELS);
    updateChartData(monAirTempChart, SENSOR_HISTORY.airTemp, SENSOR_HISTORY_LABELS);
    updateChartData(monAirHumChart, SENSOR_HISTORY.airHumidity, SENSOR_HISTORY_LABELS);
}
