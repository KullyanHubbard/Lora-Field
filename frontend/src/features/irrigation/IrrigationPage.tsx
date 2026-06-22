import { Link, useParams } from 'react-router-dom';
import { Droplet, Zap } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { valveLabelFromDecision } from '@/features/farms/farmHelpers';
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
const LOGIC_ROWS: { soil: string; weather: string; tone: PillTone; action: string }[] = [
  {
    soil: 'Kelembapan < threshold bawah',
    weather: 'Tidak ada hujan',
    tone: 'green',
    action: 'Valve buka',
  },
  {
    soil: 'Kelembapan < threshold bawah',
    weather: 'Ada prediksi hujan',
    tone: 'yellow',
    action: 'Irigasi ditunda',
  },
  {
    soil: 'Kelembapan > threshold atas',
    weather: 'Apapun',
    tone: 'neutral',
    action: 'Valve tutup',
  },
  {
    soil: 'Kelembapan di antara threshold',
    weather: 'Apapun',
    tone: 'neutral',
    action: 'Normal, mengikuti status sebelumnya (Histeresis)',
  },
];

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
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

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
          {error ? `Gagal memuat data irigasi: ${error.message}` : 'Data tidak tersedia.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Kembali ke Daftar Kebun</Link>
        </Button>
      </div>
    );
  }

  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);
  const decision = activeNode?.decision ?? null;
  const valveLabel = valveLabelFromDecision(decision);

  // No-data (gateway/node belum aktif) → neutral, bukan merah (DESIGN.md).
  const valvePill: Pill = decision
    ? getValveStatusBadge(valveLabel)
    : { label: 'Tidak Diketahui', tone: 'neutral' };
  const irrigPill: Pill = decision
    ? getIrrigationStatusBadge(decision.decision)
    : { label: 'Menunggu Gateway', tone: 'neutral' };

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
              Status Valve
            </span>
            <span
              className={cn('text-3xl font-semibold tracking-tight', toneText[valvePill.tone])}
            >
              {valveLabel.toUpperCase()}
            </span>
            <Badge variant="secondary" className="gap-1">
              <Zap className="size-3" /> Mode Otomatis
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logika Irigasi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kondisi Tanah</TableHead>
                <TableHead>Kondisi Cuaca</TableHead>
                <TableHead>Aksi Sistem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LOGIC_ROWS.map((row, i) => (
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
          <CardTitle className="text-base">Keputusan Sistem</CardTitle>
        </CardHeader>
        <CardContent>
          <PanelRow label="Keputusan" pill={irrigPill} />
          <PanelRow label="Status Valve" pill={valvePill} />
          {!decision && (
            <p className="pt-3 text-sm text-muted-foreground">
              Belum ada data dari node aktif. Pastikan gateway online.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
