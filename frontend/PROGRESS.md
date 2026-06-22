# PROGRESS — LoraField Frontend Rebuild

Snapshot kondisi terkini (update: 2026-06-21). Ringkas, untuk handoff antar-sesi.

## 1. Status Rebuild

- **Fase 1-15 SELESAI.** 15/15 page fungsional, terverifikasi dengan backend asli di `localhost:5173` (proxy ke backend hidup).
- Semua route target di CLAUDE.md sudah ada dan jalan.

## 2. Redesign Visual

- **SELESAI.** Komponen baru `StatCard` + `StatusPill` (subtle) dipakai konsisten di semua page.
- Design system terdokumentasi di [docs/DESIGN.md](docs/DESIGN.md).
- `StatusBadge` (solid, lama) sekarang **orphan** — tidak dipakai lagi, siap dihapus.

## 3. Keputusan Visual (DIKUNCI)

- **Dark-only.** Toggle light mode = future (bukan sekarang).
- **Badge subtle** via `StatusPill`: no-data = neutral abu-abu, merah hanya untuk kondisi kritis.
- **Gauge `SoilGauge` dilepas** — FarmDetail pakai `StatCard` angka, bukan gauge.
- **Dashboard** = peta + card kebun. Card berisi Nama + Komoditas + Status saja (tanpa stat row).
- **Sidebar farm-context** punya link "Ringkasan Kebun" → `/farms/:id`.

## 4. Deviasi Tooling (vs panduan/ekspektasi awal)

- TypeScript **6.0** (no `baseUrl`).
- shadcn **4.11**, React **19**, Vite **8**, recharts **3.8**.
- Proxy `/api` → `127.0.0.1:8000`.

## 5. SELESAI — Gabung Landing Page

Landing page (dari template SaaS hasil v0.dev) dijadikan **route `/`** di dalam frontend. Folder sumbernya sudah dihapus dari repo setelah port (lihat git history).

**Rencana:**
- Samakan warna ke tema LoraField (**dark + teal**).
- Tombol Masuk/Login nyambung ke app.
- Isi konten diedit user sendiri nanti.
- Routing `/` **tanpa guard** (publik).

**Inspeksi stack: SELESAI (read-only).** Temuan kunci:
- Stack: **Next.js 14 App Router** (hasil v0.dev), React 18, **Tailwind v3**, framer-motion 10, radix individual, next-themes, lucide.
- Entry tunggal: satu file `page.tsx` (~965 baris, 8 section + header/footer). Hanya pakai 5 komponen ui (button/accordion/badge/card/tabs); sisa ~60 komponen boilerplate tak terpakai.
- Palette saat ini netral/grayscale (bukan teal) — perlu di-recolor ke tema LoraField.

**Port: SELESAI.** Route `/` publik (tanpa guard) kini render landing. Verifikasi: `npx tsc --noEmit` nol error, `npm run dev` serve `/` 200, semua modul transform bersih.

File dibuat/diubah:
- `src/features/landing/LandingPage.tsx` (baru) — port satu file dari `page.tsx`, struktur 8 section dipertahankan.
- `src/components/ui/accordion.tsx` (baru) — pakai import `radix-ui` terpadu + animasi `tw-animate-css` (`animate-accordion-down/up`).
- `public/placeholder-logo.svg` (baru) — aset logo strip yang diport (diberi `invert` agar tampak di dark).
- `src/app/router.tsx` (diubah) — `/` dulu redirect ke `/dashboard`, kini = `<LandingPage />` (lazy, publik).
- `package.json` (diubah) — tambah dependency `motion` (framer-motion 12, kompatibel React 19).

Adaptasi yang dilakukan:
- Hapus semua `"use client"`; `framer-motion` → `motion/react`; animasi scroll/stagger (container/item, whileInView) dipertahankan.
- `next/image` → `<img>` (screenshot Dribbble eksternal + logo strip); `next/link` → react-router `<Link>` untuk navigasi app, anchor `#section` tetap `<a>`. Semua tombol Login/CTA → `/login`.
- Theme toggle (next-themes Moon/Sun) **dibuang** — dark-only.
- Warna grayscale sumber dipetakan ke token tema (primary teal LoraField); grid dekoratif pakai `var(--border)`; bintang rating pakai `text-primary`; tak ada hex hardcoded.
- `container` diganti kelas eksplisit `mx-auto max-w-7xl px-4 md:px-6` (Tailwind v4 di proyek ini tak mengonfigurasi container).
- Brand "SaaSify" box "S" → mark LoraField (ikon `Sprout` + teks), konsisten dengan sidebar app.

**Sisa milik user:** rewrite copywriting (masih Inggris/"SaaSify") ke Bahasa Indonesia / domain LoraField. Struktur + teknis + warna + animasi sudah jalan.

## 6. Sisa Cleanup

- Hapus `StatusBadge` orphan.
- Promote frontend: **SELESAI** (2026-06-21, branch chore/promote-frontend). Folder rebuild di-rename menjadi `frontend/` menggantikan frontend React lama yang dihapus; `frontend/` kini satu-satunya frontend, backend men-serve `frontend/dist`. Workflow GitHub Pages lama (deploy dashboard statik) ikut dihapus.
