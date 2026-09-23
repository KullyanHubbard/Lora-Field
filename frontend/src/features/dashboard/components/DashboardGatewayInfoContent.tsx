import type { FarmGateway } from '@/types';
import { buildGatewayInfo } from '@/features/gateway/gatewayHelpers';
import { GatewayInfoCard } from '@/features/gateway/components/GatewayInfoCard';

export function GatewayInfoContent({
  gateway,
  className,
}: {
  gateway: FarmGateway | null;
  className?: string;
}) {
  return <GatewayInfoCard info={buildGatewayInfo(gateway)} className={className} />;
}
