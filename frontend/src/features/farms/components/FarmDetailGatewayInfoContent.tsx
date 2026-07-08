import type { FarmSummary } from '@/types';
import { buildGatewayInfo } from '@/features/gateway/gatewayHelpers';
import { GatewayInfoCard } from '@/features/gateway/components/GatewayInfoCard';

export function GatewayInfoContent({
  summary,
  className,
}: {
  summary: FarmSummary;
  className?: string;
}) {
  return <GatewayInfoCard info={buildGatewayInfo(summary)} className={className} />;
}
