// DATA DUMMY — bukan dari backend. Dipakai hanya sebagai fallback tampilan saat farm belum punya node sensor asli.

import type { FarmSummary, Node, NodeSummary, Reading } from '@/types';

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
