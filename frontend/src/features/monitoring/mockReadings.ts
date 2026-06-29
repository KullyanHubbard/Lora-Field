// Mock data sementara untuk development tanpa backend.
// TODO: revert — hapus file ini dan set USE_MOCK_DATA = false setelah backend/go-live.
import type { Reading } from '@/types';

const BASE_TIME = Date.now();

function reading(id: string, offset: number, overrides: Partial<Reading> = {}): Reading {
  const ts = new Date(BASE_TIME - offset * 60 * 60 * 1000).toISOString();
  return {
    id: `${id}-${offset}`,
    soil_moisture: 0,
    soil_temp: 0,
    air_temp: 0,
    air_humidity: 0,
    created_at: ts,
    ...overrides,
  };
}

/**
 * Generate 24-48 mock readings per node — cukup untuk agregasi moving average,
 * Bollinger bands, dan chunk grouping.
 */
export function generateMockReadings(nodeId: string): Reading[] {
  // 36 titik, jarak ~30 menit = 18 jam data
  const count = 36;
  const readings: Reading[] = [];
  const seed = nodeId.length > 0 ? nodeId.charCodeAt(nodeId.length - 1) : 42;

  for (let i = 0; i < count; i++) {
    const t = count - 1 - i; // older first
    const hoursAgo = t * 0.5;
    // Pseudo-random based on seed + i, avoiding Math.random for reproducibility
    const r = (seed: number, i: number, range: number, base: number) => {
      const v = ((seed * 7 + i * 13) % 100) / 100;
      return base + v * range;
    };

    readings.push(
      reading(nodeId, hoursAgo, {
        soil_moisture: Math.round(r(seed, i, 50, 20)),       // 20-70%
        soil_temp: parseFloat(r(seed + 3, i, 12, 20).toFixed(1)),    // 20-32°C
        air_temp: parseFloat(r(seed + 7, i, 16, 24).toFixed(1)),     // 24-40°C
        air_humidity: Math.round(r(seed + 11, i, 40, 45)),   // 45-85%
      }),
    );
  }

  return readings;
}