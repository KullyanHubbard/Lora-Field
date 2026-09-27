import type { FarmGateway, FarmSummary } from '@/types';
import { buildGatewayInfo } from '@/features/gateway/gatewayHelpers';
import { GatewayInfoCard } from '@/features/gateway/components/GatewayInfoCard';

export function GatewayInfoContent({
  gateway,
  gatewayStatus,
  className,
}: {
  gateway: FarmGateway | null;
  gatewayStatus: FarmSummary['gateway_status'];
  className?: string;
}) {
  return <GatewayInfoCard info={buildGatewayInfo(gateway, gatewayStatus)} className={className} />;
}
