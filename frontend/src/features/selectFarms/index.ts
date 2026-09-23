// SelectFarms feature public API — consumed by router.

// Page entry point
export { default as SelectFarmsPage } from './SelectFarmsPage';

// View model hooks
export { useSelectFarmsViewModel } from './useSelectFarmsViewModel';

// Query hooks
export { useFarms } from '@/features/dashboard/queries';

// Helpers
export { getSelectFarmMapPoints, type SelectFarmMapPoint } from './selectFarmsHelpers';
