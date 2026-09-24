export const NODE_SCROLL_THRESHOLD = 8;
export const NODE_CARD_MIN_HEIGHT_CLASS = 'min-h-[17.25rem]';
export const NODE_GRID_COLUMNS_CLASS =
  '[grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]';
export const NODE_GRID_SCROLL_CLASS = [
  'max-h-[35.25rem]',
  'overflow-y-auto',
  'overscroll-contain',
  'pr-1',
  '[scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_40%,transparent)_transparent]',
  '[scrollbar-gutter:stable]',
  '[scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:w-2',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full',
  '[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40',
  '[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55',
].join(' ');
