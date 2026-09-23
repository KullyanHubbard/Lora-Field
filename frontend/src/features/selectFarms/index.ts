// SelectFarms feature public API — consumed by router.

// Page entry point
export { default as SelectFarmsPage } from './SelectFarmsPage';

// View model hooks
export { useSelectFarmsViewModel } from './useSelectFarmsViewModel';

// Query hooks
export { useFarms } from '@/features/dashboard/queries';

// Helpers (cross-feature: farmStatusTone imported from farms/farmHelpers)
export {
  getShortFarmLocation,
  getSelectFarmMapPoints,
  type SelectFarmMapPoint,
} from './selectFarmsHelpers';
