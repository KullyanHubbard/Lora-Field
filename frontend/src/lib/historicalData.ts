// ponytail: DATA DUMMY/mock — BUKAN dari backend. Ganti dgn readings asli saat
// backend punya endpoint riwayat per-node. Dipakai untuk tile Min/Rata-rata/Maks
// + grafik historis kompak di kartu metrik Ringkasan Kebun (FarmDetailPage).

export interface ChartPoint {
  label: string; // jam "HH.MM" (format id-ID), jarak antar titik 1 jam
  soil_moisture: number; // %
  soil_temp: number; // °C
  air_temp: number; // °C
  air_humidity: number; // %
}

// 6 titik, jarak 1 jam. Label = 6 jam terakhir s/d jam berjalan
// (mis. "08.00, 09.00, 10.00, 11.00, 12.00, 13.00").
const POINTS = 6;

function hourlyLabels(count: number): string[] {
  const anchor = new Date();
  anchor.setMinutes(0, 0, 0);
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * 3_600_000);
    labels.push(d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  }
  return labels;
}

function jitter(base: number, range: number): number {
  return +(base + (Math.random() - 0.5) * range).toFixed(1);
}

function genSeries(seed: { sm: number; st: number; at: number; ah: number }): ChartPoint[] {
  const labels = hourlyLabels(POINTS);
  return labels.map((label) => {
    seed.sm = jitter(seed.sm, 6);
    seed.st = jitter(seed.st, 2);
    seed.at = jitter(seed.at, 3);
    seed.ah = jitter(seed.ah, 8);
    return {
      label,
      soil_moisture: Math.min(100, Math.max(0, seed.sm)),
      soil_temp: +seed.st.toFixed(1),
      air_temp: +seed.at.toFixed(1),
      air_humidity: Math.min(100, Math.max(0, seed.ah)),
    };
  });
}

// Tiap node punya base value sedikit beda agar ganti dropdown terlihat berubah.
export const historicalData: Record<string, ChartPoint[]> = {
  'node-a': genSeries({ sm: 68, st: 26.5, at: 29.0, ah: 72 }),
  'node-b': genSeries({ sm: 55, st: 25.0, at: 28.0, ah: 65 }),
  'node-c': genSeries({ sm: 78, st: 27.2, at: 30.5, ah: 80 }),
  'node-d': genSeries({ sm: 42, st: 24.0, at: 27.0, ah: 58 }),
};
