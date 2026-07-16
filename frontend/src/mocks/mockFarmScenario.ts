// Single source of truth untuk seluruh data dummy operasional satu kebun.
// Identitas/lokasi/komoditas kebun tetap berasal dari API; module ini hanya
// mengisi device data yang belum tersedia. Weather/BMKG tidak disimulasikan.

import type { FarmSummary, GatewayLog, IrrigationLog, Node, NodeSummary, Reading } from '@/types';

type MockSensorReading = {
  soilMoisture: number;
  soilTemp: number;
  airTemp: number;
  airHumidity: number;
};

type MockNodeFixture = {
  id: string;
  name: string;
  location: string;
  status: string;
  battery: number;
  lastSeenMinutesAgo: number;
  rssiDbm: number;
  readings: readonly MockSensorReading[];
};

type MockGatewayConnection = {
  signalValueKey: string;
  internetValueKey: string;
};

type MockFarmScenario = {
  enabled: boolean;
  sensorTypes: readonly ['soil_moisture', 'soil_temp', 'air_temp', 'air_humidity'];
  thresholds: { lower: number; upper: number };
  reading: {
    defaultCount: number;
    intervalMinutes: number;
    dashboardHistory: { pointCount: number; intervalMinutes: number };
  };
  nodes: readonly MockNodeFixture[];
  irrigation: {
    logCount: number;
    logIntervalMinutes: number;
  };
  gateway: {
    idPrefix: string;
    logIntervalHours: number;
    events: readonly ('connected' | 'disconnected' | 'heartbeat' | 'data_sync')[];
    connectionByStatus: Record<FarmSummary['gateway_status'], MockGatewayConnection>;
  };
};

export const MOCK_FARM_SCENARIO = {
  enabled: true,
  sensorTypes: ['soil_moisture', 'soil_temp', 'air_temp', 'air_humidity'],
  thresholds: { lower: 40, upper: 70 },
  reading: {
    defaultCount: 48,
    intervalMinutes: 30,
    dashboardHistory: { pointCount: 6, intervalMinutes: 60 },
  },
  nodes: [
    {
      id: 'mock-node-1',
      name: 'Node A',
      location: 'Blok Utara',
      status: 'online',
      battery: 88,
      lastSeenMinutesAgo: 10,
      rssiDbm: -92,
      readings: [
        { soilMoisture: 35, soilTemp: 28, airTemp: 31, airHumidity: 72 },
        { soilMoisture: 33, soilTemp: 29, airTemp: 32, airHumidity: 70 },
        { soilMoisture: 38, soilTemp: 28, airTemp: 30, airHumidity: 73 },
        { soilMoisture: 32, soilTemp: 27, airTemp: 31, airHumidity: 71 },
        { soilMoisture: 36, soilTemp: 28, airTemp: 31, airHumidity: 72 },
        { soilMoisture: 30, soilTemp: 29, airTemp: 30, airHumidity: 74 },
      ],
    },
    {
      id: 'mock-node-2',
      name: 'Node B',
      location: 'Blok Selatan',
      status: 'online',
      battery: 20,
      lastSeenMinutesAgo: 35,
      rssiDbm: -86,
      readings: [
        { soilMoisture: 72, soilTemp: 27, airTemp: 30, airHumidity: 68 },
        { soilMoisture: 68, soilTemp: 28, airTemp: 31, airHumidity: 67 },
        { soilMoisture: 74, soilTemp: 27, airTemp: 30, airHumidity: 69 },
        { soilMoisture: 60, soilTemp: 26, airTemp: 29, airHumidity: 70 },
        { soilMoisture: 70, soilTemp: 27, airTemp: 30, airHumidity: 68 },
        { soilMoisture: 65, soilTemp: 28, airTemp: 30, airHumidity: 69 },
      ],
    },
    {
      id: 'mock-node-3',
      name: 'Node C',
      location: 'Blok Timur',
      status: 'online',
      battery: 92,
      lastSeenMinutesAgo: 5,
      rssiDbm: -78,
      readings: [
        { soilMoisture: 28, soilTemp: 29, airTemp: 32, airHumidity: 65 },
        { soilMoisture: 26, soilTemp: 30, airTemp: 33, airHumidity: 64 },
        { soilMoisture: 30, soilTemp: 29, airTemp: 32, airHumidity: 66 },
        { soilMoisture: 22, soilTemp: 31, airTemp: 34, airHumidity: 63 },
        { soilMoisture: 27, soilTemp: 29, airTemp: 32, airHumidity: 65 },
        { soilMoisture: 25, soilTemp: 30, airTemp: 33, airHumidity: 64 },
      ],
    },
    {
      id: 'mock-node-4',
      name: 'Node D',
      location: 'Blok Barat',
      status: 'online',
      battery: 16,
      lastSeenMinutesAgo: 20,
      rssiDbm: -97,
      readings: [
        { soilMoisture: 65, soilTemp: 26, airTemp: 29, airHumidity: 74 },
        { soilMoisture: 63, soilTemp: 27, airTemp: 30, airHumidity: 73 },
        { soilMoisture: 68, soilTemp: 26, airTemp: 29, airHumidity: 75 },
        { soilMoisture: 60, soilTemp: 27, airTemp: 28, airHumidity: 76 },
        { soilMoisture: 66, soilTemp: 26, airTemp: 29, airHumidity: 74 },
        { soilMoisture: 62, soilTemp: 27, airTemp: 29, airHumidity: 75 },
      ],
    },
    {
      id: 'mock-node-5',
      name: 'Node E',
      location: 'Blok Tengah',
      status: 'online',
      battery: 81,
      lastSeenMinutesAgo: 180,
      rssiDbm: -89,
      readings: [
        { soilMoisture: 57, soilTemp: 27, airTemp: 30, airHumidity: 72 },
        { soilMoisture: 55, soilTemp: 28, airTemp: 31, airHumidity: 71 },
        { soilMoisture: 60, soilTemp: 27, airTemp: 30, airHumidity: 73 },
        { soilMoisture: 52, soilTemp: 28, airTemp: 30, airHumidity: 72 },
        { soilMoisture: 58, soilTemp: 27, airTemp: 31, airHumidity: 71 },
        { soilMoisture: 54, soilTemp: 28, airTemp: 30, airHumidity: 72 },
      ],
    },
    {
      id: 'mock-node-6',
      name: 'Node F',
      location: 'Blok Tenggara',
      status: 'online',
      battery: 95,
      lastSeenMinutesAgo: 8,
      rssiDbm: -74,
      readings: [
        { soilMoisture: 48, soilTemp: 27, airTemp: 31, airHumidity: 70 },
        { soilMoisture: 46, soilTemp: 28, airTemp: 31, airHumidity: 69 },
        { soilMoisture: 50, soilTemp: 27, airTemp: 31, airHumidity: 70 },
        { soilMoisture: 42, soilTemp: 28, airTemp: 30, airHumidity: 71 },
        { soilMoisture: 47, soilTemp: 27, airTemp: 31, airHumidity: 70 },
        { soilMoisture: 44, soilTemp: 28, airTemp: 30, airHumidity: 71 },
      ],
    },
    {
      id: 'mock-node-7',
      name: 'Node G',
      location: 'Blok Barat Laut',
      status: 'online',
      battery: 73,
      lastSeenMinutesAgo: 45,
      rssiDbm: -84,
      readings: [
        { soilMoisture: 19, soilTemp: 30, airTemp: 33, airHumidity: 61 },
        { soilMoisture: 17, soilTemp: 31, airTemp: 34, airHumidity: 60 },
        { soilMoisture: 22, soilTemp: 30, airTemp: 33, airHumidity: 62 },
        { soilMoisture: 15, soilTemp: 32, airTemp: 35, airHumidity: 59 },
        { soilMoisture: 20, soilTemp: 30, airTemp: 33, airHumidity: 61 },
        { soilMoisture: 18, soilTemp: 31, airTemp: 34, airHumidity: 60 },
      ],
    },
  ],
  irrigation: {
    logCount: 40,
    logIntervalMinutes: 36,
  },
  gateway: {
    idPrefix: 'gw',
    logIntervalHours: 6,
    events: [
      'connected',
      'heartbeat',
      'data_sync',
      'heartbeat',
      'data_sync',
      'disconnected',
      'connected',
      'heartbeat',
      'data_sync',
      'heartbeat',
      'data_sync',
      'heartbeat',
      'disconnected',
      'connected',
      'heartbeat',
      'data_sync',
      'heartbeat',
      'data_sync',
      'heartbeat',
      'data_sync',
    ],
    connectionByStatus: {
      online: {
        signalValueKey: 'gateway.signalStrong',
        internetValueKey: 'gateway.internetWifi',
      },
      offline: {
        signalValueKey: 'gateway.signalNone',
        internetValueKey: 'gateway.internetNone',
      },
    },
  },
} as const satisfies MockFarmScenario;

export const ENABLE_MOCK_NODE_FALLBACK = MOCK_FARM_SCENARIO.enabled;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const MOCK_SCENARIO_ANCHOR_TIME_MS = Date.now();
const MOCK_NODE_IDS = MOCK_FARM_SCENARIO.nodes.map((node) => node.id);
const MOCK_NODE_FIXTURE_BY_ID: ReadonlyMap<string, MockNodeFixture> = new Map(
  MOCK_FARM_SCENARIO.nodes.map((node) => [node.id, node] as const),
);

export const MOCK_NODES: Node[] = MOCK_FARM_SCENARIO.nodes.map((node) => ({
  id: node.id,
  name: node.name,
  location: node.location,
  status: node.status,
  battery: node.battery,
  updated_at: new Date(
    MOCK_SCENARIO_ANCHOR_TIME_MS - node.lastSeenMinutesAgo * MINUTE,
  ).toISOString(),
}));

export const MOCK_NODE_COUNT = MOCK_NODES.length;
export const MOCK_ACTIVE_NODE_COUNT = MOCK_NODES.filter((node) => node.status === 'online').length;

function simpleNoise(seed: number, index: number, range: number): number {
  const value = ((seed * 7 + index * 13 + 17) % 1000) / 1000;
  return (value - 0.5) * 2 * range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashNodeId(nodeId: string): number {
  let hash = 0;
  for (let index = 0; index < nodeId.length; index++) {
    hash = (hash * 31 + nodeId.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getMockNodeIdForNode(nodeId: string): string {
  const normalizedId = nodeId.trim().toLowerCase();
  if (MOCK_NODE_FIXTURE_BY_ID.has(normalizedId)) return normalizedId;

  const legacyAlias = normalizedId.match(/^node[\s_-]?([a-z])$/);
  if (legacyAlias) {
    const aliasIndex = legacyAlias[1].charCodeAt(0) - 'a'.charCodeAt(0);
    if (aliasIndex >= 0 && aliasIndex < MOCK_NODE_IDS.length) {
      return MOCK_NODE_IDS[aliasIndex] ?? '';
    }
  }

  const mockNodeMatch = normalizedId.match(/^mock-node-(\d+)$/);
  const index = mockNodeMatch ? Number(mockNodeMatch[1]) - 1 : hashNodeId(normalizedId);

  return MOCK_NODE_IDS[Math.abs(index) % MOCK_NODE_IDS.length] ?? MOCK_NODE_IDS[0] ?? '';
}

export type MockReadingOptions = {
  intervalMinutes?: number;
  anchorTimeMs?: number;
};

export function generateMockReadingsForNode(
  nodeId: string,
  count: number = MOCK_FARM_SCENARIO.reading.defaultCount,
  options: MockReadingOptions = {},
): Reading[] {
  const mockNodeId = getMockNodeIdForNode(nodeId);
  const fixture = MOCK_NODE_FIXTURE_BY_ID.get(mockNodeId) ?? MOCK_FARM_SCENARIO.nodes[0];
  const profile = fixture?.readings ?? [];
  const seed = hashNodeId(mockNodeId || nodeId || 'mock-node');
  const anchorTimeMs = options.anchorTimeMs ?? MOCK_SCENARIO_ANCHOR_TIME_MS;
  const intervalMs =
    (options.intervalMinutes ?? MOCK_FARM_SCENARIO.reading.intervalMinutes) * MINUTE;

  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const base = profile[index] ??
      profile[index % Math.max(1, profile.length)] ?? {
        soilMoisture: 55,
        soilTemp: 27,
        airTemp: 30,
        airHumidity: 70,
      };
    const cycle = Math.sin((index + (seed % 11)) / 4);
    const isProfilePoint = index < profile.length;

    return {
      id: `${nodeId || mockNodeId}-r${index}`,
      soil_moisture: isProfilePoint
        ? base.soilMoisture
        : Math.round(
            clamp(base.soilMoisture + cycle * 4 + simpleNoise(seed, index, 2), 12, 90) * 10,
          ) / 10,
      soil_temp: isProfilePoint
        ? base.soilTemp
        : Math.round(
            clamp(base.soilTemp + cycle * 1.2 + simpleNoise(seed + 100, index, 0.6), 18, 35) * 10,
          ) / 10,
      air_temp: isProfilePoint
        ? base.airTemp
        : Math.round(
            clamp(base.airTemp + cycle * 1.8 + simpleNoise(seed + 200, index, 0.8), 24, 38) * 10,
          ) / 10,
      air_humidity: isProfilePoint
        ? base.airHumidity
        : Math.round(
            clamp(base.airHumidity - cycle * 3 + simpleNoise(seed + 300, index, 2), 50, 90),
          ),
      created_at: new Date(anchorTimeMs - index * intervalMs).toISOString(),
    };
  });
}

export function getMockRssiForNode(nodeId: string): string {
  if (!nodeId) return '— dBm';
  const fixture = MOCK_NODE_FIXTURE_BY_ID.get(getMockNodeIdForNode(nodeId));
  return `${fixture?.rssiDbm ?? -90} dBm`;
}

function buildMockDecision(
  moisture: number | null,
  lowerThreshold: number,
): NodeSummary['decision'] {
  if (moisture == null) return null;
  return moisture < lowerThreshold
    ? { decision: 'Irigasi dijalankan', valve_state: 'open' }
    : { decision: 'Irigasi berhenti', valve_state: 'closed' };
}

function buildMockNodeSummary(node: Node, lowerThreshold: number): NodeSummary {
  const latestReading = generateMockReadingsForNode(node.id, 1)[0] ?? null;
  return {
    node,
    latest_reading: latestReading,
    decision: buildMockDecision(latestReading?.soil_moisture ?? null, lowerThreshold),
    signal_rssi: getMockRssiForNode(node.id),
  };
}

export function getMockNodeSummaryForNode(
  nodeId: string,
  lowerThreshold: number = MOCK_FARM_SCENARIO.thresholds.lower,
): NodeSummary | null {
  const mockNodeId = getMockNodeIdForNode(nodeId);
  const node = MOCK_NODES.find((item) => item.id === mockNodeId);
  return node ? buildMockNodeSummary(node, lowerThreshold) : null;
}

export function mockNodeSummaries(
  lowerThreshold: number = MOCK_FARM_SCENARIO.thresholds.lower,
): NodeSummary[] {
  return MOCK_NODES.map((node) => buildMockNodeSummary(node, lowerThreshold));
}

function summarizeNodeList(nodes: NodeSummary[]) {
  const moistures = nodes
    .map((nodeSummary) => nodeSummary.latest_reading?.soil_moisture)
    .filter((moisture): moisture is number => moisture != null);
  const averageSoilMoisture =
    moistures.length > 0
      ? Math.round(moistures.reduce((sum, moisture) => sum + moisture, 0) / moistures.length)
      : null;
  const gatewayStatus = nodes.some((nodeSummary) => nodeSummary.node.status === 'online')
    ? 'online'
    : 'offline';
  const nodesProblem = nodes.filter((nodeSummary) => nodeSummary.node.status === 'offline').length;

  return { averageSoilMoisture, gatewayStatus, nodesProblem } as const;
}

export function withMockNodeFallback(summary: FarmSummary): FarmSummary {
  if (!ENABLE_MOCK_NODE_FALLBACK) return { ...summary };

  const needsFullMock = summary.nodes.length === 0;
  const needsMissingReadingMock = summary.nodes.some(
    (nodeSummary) => nodeSummary.latest_reading == null,
  );

  if (!needsFullMock && !needsMissingReadingMock) {
    return { ...summary };
  }

  const lowerThreshold = summary.thresholds.lower;
  const nodes = needsFullMock
    ? mockNodeSummaries(lowerThreshold)
    : summary.nodes.map((nodeSummary) => {
        if (nodeSummary.latest_reading != null) return nodeSummary;

        const mockSummary = getMockNodeSummaryForNode(nodeSummary.node.id, lowerThreshold);
        if (!mockSummary) return nodeSummary;

        return {
          ...nodeSummary,
          latest_reading: mockSummary.latest_reading,
          decision: mockSummary.decision,
          signal_rssi: nodeSummary.signal_rssi ?? mockSummary.signal_rssi,
        };
      });

  const derived = summarizeNodeList(nodes);

  if (!needsFullMock) {
    return {
      ...summary,
      nodes,
      average_soil_moisture: derived.averageSoilMoisture,
    };
  }

  return {
    ...summary,
    nodes,
    gateway_status: derived.gatewayStatus,
    average_soil_moisture: derived.averageSoilMoisture,
    nodes_problem: derived.nodesProblem,
    // `summary.weather` sengaja tidak diubah.
  };
}

type MockLogNode = Pick<Node, 'id' | 'name' | 'location'>;

export type MockIrrigationLogContext = {
  nodes?: readonly MockLogNode[];
  thresholds?: { lower: number; upper: number };
  anchorTimeMs?: number;
};

export function generateMockIrrigationLogs(
  context: MockIrrigationLogContext = {},
): IrrigationLog[] {
  const nodes = context.nodes?.length ? context.nodes : MOCK_NODES;
  const thresholds = context.thresholds ?? MOCK_FARM_SCENARIO.thresholds;
  const anchorTimeMs = context.anchorTimeMs ?? MOCK_SCENARIO_ANCHOR_TIME_MS;
  const intervalMs = MOCK_FARM_SCENARIO.irrigation.logIntervalMinutes * MINUTE;

  return Array.from({ length: MOCK_FARM_SCENARIO.irrigation.logCount }, (_, index) => {
    const node = nodes[index % nodes.length] ?? MOCK_NODES[0];
    const fixture = node
      ? MOCK_NODE_FIXTURE_BY_ID.get(getMockNodeIdForNode(node.id))
      : MOCK_FARM_SCENARIO.nodes[0];
    const profile = fixture?.readings ?? [];
    const reading = profile[index % Math.max(1, profile.length)] ?? {
      soilMoisture: 55,
      soilTemp: 27,
      airTemp: 30,
      airHumidity: 70,
    };
    const isDry = reading.soilMoisture < thresholds.lower;
    const isWet = reading.soilMoisture > thresholds.upper;
    const nodeLabel = node?.name || node?.id || 'Node';
    const locationLabel = node?.location || 'area sensor';

    return {
      id: `mock-log-${String(index + 1).padStart(2, '0')}`,
      node_id: node?.id ?? '',
      soil_moisture: reading.soilMoisture,
      // Field wajib contract IrrigationLog; dash mencegah pemalsuan data BMKG.
      weather: '—',
      decision: isDry ? 'Irigasi dijalankan' : 'Irigasi berhenti',
      valve_state: isDry ? 'open' : 'closed',
      reason: isDry
        ? `${nodeLabel} di ${locationLabel} berada di bawah ambang ${thresholds.lower}%.`
        : isWet
          ? `${nodeLabel} di ${locationLabel} berada di atas ambang ${thresholds.upper}%.`
          : `${nodeLabel} di ${locationLabel} berada dalam rentang kelembapan aman.`,
      created_at: new Date(anchorTimeMs - index * intervalMs).toISOString(),
    };
  });
}

export const MOCK_LOGS = generateMockIrrigationLogs();

export type MockGatewayLogContext = {
  farmId?: string;
  activeNodeCount?: number;
  anchorTimeMs?: number;
};

export function generateMockGatewayLogs(context: MockGatewayLogContext = {}): GatewayLog[] {
  const farmId = context.farmId ?? '';
  const activeNodeCount = Math.max(0, context.activeNodeCount ?? MOCK_ACTIVE_NODE_COUNT);
  const anchorTimeMs = context.anchorTimeMs ?? MOCK_SCENARIO_ANCHOR_TIME_MS;

  return MOCK_FARM_SCENARIO.gateway.events.map((event, index) => {
    let detail: string;
    if (event === 'heartbeat') {
      detail = `Heartbeat OK — ${activeNodeCount} node aktif`;
    } else if (event === 'data_sync') {
      detail = `Sinkronisasi ${activeNodeCount} pembacaan sensor ke server`;
    } else if (event === 'disconnected') {
      detail =
        index % 2 === 0
          ? 'Koneksi WiFi terputus sementara'
          : 'Koneksi WiFi terputus (listrik padam)';
    } else {
      detail =
        index === 0
          ? 'Gateway berhasil terhubung melalui WiFi'
          : 'Gateway berhasil terhubung kembali';
    }

    return {
      id: `mock-gwlog-${index + 1}`,
      farm_id: farmId,
      event,
      detail,
      created_at: new Date(
        anchorTimeMs - (index * MOCK_FARM_SCENARIO.gateway.logIntervalHours + 4) * HOUR,
      ).toISOString(),
    };
  });
}

export const MOCK_GATEWAY_LOGS = generateMockGatewayLogs();

export function getMockGatewayProfile(summary: Pick<FarmSummary, 'farm' | 'gateway_status'>) {
  const connection =
    MOCK_FARM_SCENARIO.gateway.connectionByStatus[summary.gateway_status] ??
    MOCK_FARM_SCENARIO.gateway.connectionByStatus.offline;

  return {
    gatewayId: `${MOCK_FARM_SCENARIO.gateway.idPrefix}-${summary.farm.id}`,
    signalValueKey: connection.signalValueKey,
    internetValueKey: connection.internetValueKey,
  };
}
