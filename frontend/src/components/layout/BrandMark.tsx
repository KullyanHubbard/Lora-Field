import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Brandmark LoraField bersama: teks sebagai link balik ke landing (/). Dipakai di
// AppLayout (header sidebar) dan DashboardBar (addFarm/). Logo Sprout sementara
// dihapus (teks saja). Hover memberi fill background supaya terasa bisa diketuk.
// `className` untuk spacing per-konteks (mis. px-2 py-1 di sidebar).
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex w-fit items-center rounded-md px-2 py-1 text-xl font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      LoraField
    </Link>
  );
}
