// Gateway feature public API — consumed by farms (buildGatewayInfo).

// Page entry point
export { default as GatewayPage } from './GatewayPage';

// View model hook
export { useGatewayPageViewModel } from './useGatewayPageViewModel';

// Query hooks
export { useGatewayLogs } from './queries';

// Helper used by farms (FarmDetailGatewayInfoContent)
export {
  buildGatewayInfo,
  buildGatewayEventCounts,
  filterGatewayLogs,
  getGatewayTotalPages,
  getGatewaySafePage,
  paginateGatewayLogs,
  getGatewayEventLabel,
  getGatewayEventTone,
  getGatewayEventDotClass,
  type GatewayInfoViewModel,
  type GatewayEventFilter,
} from './gatewayHelpers';
