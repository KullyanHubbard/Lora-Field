import { useTranslation } from 'react-i18next';
import type { NodeSummary } from '@/types';

export function DashboardActiveNodeBadge({ summaryNodes }: { summaryNodes: NodeSummary[] }) {
  const { t } = useTranslation();
  const activeNodeCount = summaryNodes.filter((ns) => ns.node.status !== 'offline').length;

  if (summaryNodes.length === 0) return null;

  return (
    <span className="shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground sm:text-sm">
      <span className="font-semibold tabular-nums text-foreground">{activeNodeCount}</span>
      {' / '}
      <span className="tabular-nums">{summaryNodes.length}</span> {t('dashboard.activeNodes')}
    </span>
  );
}
