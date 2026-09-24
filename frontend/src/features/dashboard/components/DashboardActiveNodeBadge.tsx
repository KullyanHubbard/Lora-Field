import { useTranslation } from 'react-i18next';
import type { NodeSummary } from '@/types';

export function DashboardActiveNodeBadge({ summaryNodes }: { summaryNodes: NodeSummary[] }) {
  const { t } = useTranslation();
  const activeNodeCount = summaryNodes.filter((ns) => ns.node.status !== 'offline').length;

  if (summaryNodes.length === 0) return null;

  return (
    <span className="order-last w-full text-xs text-muted-foreground sm:order-none sm:w-auto sm:text-sm">
      <span className="font-semibold tabular-nums text-foreground">{activeNodeCount}</span>
      {' / '}
      <span className="tabular-nums">{summaryNodes.length}</span> {t('dashboard.activeNodes')}
    </span>
  );
}
