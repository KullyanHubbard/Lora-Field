import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Cari kode wilayah BMKG (adm4) dari koordinat, dengan alamat sebagai petunjuk.
export function useResolveAdm4() {
  return useMutation({
    mutationFn: ({ lat, lng, hint }: { lat: number; lng: number; hint: string }) =>
      api.resolveAdm4(lat, lng, hint),
  });
}
