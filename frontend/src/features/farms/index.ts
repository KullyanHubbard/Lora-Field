// Farms feature public API.
// NOTE: farmHelpers.ts is NOT re-exported here because farmStatusTone/farmStatusLabelKey
// are consumed by myFarms and selectFarms — importing them via the farms barrel would
// create a circular dependency (farms → myFarms/selectFarms → farms).
// Those features must import directly from '@/features/farms/farmHelpers'.

// Page entry points
export { default as AddFarmPage } from './AddFarmPage';
export { default as FarmDetailPage } from './FarmDetailPage';

// View model hooks
export { useFarmDetailViewModel } from './useFarmDetailViewModel';
export { useAddFarmViewModel } from './useAddFarmViewModel';

// Query hooks (cross-feature: used by weather, logs, irrigation, gateway, monitoring, myFarms, selectFarms, AppLayout)
export { useFarmSummary, useFarms, useCreateFarm } from './queries';
