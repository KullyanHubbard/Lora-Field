// Dashboard feature public API.

// Page entry point
export { default as DashboardPage } from './DashboardPage';

// View model hook
export { useDashboardViewModel } from './useDashboardViewModel';

// Query hooks (cross-feature: used by weather, logs, irrigation, gateway, monitoring, myFarms, selectFarms, AppLayout)
export { useCrops, useCreateFarm, useFarmSummary, useFarms } from './queries';
