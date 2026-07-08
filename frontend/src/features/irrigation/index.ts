// Irrigation feature public API.

// Page entry point
export { default as IrrigationPage } from './IrrigationPage';

// Query hooks
export { useIrrigationSummary } from './queries';

// Helpers used internally by irrigation components
export {
  buildIrrigationStats,
  formatSyncTime,
  moistureCondition,
  valveKeyFromDecision,
  getNodeMoisture,
  type IrrigationStats,
} from './irrigationHelpers';

// Layout constants (used by irrigation components)
export { NODE_CARD_MIN_HEIGHT_CLASS } from './irrigationLayout';
