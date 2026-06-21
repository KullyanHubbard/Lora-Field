# DESIGN.md — Design System LoraField

Acuan visual rebuild. Tujuan: dashboard terasa proper & profesional (gaya Taskplus: stat card, tabel rapi, badge subtle), bukan "AI-generated" yang penuh teks dan warna kontras norak. App dark-mode-first.

## Prinsip

1. **Tampilkan, jangan jelaskan.** Angka jadi fokus (besar, font semibold tipis), label kecil & muted. Hindari kalimat penjelasan di UI.
2. **Hierarki teks 3 level:**
   - Heading section → `font-semibold` (ukuran sedang).
   - Angka/nilai → besar, ringan (`text-3xl font-semibold tracking-tight tabular-nums`).
   - Label/caption → kecil, `text-muted-foreground` (sering `uppercase tracking-wide` untuk label stat).
3. **Badge SUBTLE.** Background tone sangat tipis + teks berwarna + dot kecil. BUKAN blok warna solid.
4. **Status netral default.** "Tidak ada data / belum ada / unknown" pakai abu-abu (`neutral`), BUKAN merah. Merah HANYA untuk kondisi beneran kritis (offline, gagal, butuh aksi).
5. **Whitespace lega, spacing konsisten.** Padding kartu `p-5`, gap antar elemen konsisten (`gap-2`/`space-y-4`).
6. **Warna lewat utility Tailwind, nol hex di JS.** Token tema shadcn (`bg-card`, `text-muted-foreground`, `border-border`) + utility tone subtle (`bg-emerald-500/10`, `text-amber-600 dark:text-amber-400`).

## StatCard

`src/components/ui/stat-card.tsx` — kartu statistik ringkas.

Props:

| Prop | Tipe | Catatan |
|------|------|---------|
| `label` | `string` | Label kecil muted di atas (mis. "Kelembapan Rata-rata") |
| `value` | `string \| number` | Angka besar (fokus) |
| `sublabel?` | `string` | Konteks kecil di bawah (mis. "3 node aktif") |
| `icon?` | `ReactNode` | Ikon muted di kanan atas (opsional) |
| `trend?` | `{ value: string; positive: boolean }` | Delta kecil; hijau kalau `positive`, merah kalau tidak |

Contoh:

```tsx
import { StatCard } from '@/components/ui/stat-card';
import { Droplet } from 'lucide-react';

<StatCard label="Kelembapan Rata-rata" value="62%" sublabel="3 node aktif" icon={<Droplet className="size-4" />} />
<StatCard label="Kebun Aktif" value={4} trend={{ value: '+1', positive: true }} sublabel="bulan ini" />
```

Pakai dalam grid: `grid grid-cols-2 gap-4 lg:grid-cols-4`.

## StatusPill

`src/components/ui/status-pill.tsx` — badge status subtle (tinted bg + teks tone + dot).

Props: `{ tone: 'green' | 'yellow' | 'red' | 'neutral'; label: string; className?: string }`.

`tone` **kompatibel** dengan return helper di `src/lib/status.ts` (`getGatewayStatusBadge`, `getNodeStatusBadge`, dll — return `tone: 'green' | 'yellow' | 'red'`), plus `'neutral'` baru. Token tone-nya **`yellow`** (bukan `amber`); warna render `yellow` adalah amber.

```tsx
import { StatusPill } from '@/components/ui/status-pill';
import { getNodeStatusBadge } from '@/lib/status';

const badge = getNodeStatusBadge(node.status); // { label, tone }
<StatusPill tone={badge.tone} label={badge.label} />

// no-data / belum ada → neutral (abu-abu), BUKAN merah:
<StatusPill tone="neutral" label="Belum ada data" />
```

### Aturan tone (kapan pakai apa)

| Tone | Warna | Kapan |
|------|-------|-------|
| `green` | emerald (subtle) | Sehat / online / normal / aktif |
| `yellow` | amber (subtle) | Perhatian / standby / menunggu / terlalu basah |
| `red` | red (subtle) | **Kritis saja:** offline, gagal, butuh aksi mendesak |
| `neutral` | abu (muted) | **Default no-data:** belum ada data, unknown, tidak terhubung, "—" |

Penting: jangan pakai `red` untuk sekadar "tidak ada data". Data kosong itu `neutral`. Ini perbaikan dari helper lama yang kadang map no-data → merah; saat migrasi ke StatusPill, no-data dipetakan ke `neutral`.

## Migrasi StatusBadge → StatusPill (Step 2-3)

`StatusPill` adalah **pengganti subtle** dari `StatusBadge` lama (`src/components/StatusBadge.tsx`) yang masih SOLID (`bg-emerald-600` dst). Rencana:

- **Step 1 (sekarang):** buat `StatCard` + `StatusPill`. JANGAN ganti `StatusBadge` di page.
- **Step 2-3:** ganti pemakaian `StatusBadge` solid di page jadi `StatusPill` subtle, page per page; lalu hapus `StatusBadge` lama kalau sudah tak terpakai. Mapping tone identik (`green/yellow/red`), tinggal arahkan kasus no-data ke `neutral`.

Sampai migrasi selesai, keduanya hidup berdampingan: `StatusBadge` (solid, lama) dan `StatusPill` (subtle, target).
