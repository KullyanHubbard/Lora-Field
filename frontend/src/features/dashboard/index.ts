// Dashboard feature public API.
// NOTE: farmStatusHelpers.ts is NOT re-exported here because farmStatusTone/farmStatusLabelKey
// are consumed by myFarms and selectFarms — importing them via the dashboard barrel would
// create a circular dependency (dashboard → myFarms/selectFarms → dashboard).
// Those features must import directly from '@/features/dashboard/farmStatusHelpers'.

// Page entry point
export { default as DashboardPage } from './DashboardPage';

// View model hook
export { useDashboardViewModel } from './useDashboardViewModel';

// Query hooks (cross-feature: used by weather, logs, irrigation, gateway, monitoring, myFarms, selectFarms, AppLayout)
export { useCrops, useCreateFarm, useFarmSummary, useFarms } from './queries';
