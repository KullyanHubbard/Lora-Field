// Gateway feature public API — consumed by dashboard (buildGatewayInfo).

// Page entry point
export { default as GatewayPage } from './GatewayPage';

// View model hook
export { useGatewayPageViewModel } from './useGatewayPageViewModel';

// Query hooks
export { useGatewayLogs } from './queries';

// Helper used by dashboard (DashboardGatewayInfoContent)
export {
  buildGatewayInfo,
  buildGatewayEventCounts,
  filterGatewayLogs,
  getGatewayTotalPages,
  getGatewaySafePage,
  paginateGatewayLogs,
  getGatewayEventLabelKey,
  getGatewayEventTone,
  getGatewayEventDotClass,
  type GatewayInfoViewModel,
  type GatewayEventFilter,
} from './gatewayHelpers';
