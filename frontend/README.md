# LoraField Frontend

Dashboard web LoraField: monitoring kebun, node sensor LoRa, gateway, irigasi, dan
prakiraan cuaca BMKG. Vite + React 19 + TypeScript, Tailwind v4 + shadcn/ui,
TanStack Query, react-router-dom v7, Recharts, react-leaflet, i18next (id/en).

## Perintah

```bash
npm install
npm run dev        # http://localhost:5173, /api diteruskan ke backend :8000
npm run build      # cek tipe + build ke dist/ (di-serve backend di /)
npm run lint
npx tsc -p tsconfig.app.json --noEmit   # cek tipe saja
```

Backend harus jalan di port 8000 (lihat `backend/README.md`). Target proxy bisa
diganti lewat `VITE_API_PROXY_TARGET`.

## Struktur `src/`

| Folder | Isi |
|--------|-----|
| `app/` | Router dan provider (Query, Router, Auth) |
| `features/` | Satu folder per halaman/fitur. Data fetching lewat `queries.ts` di tiap fitur |
| `components/ui/` | Komponen shadcn/ui |
| `components/layout/` | Layout aplikasi (sidebar, brand) |
| `lib/` | Helper bersama: `api.ts`, `token.ts`, `format.ts`, `status.ts`, `toneClasses.ts` |
| `i18n/` | Konfigurasi dan file bahasa (`locales/id.json`, `locales/en.json`) |
| `types/` | Tipe data yang cocok dengan kontrak API backend |

Aturan kerja, kontrak API, dan daftar rute ada di `CLAUDE.md` di root repo.
