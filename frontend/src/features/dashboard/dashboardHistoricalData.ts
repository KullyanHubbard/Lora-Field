// Adapter chart historis dashboard. Untuk sementara tidak mengisi data sintetis;
// data asli bisa disambungkan dari endpoint readings/history saat tersedia.

export interface FarmMetricChartPoint {
  label: string; // jam "HH.MM" (format id-ID), jarak antar titik 1 jam
  soil_moisture: number; // %
  soil_temp: number; // °C
  air_temp: number; // °C
  air_humidity: number; // %
}

export function getHistoricalDataForNode(nodeId: string): FarmMetricChartPoint[] {
  void nodeId;
  return [];
}
