// Lebar konten + padding horizontal yang konsisten.
export const LANDING_SHELL = 'mx-auto w-full max-w-7xl px-4 md:px-6';

// Grid garis dekoratif.
export const LANDING_GRID =
  'bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:4rem_4rem]';

export const LANDING_REVEAL_OFFSET = 20;
export const LANDING_STAGGER_DELAY = 0.1;
export const LANDING_REVEAL_INITIAL = { opacity: 0, y: LANDING_REVEAL_OFFSET };
export const LANDING_REVEAL_VISIBLE = { opacity: 1, y: 0 };
export const LANDING_REVEAL_TRANSITION = { duration: 0.5 };
