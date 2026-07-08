// DATA DUMMY — bukan dari backend. Dipakai hanya sebagai fallback tampilan saat farm belum punya node sensor asli.

import type { FarmSummary, GatewayLog, IrrigationLog, Node, NodeSummary, Reading } from '@/types';

export const ENABLE_MOCK_NODE_FALLBACK = true;

export const MOCK_NODES: Node[] = [
  {
    id: 'mock-node-1',
    name: 'Node A',
    location: 'Blok Utara',
    status: 'online',
    battery: 88,
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-2',
    name: 'Node B',
    location: 'Blok Selatan',
    status: 'online',
    battery: 20,
    updated_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-3',
    name: 'Node C',
    location: 'Blok Timur',
    status: 'online',
    battery: 92,
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-4',
    name: 'Node D',
    location: 'Blok Barat',
    status: 'online',
    battery: 16,
    updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-5',
    name: 'Node E',
    location: 'Blok Tengah',
    status: 'online',
    battery: 81,
    updated_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-6',
    name: 'Node F',
    location: 'Blok Tenggara',
    status: 'online',
    battery: 95,
    updated_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-7',
    name: 'Node G',
    location: 'Blok Barat Laut',
    status: 'online',
    battery: 73,
    updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];
export const MOCK_NODE_COUNT = MOCK_NODES.length;

// Threshold demo: lower=40, upper=70.
// moisture < 40 -> valve open (irigasi); moisture >= 40 -> valve closed.
const HALF_HOUR = 30 * 60 * 1000;
const MOCK_READING_COUNT = 48;
const MOCK_READING_PROFILES: Record<string, { sm: number; st: number; at: number; ah: number }[]> = {
  'mock-node-1': [
    { sm: 35, st: 28, at: 31, ah: 72 },
    { sm: 33, st: 29, at: 32, ah: 70 },
    { sm: 38, st: 28, at: 30, ah: 73 },
    { sm: 32, st: 27, at: 31, ah: 71 },
    { sm: 36, st: 28, at: 31, ah: 72 },
    { sm: 30, st: 29, at: 30, ah: 74 },
  ],
  'mock-node-2': [
    { sm: 72, st: 27, at: 30, ah: 68 },
    { sm: 68, st: 28, at: 31, ah: 67 },
    { sm: 74, st: 27, at: 30, ah: 69 },
    { sm: 60, st: 26, at: 29, ah: 70 },
    { sm: 70, st: 27, at: 30, ah: 68 },
    { sm: 65, st: 28, at: 30, ah: 69 },
  ],
  'mock-node-3': [
    { sm: 28, st: 29, at: 32, ah: 65 },
    { sm: 26, st: 30, at: 33, ah: 64 },
    { sm: 30, st: 29, at: 32, ah: 66 },
    { sm: 22, st: 31, at: 34, ah: 63 },
    { sm: 27, st: 29, at: 32, ah: 65 },
    { sm: 25, st: 30, at: 33, ah: 64 },
  ],
  'mock-node-4': [
    { sm: 65, st: 26, at: 29, ah: 74 },
    { sm: 63, st: 27, at: 30, ah: 73 },
    { sm: 68, st: 26, at: 29, ah: 75 },
    { sm: 60, st: 27, at: 28, ah: 76 },
    { sm: 66, st: 26, at: 29, ah: 74 },
    { sm: 62, st: 27, at: 29, ah: 75 },
  ],
  'mock-node-5': [
    { sm: 57, st: 27, at: 30, ah: 72 },
    { sm: 55, st: 28, at: 31, ah: 71 },
    { sm: 60, st: 27, at: 30, ah: 73 },
    { sm: 52, st: 28, at: 30, ah: 72 },
    { sm: 58, st: 27, at: 31, ah: 71 },
    { sm: 54, st: 28, at: 30, ah: 72 },
  ],
  'mock-node-6': [
    { sm: 48, st: 27, at: 31, ah: 70 },
    { sm: 46, st: 28, at: 31, ah: 69 },
    { sm: 50, st: 27, at: 31, ah: 70 },
    { sm: 42, st: 28, at: 30, ah: 71 },
    { sm: 47, st: 27, at: 31, ah: 70 },
    { sm: 44, st: 28, at: 30, ah: 71 },
  ],
  'mock-node-7': [
    { sm: 19, st: 30, at: 33, ah: 61 },
    { sm: 17, st: 31, at: 34, ah: 60 },
    { sm: 22, st: 30, at: 33, ah: 62 },
    { sm: 15, st: 32, at: 35, ah: 59 },
    { sm: 20, st: 30, at: 33, ah: 61 },
    { sm: 18, st: 31, at: 34, ah: 60 },
  ],
};

const MOCK_NODE_IDS = MOCK_NODES.map((node) => node.id);

function simpleNoise(seed: number, i: number, range: number): number {
  const v = ((seed * 7 + i * 13 + 17) % 1000) / 1000;
  return (v - 0.5) * 2 * range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashNodeId(nodeId: string): number {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = (hash * 31 + nodeId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getMockNodeIdForNode(nodeId: string): string {
  const normalizedId = nodeId.trim().toLowerCase();
  if (MOCK_READING_PROFILES[normalizedId]) return normalizedId;

  const mockNodeMatch = normalizedId.match(/^mock-node-(\d+)$/);
  const index = mockNodeMatch
    ? Number(mockNodeMatch[1]) - 1
    : hashNodeId(normalizedId);

  return MOCK_NODE_IDS[Math.abs(index) % MOCK_NODE_IDS.length] ?? MOCK_NODE_IDS[0] ?? '';
}

export function generateMockReadingsForNode(nodeId: string, count = MOCK_READING_COUNT): Reading[] {
  const mockNodeId = getMockNodeIdForNode(nodeId);
  const profile = MOCK_READING_PROFILES[mockNodeId] ?? MOCK_READING_PROFILES[MOCK_NODE_IDS[0] ?? ''] ?? [];
  const seed = hashNodeId(mockNodeId || nodeId || 'mock-node');
  const now = Date.now();

  return Array.from({ length: count }, (_, i) => {
    const base = profile[i] ?? profile[i % Math.max(1, profile.length)] ?? { sm: 55, st: 27, at: 30, ah: 70 };
    const cycle = Math.sin((i + seed % 11) / 4);
    const isProfilePoint = i < profile.length;

    return {
      id: `${mockNodeId || nodeId}-r${i}`,
      soil_moisture: isProfilePoint
        ? base.sm
        : Math.round(clamp(base.sm + cycle * 4 + simpleNoise(seed, i, 2), 12, 90) * 10) / 10,
      soil_temp: isProfilePoint
        ? base.st
        : Math.round(clamp(base.st + cycle * 1.2 + simpleNoise(seed + 100, i, 0.6), 18, 35) * 10) / 10,
      air_temp: isProfilePoint
        ? base.at
        : Math.round(clamp(base.at + cycle * 1.8 + simpleNoise(seed + 200, i, 0.8), 24, 38) * 10) / 10,
      air_humidity: isProfilePoint
        ? base.ah
        : Math.round(clamp(base.ah - cycle * 3 + simpleNoise(seed + 300, i, 2), 50, 90)),
      created_at: new Date(now - i * HALF_HOUR).toISOString(),
    };
  });
}

export function getMockRssiForNode(nodeId: string): string {
  if (!nodeId) return '— dBm';
  const mockNodeId = getMockNodeIdForNode(nodeId);
  const seed = Array.from(mockNodeId || nodeId).reduce((a, c) => a + c.charCodeAt(0), 0);
  return `${-80 - (seed % 25)} dBm`;
}

function buildMockNodeSummary(node: Node): NodeSummary {
  const readings = generateMockReadingsForNode(node.id);
  const latest_reading = readings?.[0] ?? null;
  const moisture = latest_reading?.soil_moisture ?? null;
  let decision: { decision: string; valve_state: string } | null = null;
  if (moisture != null) {
    decision =
      moisture < 40
        ? { decision: 'Irigasi dijalankan', valve_state: 'open' }
        : { decision: 'Irigasi berhenti', valve_state: 'closed' };
  }
  return { node, latest_reading, decision, signal_rssi: getMockRssiForNode(node.id) };
}

export function getMockNodeSummaryForNode(nodeId: string): NodeSummary | null {
  const mockNodeId = getMockNodeIdForNode(nodeId);
  const node = MOCK_NODES.find((item) => item.id === mockNodeId);
  return node ? buildMockNodeSummary(node) : null;
}

export function mockNodeSummaries(): NodeSummary[] {
  return MOCK_NODES.map(buildMockNodeSummary);
}

function summarizeNodeList(nodes: NodeSummary[]) {
  const moistures = nodes
    .map((ns) => ns.latest_reading?.soil_moisture)
    .filter((m): m is number => m != null);
  const averageSoilMoisture =
    moistures.length > 0
      ? Math.round(moistures.reduce((a, b) => a + b, 0) / moistures.length)
      : null;
  const hasOnline = nodes.some((ns) => ns.node.status !== 'offline');
  const nodesProblem = nodes.filter((ns) => ns.node.status === 'offline').length;

  return { averageSoilMoisture, gatewayStatus: hasOnline ? 'online' : 'offline', nodesProblem } as const;
}

export function withMockNodeFallback(summary: FarmSummary): FarmSummary {
  if (!ENABLE_MOCK_NODE_FALLBACK) {
    return { ...summary, is_mock_data: false };
  }

  const needsFullMock = summary.nodes.length === 0;
  const needsMissingReadingMock = summary.nodes.some((ns) => ns.latest_reading == null);

  if (!needsFullMock && !needsMissingReadingMock) {
    return { ...summary, is_mock_data: false };
  }

  const nodes = needsFullMock
    ? mockNodeSummaries()
    : summary.nodes.map((ns) => {
        if (ns.latest_reading != null) return ns;

        const mockSummary = getMockNodeSummaryForNode(ns.node.id);
        if (!mockSummary) return ns;

        return {
          ...ns,
          node: {
            ...ns.node,
            battery: mockSummary.node.battery,
            updated_at: mockSummary.node.updated_at,
          },
          latest_reading: mockSummary.latest_reading,
          decision: mockSummary.decision,
          signal_rssi: mockSummary.signal_rssi,
        };
      });

  const { averageSoilMoisture, gatewayStatus, nodesProblem } = summarizeNodeList(nodes);

  return {
    ...summary,
    nodes,
    is_mock_data: true,
    gateway_status: gatewayStatus,
    average_soil_moisture: averageSoilMoisture,
    nodes_problem: nodesProblem,
    // weather WAJIB tetap dari summary asli, tidak diubah
  };
}

type MockLogInput = Omit<IrrigationLog, 'id' | 'created_at'> & {
  id: number;
  hour: number;
  minute: number;
};

const MOCK_LOG_DAY_START = (() => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date;
})();

function mockLogTimestamp(hour: number, minute: number): string {
  const date = new Date(MOCK_LOG_DAY_START);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function buildMockLog(log: MockLogInput): IrrigationLog {
  const { id, hour, minute, ...rest } = log;
  return {
    id: `mock-log-day-${String(id).padStart(2, '0')}`,
    ...rest,
    created_at: mockLogTimestamp(hour, minute),
  };
}

// DATA DUMMY — riwayat irigasi 1 hari operasional penuh.
// Node A dan B sengaja dibuat berbeda ritmenya supaya tidak terlihat copy-paste.
export const MOCK_LOGS: IrrigationLog[] = [
  buildMockLog({
    id: 23,
    hour: 0,
    minute: 18,
    node_id: 'mock-node-1',
    soil_moisture: 42,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan masih cukup setelah irigasi malam sebelumnya.',
  }),
  buildMockLog({
    id: 24,
    hour: 1,
    minute: 4,
    node_id: 'mock-node-2',
    soil_moisture: 40,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Pembacaan berada tepat di ambang aman, valve tidak dibuka.',
  }),
  buildMockLog({
    id: 25,
    hour: 1,
    minute: 49,
    node_id: 'mock-node-1',
    soil_moisture: 38,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Penurunan kelembapan terdeteksi di zona akar dangkal.',
  }),
  buildMockLog({
    id: 26,
    hour: 2,
    minute: 37,
    node_id: 'mock-node-2',
    soil_moisture: 43,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Blok Selatan menahan air lebih lama, valve tetap tertutup.',
  }),
  buildMockLog({
    id: 27,
    hour: 3,
    minute: 22,
    node_id: 'mock-node-1',
    soil_moisture: 44,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan naik setelah siklus pendek dini hari.',
  }),
  buildMockLog({
    id: 28,
    hour: 4,
    minute: 16,
    node_id: 'mock-node-2',
    soil_moisture: 36,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Area selatan mulai kering sebelum matahari terbit.',
  }),
  buildMockLog({
    id: 1,
    hour: 5,
    minute: 47,
    node_id: 'mock-node-1',
    soil_moisture: 31,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Kelembapan turun setelah malam kering; irigasi pagi dimulai.',
  }),
  buildMockLog({
    id: 2,
    hour: 6,
    minute: 33,
    node_id: 'mock-node-2',
    soil_moisture: 45,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Blok Selatan masih cukup lembap, valve tetap ditutup.',
  }),
  buildMockLog({
    id: 3,
    hour: 7,
    minute: 8,
    node_id: 'mock-node-1',
    soil_moisture: 36,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Debit stabil; penyiraman dilanjutkan sampai target minimum tercapai.',
  }),
  buildMockLog({
    id: 4,
    hour: 7,
    minute: 52,
    node_id: 'mock-node-2',
    soil_moisture: 39,
    weather: 'Cerah berawan',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Area selatan turun di bawah batas bawah lebih cepat dari blok utara.',
  }),
  buildMockLog({
    id: 29,
    hour: 8,
    minute: 21,
    node_id: 'mock-node-2',
    soil_moisture: 42,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Siklus pagi Node B selesai lebih cepat karena kelembapan sudah pulih.',
  }),
  buildMockLog({
    id: 5,
    hour: 9,
    minute: 12,
    node_id: 'mock-node-1',
    soil_moisture: 43,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan mulai pulih; valve ditutup untuk menghindari overwatering.',
  }),
  buildMockLog({
    id: 30,
    hour: 9,
    minute: 58,
    node_id: 'mock-node-2',
    soil_moisture: 37,
    weather: 'Cerah berawan',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Angin pagi membuat Blok Selatan turun lagi di bawah batas.',
  }),
  buildMockLog({
    id: 6,
    hour: 10,
    minute: 26,
    node_id: 'mock-node-2',
    soil_moisture: 34,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Area selatan lebih cepat kering, irigasi pendek dijalankan.',
  }),
  buildMockLog({
    id: 7,
    hour: 11,
    minute: 18,
    node_id: 'mock-node-1',
    soil_moisture: 50,
    weather: 'Berawan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan aman dan suhu tanah stabil, valve tetap tertutup.',
  }),
  buildMockLog({
    id: 31,
    hour: 11,
    minute: 43,
    node_id: 'mock-node-2',
    soil_moisture: 41,
    weather: 'Berawan',
    decision: 'Irigasi ditunda',
    valve_state: 'closed',
    reason: 'Model cuaca mulai membaca peluang hujan, siklus berikutnya ditahan.',
  }),
  buildMockLog({
    id: 8,
    hour: 12,
    minute: 7,
    node_id: 'mock-node-2',
    soil_moisture: 38,
    weather: 'Berawan',
    decision: 'Irigasi ditunda',
    valve_state: 'closed',
    reason: 'Prediksi hujan masuk dalam tiga jam, irigasi ditunda meski tanah mulai kering.',
  }),
  buildMockLog({
    id: 9,
    hour: 12,
    minute: 46,
    node_id: 'mock-node-1',
    soil_moisture: 41,
    weather: 'Mendung',
    decision: 'Irigasi ditunda',
    valve_state: 'closed',
    reason: 'Awan hujan terdeteksi; jadwal siram siang ditahan sementara.',
  }),
  buildMockLog({
    id: 10,
    hour: 13,
    minute: 29,
    node_id: 'mock-node-2',
    soil_moisture: 36,
    weather: 'Mendung',
    decision: 'Irigasi ditunda',
    valve_state: 'closed',
    reason: 'Peluang hujan meningkat di blok selatan, valve tidak dibuka.',
  }),
  buildMockLog({
    id: 32,
    hour: 13,
    minute: 54,
    node_id: 'mock-node-1',
    soil_moisture: 46,
    weather: 'Gerimis',
    decision: 'Irigasi ditunda',
    valve_state: 'closed',
    reason: 'Gerimis mulai muncul, sistem menunggu efek hujan sebelum membuka valve.',
  }),
  buildMockLog({
    id: 11,
    hour: 14,
    minute: 8,
    node_id: 'mock-node-1',
    soil_moisture: 58,
    weather: 'Hujan ringan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Hujan mulai turun, valve dikunci tertutup.',
  }),
  buildMockLog({
    id: 12,
    hour: 14,
    minute: 52,
    node_id: 'mock-node-2',
    soil_moisture: 63,
    weather: 'Hujan sedang',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan naik cepat setelah hujan; valve tetap tertutup.',
  }),
  buildMockLog({
    id: 13,
    hour: 15,
    minute: 37,
    node_id: 'mock-node-1',
    soil_moisture: 67,
    weather: 'Hujan ringan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Tanah sudah basah merata, tidak perlu irigasi tambahan.',
  }),
  buildMockLog({
    id: 33,
    hour: 15,
    minute: 59,
    node_id: 'mock-node-2',
    soil_moisture: 68,
    weather: 'Hujan ringan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan Node B mendekati batas atas, valve dipertahankan tertutup.',
  }),
  buildMockLog({
    id: 14,
    hour: 16,
    minute: 24,
    node_id: 'mock-node-2',
    soil_moisture: 59,
    weather: 'Berawan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Drainase normal, kelembapan masih dalam rentang aman.',
  }),
  buildMockLog({
    id: 15,
    hour: 17,
    minute: 11,
    node_id: 'mock-node-1',
    soil_moisture: 54,
    weather: 'Cerah berawan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Sore relatif stabil, valve tetap tertutup.',
  }),
  buildMockLog({
    id: 16,
    hour: 17,
    minute: 48,
    node_id: 'mock-node-2',
    soil_moisture: 52,
    weather: 'Cerah berawan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan cukup untuk fase sore, penyiraman dilewati.',
  }),
  buildMockLog({
    id: 34,
    hour: 18,
    minute: 7,
    node_id: 'mock-node-2',
    soil_moisture: 49,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Penurunan pascahujan masih lambat, Node B belum perlu disiram.',
  }),
  buildMockLog({
    id: 17,
    hour: 18,
    minute: 26,
    node_id: 'mock-node-1',
    soil_moisture: 51,
    weather: 'Cerah',
    decision: 'Sensor reconnect',
    valve_state: 'closed',
    reason: 'Sensor Node A reconnect setelah sinyal melemah; data terakhir dipakai sementara.',
  }),
  buildMockLog({
    id: 35,
    hour: 18,
    minute: 44,
    node_id: 'mock-node-1',
    soil_moisture: 49,
    weather: 'Cerah',
    decision: 'Peringatan baterai rendah',
    valve_state: 'closed',
    reason: 'Baterai Node A turun sementara, pembacaan tetap valid tapi perlu dipantau.',
  }),
  buildMockLog({
    id: 18,
    hour: 19,
    minute: 3,
    node_id: 'mock-node-2',
    soil_moisture: 47,
    weather: 'Cerah',
    decision: 'Data delay',
    valve_state: 'closed',
    reason: 'Data Node B terlambat 11 menit, keputusan valve ditahan sampai pembacaan berikutnya.',
  }),
  buildMockLog({
    id: 36,
    hour: 19,
    minute: 36,
    node_id: 'mock-node-2',
    soil_moisture: 42,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Data susulan menunjukkan kelembapan masih aman, valve tetap tertutup.',
  }),
  buildMockLog({
    id: 19,
    hour: 20,
    minute: 14,
    node_id: 'mock-node-1',
    soil_moisture: 39,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Tanah mulai turun di bawah batas, irigasi malam singkat dijalankan.',
  }),
  buildMockLog({
    id: 37,
    hour: 20,
    minute: 49,
    node_id: 'mock-node-1',
    soil_moisture: 45,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Siklus malam Node A selesai, kelembapan kembali ke rentang aman.',
  }),
  buildMockLog({
    id: 20,
    hour: 21,
    minute: 6,
    node_id: 'mock-node-2',
    soil_moisture: 44,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Blok Selatan masih cukup lembap setelah hujan siang.',
  }),
  buildMockLog({
    id: 38,
    hour: 21,
    minute: 39,
    node_id: 'mock-node-2',
    soil_moisture: 39,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Node B turun tipis di bawah batas, sistem membuka valve bertahap.',
  }),
  buildMockLog({
    id: 21,
    hour: 22,
    minute: 18,
    node_id: 'mock-node-1',
    soil_moisture: 35,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Kelembapan turun cepat setelah angin malam, valve dibuka kembali.',
  }),
  buildMockLog({
    id: 39,
    hour: 22,
    minute: 57,
    node_id: 'mock-node-1',
    soil_moisture: 41,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Node A mencapai target minimum, penyiraman malam dihentikan.',
  }),
  buildMockLog({
    id: 22,
    hour: 23,
    minute: 41,
    node_id: 'mock-node-2',
    soil_moisture: 37,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Node B melewati batas bawah menjelang tengah malam, irigasi aktif.',
  }),
  buildMockLog({
    id: 40,
    hour: 23,
    minute: 58,
    node_id: 'mock-node-2',
    soil_moisture: 42,
    weather: 'Cerah',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Siklus penutup hari selesai, kelembapan Node B kembali aman.',
  }),
];

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
