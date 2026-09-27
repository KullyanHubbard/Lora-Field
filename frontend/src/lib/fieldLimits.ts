// Batas panjang isian form, disamakan dengan schema backend (backend/app/schemas.py).
export const FARM_FIELD_MAX_LENGTH = {
  name: 100,
  owner: 100,
  location: 200,
  gatewayDeviceId: 64,
  gatewayDisplayName: 100,
} as const;

export const PHONE_MAX_LENGTH = 20;
