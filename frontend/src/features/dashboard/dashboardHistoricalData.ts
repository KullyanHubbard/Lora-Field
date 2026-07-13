// Adapter chart untuk historical readings dummy. Nilai dan cadence tetap berasal
// dari single source of truth mockFarmScenario.

import {
  ENABLE_MOCK_NODE_FALLBACK,
  MOCK_FARM_SCENARIO,
  generateMockReadingsForNode,
} from '@/mocks/mockFarmScenario';

export interface FarmMetricChartPoint {
  label: string; // jam "HH.MM" (format id-ID), jarak antar titik 1 jam
  soil_moisture: number; // %
  soil_temp: number; // °C
  air_temp: number; // °C
  air_humidity: number; // %
}

// 6 titik, jarak 1 jam. Label diambil dari timestamp reading agar cadence dan
// label tidak bisa saling berbeda.
export const POINTS = MOCK_FARM_SCENARIO.reading.dashboardHistory.pointCount;

function historicalSeriesFromReadings(nodeId: string): FarmMetricChartPoint[] {
  const readings = generateMockReadingsForNode(nodeId, POINTS, {
    intervalMinutes: MOCK_FARM_SCENARIO.reading.dashboardHistory.intervalMinutes,
  }).reverse();

  return readings.map((reading) => {
    return {
      label: new Date(reading.created_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      soil_moisture: reading.soil_moisture,
      soil_temp: reading.soil_temp,
      air_temp: reading.air_temp,
      air_humidity: reading.air_humidity,
    };
  });
}

export function getHistoricalDataForNode(nodeId: string): FarmMetricChartPoint[] {
  if (!ENABLE_MOCK_NODE_FALLBACK) return [];
  return nodeId.trim() ? historicalSeriesFromReadings(nodeId) : [];
}
