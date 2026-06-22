import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Droplet, Zap } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { valveKeyFromDecision } from '@/features/farms/farmHelpers';
import { getIrrigationStatusBadge, getValveStatusBadge } from '@/lib/status';
import { cn } from '@/lib/utils';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Pill = { label: string; tone: PillTone };

// Warna ikon/teks emblem (bukan badge) — sehue dengan tone pill.
const toneText: Record<PillTone, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

// Tabel logika irigasi — dari aturan di CLAUDE.md (bukan dikarang).
// Tone: buka=green, ditunda=amber; tutup & normal=neutral (bukan kondisi alarm).

function PanelRow({ label, pill }: { label: string; pill: Pill }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <StatusPill tone={pill.tone} label={pill.label} />
    </div>
  );
}

export default function IrrigationPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  const logicRows: { soil: string; weather: string; tone: PillTone; action: string }[] = [
    { soil: t('irrigation.logic.soil1'), weather: t('irrigation.logic.weather1'), tone: 'green', action: t('irrigation.logic.action1') },
    { soil: t('irrigation.logic.soil2'), weather: t('irrigation.logic.weather2'), tone: 'yellow', action: t('irrigation.logic.action2') },
    { soil: t('irrigation.logic.soil3'), weather: t('irrigation.logic.weather3'), tone: 'neutral', action: t('irrigation.logic.action3') },
    { soil: t('irrigation.logic.soil4'), weather: t('irrigation.logic.weather4'), tone: 'neutral', action: t('irrigation.logic.action4') },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {error ? t('irrigation.errorLoad', { message: error.message }) : t('irrigation.noData')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">{t('irrigation.backToList')}</Link>
        </Button>
      </div>
    );
  }

  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);
  const decision = activeNode?.decision ?? null;
  const valveKey = valveKeyFromDecision(decision);

  const valvePill: Pill = decision
    ? { label: t(getValveStatusBadge(valveKey).labelKey), tone: getValveStatusBadge(valveKey).tone }
    : { label: t('irrigation.unknown'), tone: 'neutral' };
  const irrigPill: Pill = decision
    ? { label: t(getIrrigationStatusBadge(decision.decision).labelKey), tone: getIrrigationStatusBadge(decision.decision).tone }
    : { label: t('irrigation.waitingGateway'), tone: 'neutral' };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-center sm:gap-8">
          <div
            className={cn(
              'flex size-20 items-center justify-center rounded-full bg-muted',
              toneText[valvePill.tone],
            )}
            aria-hidden="true"
          >
            <Droplet className="size-9" />
          </div>
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('irrigation.valveStatusLabel')}
            </span>
            <span
              className={cn('text-3xl font-semibold tracking-tight', toneText[valvePill.tone])}
            >
              {valvePill.label.toUpperCase()}
            </span>
            <Badge variant="secondary" className="gap-1">
              <Zap className="size-3" /> {t('irrigation.autoMode')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('irrigation.logicTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('irrigation.colSoil')}</TableHead>
                <TableHead>{t('irrigation.colWeather')}</TableHead>
                <TableHead>{t('irrigation.colAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logicRows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{row.soil}</TableCell>
                  <TableCell className="text-muted-foreground">{row.weather}</TableCell>
                  <TableCell>
                    <StatusPill tone={row.tone} label={row.action} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('irrigation.decisionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PanelRow label={t('irrigation.decisionLabel')} pill={irrigPill} />
          <PanelRow label={t('irrigation.valveStatusLabel')} pill={valvePill} />
          {!decision && (
            <p className="pt-3 text-sm text-muted-foreground">
              {t('irrigation.noDecision')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
