import type { GatewayLog } from '@/types';

// DATA DUMMY — log aktivitas gateway. Dipakai sebagai placeholder di halaman
// Ringkasan Kebun saat backend belum mengirim log koneksi gateway.
// Spread ~3 hari, campuran connected / disconnected / heartbeat / data_sync.
const H = 60 * 60 * 1000;
export const MOCK_GATEWAY_LOGS: GatewayLog[] = (() => {
  const logs: GatewayLog[] = [];
  const events = [
    { event: 'connected', detail: 'Gateway berhasil terhubung melalui WiFi' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 7 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 5 pembacaan sensor ke server' },
    { event: 'disconnected', detail: 'Koneksi WiFi terputus sementara' },
    { event: 'connected', detail: 'Gateway berhasil terhubung kembali' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 3 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 6 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 7 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'disconnected', detail: 'Koneksi WiFi terputus (listrik padam)' },
    { event: 'connected', detail: 'Gateway berhasil terhubung melalui WiFi' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 7 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 6 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 3 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 5 pembacaan sensor ke server' },
  ];
  // 20 entries, spread mundur ~6 jam per entry = ~5 hari coverage
  for (let i = 0; i < events.length; i++) {
    const offset = (i * 6 + 4) * H;
    logs.push({
      id: `mock-gwlog-${i + 1}`,
      farm_id: '',
      event: events[i].event,
      detail: events[i].detail,
      created_at: new Date(Date.now() - offset).toISOString(),
    });
  }
  return logs;
})();
