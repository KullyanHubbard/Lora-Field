// Mock data realistis untuk development tanpa backend.
// TODO: revert — hapus file ini dan set USE_MOCK_DATA = false setelah backend/go-live.
import type { Reading } from '@/types';

/**
 * Model natural:
 * - Variasi kecil naik-turun (±3-5% per titik) seperti sensor real
 * - Ada titik di bawah 40% (trigger irigasi)
 * - Ada titik di atas 70% (zona basah)
 * - Mayoritas di zona 40-70%
 * - Tidak rata, ada fluktuasi natural
 */

const BASE_TIME = Date.now();

function simpleNoise(seed: number, i: number, range: number): number {
  // Pseudo-random deterministik
  const v = ((seed * 7 + i * 13 + 17) % 1000) / 1000;
  return (v - 0.5) * 2 * range; // -range sampai +range
}

export function generateMockReadings(nodeId: string): Reading[] {
  const count = 48; // 48 titik @ 30 menit = 24 jam
  const readings: Reading[] = [];
  const seed = nodeId.length > 0 ? nodeId.charCodeAt(nodeId.length - 1) : 42;

  // Pola dasar: mulai dari 55%, lalu naik turun natural
  // dengan beberapa event: irigasi (lonjakan), hujan (lonjakan besar), evaporasi (turun pelan)
  const basePattern = [
    // 0-8: mulai dari basah (setelah hujan kemarin)
    72, 70, 68, 65, 63, 61, 58, 56,
    // 8-16: turun ke zona normal
    54, 52, 50, 48, 46, 44, 42, 40,
    // 16-24: irigasi otomatis, naik ke 55-60%
    55, 58, 60, 59, 57, 55, 53, 51,
    // 24-32: evaporasi pelan
    49, 47, 45, 43, 41, 39, 38, 36,
    // 32-40: irigasi lagi, naik
    52, 56, 59, 61, 63, 65, 67, 69,
    // 40-48: hujan sore, lonjakan tinggi
    72, 75, 78, 80, 82, 79, 76, 73,
  ];

  for (let i = 0; i < count; i++) {
    const t = count - 1 - i;
    const hoursAgo = t * 0.5;
    const ts = new Date(BASE_TIME - hoursAgo * 60 * 60 * 1000).toISOString();

    // Ambil nilai dasar dari pola
    const baseValue = basePattern[i] ?? 55;
    const clusterDrift = Math.sin(i / 5) * 1.4;

    // Tambah noise kecil (±2-4%)
    const noise = simpleNoise(seed, i, 3);
    const moisture = Math.max(20, Math.min(90, baseValue + clusterDrift + noise));

    // Suhu udara: siklus harian 28-34°C
    const hourOfDay = (new Date(ts).getHours() + 7) % 24;

    // Suhu tanah: siklus harian + flare kecil biar tidak rata
    const soilBase = 25.5 + Math.sin((hourOfDay - 5) * Math.PI / 12) * 2.1;
    const soilPulse = i % 12 === 3 ? 1.2 : i % 12 === 9 ? -0.8 : 0;
    const soilTemp = soilBase + soilPulse + simpleNoise(seed + 100, i, 0.8);
    const tempCycle = Math.sin((hourOfDay - 6) * Math.PI / 12) * 3;
    const airTemp = 31 + tempCycle + simpleNoise(seed + 200, i, 1);

    // Kelembapan udara: 60-80%, berbanding terbalik dengan suhu
    const airHumidity = 70 - tempCycle * 2 + simpleNoise(seed + 300, i, 3);

    readings.push({
      id: `${nodeId}-${i}`,
      soil_moisture: Math.round(moisture * 10) / 10,
      soil_temp: Math.round(soilTemp * 10) / 10,
      air_temp: Math.round(airTemp * 10) / 10,
      air_humidity: Math.round(Math.max(50, Math.min(90, airHumidity))),
      created_at: ts,
    });
  }

  return readings;
}
