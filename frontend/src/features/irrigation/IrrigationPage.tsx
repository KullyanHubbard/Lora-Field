import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Droplet, Zap } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { valveKeyFromDecision } from '@/features/farms/farmHelpers';
import { getIrrigationStatusBadge, getValveStatusBadge } from '@/lib/status';
import { cn } from '@/lib/utils';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { FarmSummaryError } from '@/components/FarmSummaryError';
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
  green: 'text-emerald-500 dark:text-emerald-400',
  yellow: 'text-amber-500 dark:text-amber-400',
  red: 'text-red-500 dark:text-red-400',
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

  // TODO (future): kontrol manual valve butuh backend.
  // Rencana endpoint (BELUM ADA, jangan dipanggil):
  //   POST /api/farms/{farm_id}/valve/mode  body: { mode: "auto" | "manual" }
  //   POST /api/farms/{farm_id}/valve       body: { state: "open" | "closed" }  (hanya saat mode manual)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

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
      <FarmSummaryError
        message={
          error ? t('irrigation.errorLoad', { message: error.message }) : t('irrigation.noData')
        }
      />
    );
  }

  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);
  const decision = activeNode?.decision ?? null;
  const valveKey = valveKeyFromDecision(decision);
  const { lower, upper } = summary.thresholds;
  // average_soil_moisture BISA null → tampilkan "—" dan sembunyikan bar.
  const avg = summary.average_soil_moisture;
  const avgPct = avg != null ? Math.min(Math.max(avg, 0), 100) : null;

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
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('irrigation.valveStatusLabel')}
              </span>
            </div>
            <span
              className={cn('text-3xl font-semibold tracking-tight', toneText[valvePill.tone])}
            >
              {valvePill.label.toUpperCase()}
            </span>
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5" role="group" aria-label={t('irrigation.modeLabel')}>
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  mode === 'auto'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={mode === 'auto'}
              >
                <Zap className="size-3" /> {t('irrigation.autoMode')}
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  mode === 'manual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={mode === 'manual'}
              >
                {t('irrigation.manualMode')}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === 'manual' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-500 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t('irrigation.manualBanner')}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('irrigation.thresholdTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('irrigation.thresholdRange')}</span>
            <span className="font-medium tabular-nums text-foreground">
              {lower}%–{upper}%
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('irrigation.avgMoisture')}</span>
              <span className="font-medium tabular-nums text-foreground">
                {avgPct != null ? `${avg}%` : '—'}
              </span>
            </div>
            {avgPct != null && (
              <>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={avgPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {/* lebar bar = nilai dinamis → inline style untuk width diperbolehkan */}
                  <div className="h-full rounded-full bg-primary" style={{ width: `${avgPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </>
            )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('irrigation.perNodeTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('irrigation.colNode')}</TableHead>
                <TableHead>{t('irrigation.colMoisture')}</TableHead>
                <TableHead>{t('irrigation.colDecision')}</TableHead>
                <TableHead>{t('irrigation.colValve')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('irrigation.perNodeEmpty')}
                  </TableCell>
                </TableRow>
              ) : (
                summary.nodes.map((ns) => {
                  // latest_reading & decision BISA null → guard masing-masing.
                  const reading = ns.latest_reading;
                  const dec = ns.decision;
                  const irrBadge = dec ? getIrrigationStatusBadge(dec.decision) : null;
                  const valveBadge = dec ? getValveStatusBadge(valveKeyFromDecision(dec)) : null;
                  return (
                    <TableRow key={ns.node.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {ns.node.name || ns.node.id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ns.node.location || ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {reading ? `${reading.soil_moisture}%` : '—'}
                      </TableCell>
                      <TableCell>
                        {irrBadge ? (
                          <StatusPill tone={irrBadge.tone} label={t(irrBadge.labelKey)} />
                        ) : (
                          <StatusPill tone="neutral" label={t('irrigation.waitingData')} />
                        )}
                      </TableCell>
                      <TableCell>
                        {valveBadge ? (
                          <StatusPill tone={valveBadge.tone} label={t(valveBadge.labelKey)} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
