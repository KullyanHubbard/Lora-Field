import type { GroundCover } from '@/types';

// Label diterjemahkan lewat i18n (groundCover.{value}), sama pola dengan MARKER_COLORS.
export const GROUND_COVER_OPTIONS: { value: GroundCover }[] = [
  { value: 'open' },
  { value: 'mulch' },
  { value: 'roofed' },
];
