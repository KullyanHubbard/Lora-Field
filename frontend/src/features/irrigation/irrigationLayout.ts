export const NODE_SCROLL_THRESHOLD = 8;
export const NODE_CARD_MIN_HEIGHT_CLASS = 'min-h-[17.25rem]';
export const NODE_GRID_COLUMNS_CLASS = '[grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]';
export const NODE_GRID_SCROLL_CLASS = [
  'max-h-[35.25rem]',
  'overflow-y-auto',
  'pr-1',
  '[scrollbar-color:var(--muted-foreground)_transparent]',
  '[scrollbar-gutter:stable]',
  '[scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:w-2',
  '[&::-webkit-scrollbar-thumb]:rounded-full',
  '[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35',
  '[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55',
  '[&::-webkit-scrollbar-track]:rounded-full',
  '[&::-webkit-scrollbar-track]:bg-muted/30',
].join(' ');
