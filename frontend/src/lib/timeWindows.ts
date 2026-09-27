// Rentang waktu grafik dan pengambilan data reading, dipakai bersama beberapa fitur.
export const HOUR_MS = 60 * 60 * 1000;

export const MONITORING_WINDOW_HOURS = 12; // grafik halaman Monitoring
export const METRIC_CARD_WINDOW_HOURS = 6; // kartu metrik Ringkasan Kebun
export const METRIC_CARD_SLOT_MINUTES = 30; // satu titik grafik kartu metrik = rata-rata 30 menit

// Reading diambil per rentang jam (bukan jumlah baris), satu kali untuk rentang
// terpanjang, supaya Dashboard dan Monitoring berbagi cache yang sama.
export const READINGS_FETCH_HOURS = Math.max(MONITORING_WINDOW_HOURS, METRIC_CARD_WINDOW_HOURS);

export function startOfHour(time: number): number {
  const date = new Date(time);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

// Awal slot waktu lokal, mis. slot 30 menit: 09.47 -> 09.30.
export function startOfSlot(time: number, slotMinutes: number): number {
  const date = new Date(time);
  date.setMinutes(Math.floor(date.getMinutes() / slotMinutes) * slotMinutes, 0, 0);
  return date.getTime();
}
