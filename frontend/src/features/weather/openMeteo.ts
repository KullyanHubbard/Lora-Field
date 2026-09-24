import { OPEN_METEO_FORECAST_URL } from '@/features/weather/constants';

interface OpenMeteoPoint {
  time: string;
  temp: number;
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
}

export async function fetchWeatherHistory(lat: number, lon: number): Promise<OpenMeteoPoint[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m',
    past_days: '1',
    timezone: 'auto',
  });
  const res = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json: OpenMeteoResponse = await res.json();
  const { time, temperature_2m } = json.hourly;

  // Ambil hanya 6 jam terakhir sampai sekarang (buang jam ke depan)
  // ponytail: timezone=auto kirim ISO naive (TZ kebun); cocok krn user+kebun se-TZ (WIB). beda TZ → tambah offset
  const now = Date.now();
  const from = now - 6 * 60 * 60_000; // 6 jam saja, sesuai label chart
  const out: OpenMeteoPoint[] = [];
  for (let i = 0; i < time.length; i++) {
    const t = temperature_2m[i];
    if (t == null) continue;
    const ms = new Date(time[i]).getTime();
    if (ms >= from && ms <= now) out.push({ time: time[i], temp: t });
  }
  out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return out;
}
