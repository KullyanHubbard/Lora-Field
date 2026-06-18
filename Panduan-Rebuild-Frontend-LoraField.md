# Panduan Rebuild Frontend LoraField

Panduan ini nuntun lo dari nol bikin ulang frontend LoraField pakai arsitektur modern. Ditulis runut, tiap langkah ada penjelasan kenapa-nya, dan tiap teknologi baru (TypeScript, Tailwind, shadcn/ui, TanStack Query) dijelasin dari dasar karena project lama lo belum pakai itu.

Asumsi: lo udah paham React + JavaScript (lo udah bikin versi lama). Yang baru buat lo cuma 4 hal di atas. Sisanya konsep yang udah lo kuasai.

## Strategi besar (baca dulu sebelum mulai)

Dari hasil audit, project lo bukan "berantakan semua". Lapisan logika (api client, helpers, auth, routing) udah rapi dan layak diangkat. Yang amburadul cuma 3:

1. CSS monolit 7.429 baris di `public/static/css/` yang React-nya keiket lewat `className` string.
2. Fetch manual diduplikasi di 7 page, tanpa cache, refresh manual.
3. Zero TypeScript, semua response untyped.

Jadi pendekatannya **strangler migration**: bikin project baru di samping yang lama, angkat logika yang udah bagus (sambil port ke TypeScript), tulis ulang lapisan tampilan dan data fetching. **Jangan hapus folder lama**—jadiin referensi pas porting.

Peta jalannya 12 bagian:

- Bagian 1: Scaffold project (Vite + React + TypeScript)
- Bagian 2: Tooling foundation (Prettier, ESLint, path alias)
- Bagian 3: Tailwind v4 + shadcn/ui
- Bagian 4: Struktur folder feature-based
- Bagian 5: TypeScript types dari API contract
- Bagian 6: API client (port `api.js` ke `api.ts`)
- Bagian 7: TanStack Query (lapisan data)
- Bagian 8: Auth
- Bagian 9: Routing
- Bagian 10: Layout shell
- Bagian 11: Bangun 1 page tuntas (template)
- Bagian 12: Replikasi + charts + map + polish

## Prasyarat

- **Node.js** versi 20 atau 22 (LTS). Cek: `node -v`. Kalau di bawah 20, update dulu—Vite versi baru butuh Node modern.
- Editor: VS Code (paling enak buat TypeScript, autocomplete-nya jalan otomatis).
- Terminal di folder root project lo (yang isinya folder `frontend/` lama).

## Bagian 1 — Scaffold project

**Tujuan:** bikin kerangka project React + TypeScript kosong pakai Vite.

**Apa itu Vite:** build tool yang nyalain dev server super cepat dan nge-bundle kode buat production. Pengganti modern dari Create React App. Project lama lo udah pakai Vite, jadi ini gak asing.

Jalanin dari root (sejajar folder `frontend/` lama):

```bash
npm create vite@latest lorafield-web -- --template react-ts
cd lorafield-web
npm install
npm run dev
```

`--template react-ts` artinya React + TypeScript. Buka URL yang muncul (`http://localhost:5173`), lo bakal liat halaman default Vite. Kalau muncul, scaffold berhasil.

**Apa itu TypeScript:** JavaScript + sistem tipe. Lo nulis kode kayak JS biasa, tapi bisa kasih tahu "variabel ini bentuknya `Farm`, fungsi ini balikin `User`". Manfaatnya dua: autocomplete jalan (editor tahu field apa aja yang ada), dan error ketahuan sebelum dijalanin (salah ketik nama field langsung digarisbawahi merah). Tipe ini cuma ada pas nulis—pas di-build, tipenya dihapus, hasil akhirnya tetap JavaScript biasa. Jadi gak ada beban runtime.

File `.tsx` = komponen React dengan TypeScript. File `.ts` = TypeScript biasa (non-komponen).

## Bagian 2 — Tooling foundation

**Tujuan:** pasang formatter dan linter dulu sebelum nulis kode banyak. Ini fondasi anti-berantakan—format konsisten dari awal, gak perlu rapihin belakangan.

### Prettier (formatter otomatis)

Prettier ngerapihin kode otomatis (indentasi, kutip, koma) tiap save. Konsistensi tanpa mikir.

```bash
npm install -D prettier
```

Bikin file `.prettierrc` di root project:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100
}
```

Di VS Code, install extension "Prettier - Code formatter", lalu aktifin "Format On Save" di settings. Tiap save, kode auto-rapi.

### ESLint

ESLint nangkep pola bermasalah (variabel gak kepake, hook salah taruh). Template `react-ts` udah include ESLint dasar, jadi ini udah jalan. Biarin dulu—nanti bisa ditambah aturan.

### Path alias `@/`

**Tujuan:** biar import gak jadi `../../../components/Button`, tapi `@/components/Button`. Lebih bersih dan gak rusak kalau file dipindah. shadcn juga butuh ini.

Pasang `@types/node` dulu (dibutuhin biar `vite.config.ts` bisa pakai `path`):

```bash
npm install -D @types/node
```

Edit `tsconfig.json` (root) jadi gini:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Vite misah config TypeScript ke beberapa file, jadi tambahin juga di `tsconfig.app.json`, di dalam `compilerOptions`:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

Lalu edit `vite.config.ts`:

```ts
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Sekarang `@/` nunjuk ke folder `src/`. Catatan: `@` harus diset di tiga tempat (dua tsconfig + vite.config) karena TypeScript dan Vite resolve import secara terpisah—TypeScript buat autocomplete editor, Vite buat build beneran.

## Bagian 3 — Tailwind v4 + shadcn/ui

Ini pengganti CSS monolit 7.4k baris lo. Bagian terpenting.

### Apa itu Tailwind

Tailwind itu utility-first CSS: alih-alih nulis file CSS terpisah (`.card { padding: 16px; }`), lo nempel class langsung di JSX (`className="p-4 rounded-lg bg-white"`). Tiap class ngurus satu hal kecil.

Kenapa ini ngalahin CSS global lo:

- **Co-located:** styling nempel di komponen, gak nyebar di file CSS 3.000 baris yang lo gak tahu mana yang kepake.
- **Gak ada penamaan:** lo gak perlu mikir nama class kayak "fd-metric-card" yang gampang bentrok.
- **Gak ada scope leak:** ganti satu komponen gak ngerusak komponen lain. Masalah utama CSS global lo.

Pasang Tailwind v4 (versi terbaru, caranya beda dari v3—gak ada file `tailwind.config.js` lagi):

```bash
npm install tailwindcss @tailwindcss/vite
```

Tambah plugin Tailwind ke `vite.config.ts` (gabung sama yang tadi):

```ts
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Buka `src/index.css`, hapus semua isinya, ganti dengan satu baris:

```css
@import "tailwindcss";
```

Itu doang. Tailwind v4 jauh lebih ringkas dari v3.

### Apa itu shadcn/ui

Ini yang sering bikin bingung: shadcn **bukan** library komponen yang lo install kayak Material UI. shadcn nyalin source code komponen langsung ke repo lo. Jadi komponen Button, Card, Table itu jadi file di project lo yang bisa lo edit sesuka hati. Lo yang punya kodenya, gak ada abstraksi tersembunyi.

Di baliknya: dibangun di atas Radix (untuk accessibility—keyboard, screen reader, beres otomatis) + Tailwind (untuk styling). Jadi lo dapat komponen yang aksesibel dan bisa di-styling pakai Tailwind, dengan kode yang lo kontrol penuh.

Jalanin init:

```bash
npx shadcn@latest init
```

Bakal ada beberapa pertanyaan. Pilih base color **Neutral** (atau Zinc, terserah). Init ini bikin file `components.json` (config shadcn) dan ngisi `src/index.css` dengan CSS variables buat tema (warna, radius, dll).

Sekarang tambah komponen yang bakal sering lo pakai:

```bash
npx shadcn@latest add button card badge table tabs input label sonner skeleton sidebar
```

Komponen-komponen ini muncul di `src/components/ui/`. `sonner` itu buat toast notification, `skeleton` buat loading placeholder, `sidebar` buat navigasi.

### Set tema teal LoraField

shadcn init udah ngisi `src/index.css` dengan blok `:root` (mode terang) dan `.dark` (mode gelap), isinya CSS variables kayak `--primary`, `--background`, dll. Karena LoraField pakai teal `#00C896` di atas dark background, lo tinggal ganti variabel `--primary`.

Cari blok `.dark` di `index.css`, ganti baris `--primary` jadi teal lo:

```css
.dark {
  --primary: #00C896;
  --primary-foreground: #00120c;
  /* sisanya biarin hasil generate shadcn */
}
```

Buat palette dark lengkap yang harmonis (background, card, border, muted, dll), pakai theme generator di **tweakcn.com** atau halaman Theming di docs shadcn—lo set warna teal, dapet satu set variabel lengkap yang bisa di-paste. Gua gak kasih nilai OKLCH satu-satu di sini biar gak ngarang—lebih akurat pakai generator.

Biar app default ke dark mode, tambahin `class="dark"` di tag `<html>` pada `index.html`.

Test: edit `src/App.tsx`, hapus isinya, ganti:

```tsx
import { Button } from '@/components/ui/button'

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">LoraField</h1>
      <Button>Tombol Teal</Button>
    </div>
  )
}

export default App
```

Kalau muncul tombol dengan warna teal, Tailwind + shadcn + tema udah jalan. Fondasi tampilan beres.

## Bagian 4 — Struktur folder feature-based

**Tujuan:** susun folder by-feature, bukan by-type.

Project lama lo by-type: semua page di `pages/`, semua komponen di `components/`. Rapi, tapi pas kerja di fitur "farms", lo harus loncat-loncat antar folder. Feature-based naruh semua yang berkaitan dengan satu fitur dalam satu folder—page-nya, query hook-nya, komponennya jadi satu tempat.

Bikin struktur ini di `src/`:

```
src/
  main.tsx
  App.tsx
  app/
    providers.tsx        # QueryClientProvider, AuthProvider digabung di sini
    router.tsx           # definisi route
  components/
    ui/                  # komponen shadcn (auto-generate ke sini)
    layout/              # Sidebar, Topbar
  features/
    auth/
      AuthContext.tsx
      LoginPage.tsx
      queries.ts
    farms/
      FarmListPage.tsx
      FarmDetailPage.tsx
      queries.ts
      components/        # FarmCard, SoilGauge, dll
    monitoring/
      MonitoringPage.tsx
      queries.ts
    logs/
      LogsPage.tsx
      queries.ts
    weather/
    settings/
  lib/
    api.ts               # API client
    token.ts             # akses token, satu sumber
    utils.ts             # cn() bawaan shadcn + helper domain hasil port
  types/
    index.ts             # semua type domain
```

Folder `app/` buat setup tingkat aplikasi (provider, router). `lib/` buat utility lintas-fitur. `types/` buat definisi type yang dipakai di mana-mana.

## Bagian 5 — TypeScript types dari API contract

**Tujuan:** definisikan bentuk semua data dari backend, sekali, di satu tempat. Ini fondasi—begitu type-nya ada, seluruh app dapet autocomplete dan pengecekan otomatis.

Untungnya API contract lo udah didokumentasiin lengkap di audit. Tinggal tulis ulang jadi type. Bikin `src/types/index.ts`:

```ts
export interface Farm {
  id: string
  name: string
  location: string
  crop_type: string
  owner: string
  area_ha: number
  latitude: number
  longitude: number
  bmkg_adm4_code: string
  status: string
  updated_at: string
}

export interface Reading {
  id: string
  soil_moisture: number
  soil_temp: number
  air_temp: number
  air_humidity: number
  created_at: string
}

export interface Node {
  id: string
  name: string
  location: string
  status: string
  battery: number
  updated_at: string
}

export interface IrrigationLog {
  id: string
  node_id: string
  soil_moisture: number
  weather: string
  decision: string
  valve_state: string
  reason: string
  created_at: string
}

export interface WeatherForecastPoint {
  local_datetime?: string
  datetime?: string
  utc_datetime?: string
  weather?: number
  code?: number
  weather_desc?: string
  condition?: string
  t?: number
  temperature?: number
}

export interface Weather {
  region: { village: string; district: string; city: string; province: string }
  adm4: string
  provider: string
  condition: string
  code: number
  temperature: number
  humidity: number
  wind_speed: number
  wind_direction: string
  rain_next_3h: number
  forecast_time: string
  updated_at: string
  location_profile: { altitude_m: number }
  forecast: WeatherForecastPoint[]
}

export interface NodeSummary {
  node: Node
  latest_reading: Reading
  decision: { decision: string; valve_state: string }
}

export interface FarmSummary {
  farm: Farm
  gateway_status: 'online' | 'degraded' | 'offline'
  average_soil_moisture: number
  thresholds: { lower: number; upper: number }
  nodes_problem: number
  nodes: NodeSummary[]
  weather: Weather
}

export interface User {
  id: string
  name: string
  email: string
  phone?: string
}
```

**Penting (anti-halusinasi):** beberapa field gua tebak tipenya dari pemakaian di audit—`rain_next_3h` (number atau boolean?), `weather` di log (string atau object?), dan isi `User` belum kelihatan penuh. Cocokin sama response asli backend lo waktu wiring nanti, sesuaikan kalau beda. Type ini fondasi, jadi pastiin bener.

Penjelasan singkat sintaks: `interface Farm { ... }` mendefinisikan bentuk objek. `field?: tipe` artinya opsional (boleh gak ada). `'online' | 'degraded' | 'offline'` artinya nilainya harus salah satu dari tiga string itu (union type)—ini bikin autocomplete tahu pilihannya dan nangkep typo.

## Bagian 6 — API client (port `api.js` ke `api.ts`)

**Tujuan:** angkat `api.js` lo (yang audit bilang udah bersih) ke TypeScript, sekalian benerin dua masalah: token yang bocor ke UI dan error yang ketelen diam-diam.

### Token: satu sumber

Audit nemu `SettingsPage` baca `localStorage` token langsung, bypass `api.js`. Fix-nya: semua akses token lewat satu file. Bikin `src/lib/token.ts`:

```ts
const TOKEN_KEY = 'lf_access_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
```

Mulai sekarang, gak ada komponen yang boleh sentuh `localStorage` token langsung—selalu lewat fungsi ini.

### Fetch wrapper

Bikin `src/lib/api.ts`. Bedanya dari versi lama: kalau request gagal, **lempar error** (bukan balikin `{status:0, data:{}}` diam-diam). Ini penting karena nanti TanStack Query bakal nangkep error itu otomatis dan ngubahnya jadi state `error` di komponen—jadi penanganan error jadi konsisten, gak ditulis ulang tiap page.

```ts
import { getToken } from './token'
import type {
  Farm, FarmSummary, Reading, IrrigationLog, User,
} from '@/types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.detail ?? body.message ?? message
    } catch {
      // body bukan JSON, pakai statusText aja
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => apiFetch<User>('/auth/me'),

  getFarms: () => apiFetch<{ items: Farm[] }>('/farms'),
  getFarm: (id: string) => apiFetch<Farm>(`/farms/${id}`),
  getFarmSummary: (id: string) => apiFetch<FarmSummary>(`/farms/${id}/summary`),

  getReadings: (nodeId: string, limit = 50) =>
    apiFetch<{ items: Reading[] }>(`/nodes/${nodeId}/readings?limit=${limit}`),

  getLogs: (limit = 50) =>
    apiFetch<{ items: IrrigationLog[] }>(`/logs?limit=${limit}`),
}
```

Perhatiin `apiFetch<T>`: huruf `T` itu generic—fungsi ini balikin tipe apa pun yang lo minta. Pas lo panggil `getFarms()`, TypeScript tahu hasilnya `{ items: Farm[] }`, jadi `data.items[0].name` langsung dapet autocomplete. Inilah ganti dari akses defensif `data.items || []` di versi lama.

Tambahin endpoint lain (register, forgot-password, createFarm, deleteFarm, crops, resolve-adm4) ngikut pola yang sama. **Buang `listNodes`**—audit bilang itu dead code.

**Verifikasi dulu:** audit nemu mismatch endpoint reset password (`/auth/reset-password/verify` di kode vs `/auth/verify-reset-code` di docs). Cek backend mana yang bener sebelum nulis fungsi itu.

## Bagian 7 — TanStack Query (lapisan data)

Ini yang ngebunuh masalah #2: fetch diduplikasi 7x tanpa cache.

### Apa itu TanStack Query

TanStack Query misahin **server state** (data yang datang dari API) dari client state biasa. Dia ngurus caching, dedup request, refetch di background, plus state loading dan error—otomatis. Lo gak nulis `useEffect` + `useState` + `loading` + `error` manual lagi.

Konsep kuncinya: tiap data dikasih **queryKey** (kayak alamat). Dua komponen yang minta data dengan queryKey sama bakal pakai cache yang sama—gak fetch dua kali. Inilah cara `getFarmSummary` farm yang sama berhenti di-refetch 7x: semua page pakai key `['farm-summary', farmId]`, jadi cuma satu request, di-share.

### Setup

```bash
npm install @tanstack/react-query
```

Edit `src/main.tsx` buat bungkus app dengan provider:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,  // data dianggap fresh 30 detik, gak refetch berlebihan
      retry: 1,           // gagal? coba ulang sekali
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

### Query hooks

Bikin hook per fitur. Contoh `src/features/farms/queries.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => api.getFarms(),
  })
}

export function useFarmSummary(farmId: string) {
  return useQuery({
    queryKey: ['farm-summary', farmId],
    queryFn: () => api.getFarmSummary(farmId),
    enabled: !!farmId,        // jangan fetch kalau farmId kosong
    refetchInterval: 30_000,  // auto-refresh tiap 30 detik
  })
}
```

`refetchInterval` itu yang ngeganti tombol "Muat Ulang" manual lo—data update sendiri di background. Di hari panen atau monitoring, dashboard lo jadi live tanpa perlu klik.

Tiap komponen yang butuh data farm summary cukup panggil `useFarmSummary(farmId)`. Dapet `{ data, isLoading, error }`. Mau dipanggil di 7 page sekaligus pun, request-nya tetap satu (di-cache).

## Bagian 8 — Auth

Audit bilang auth lo (Context + guards) solid. Jadi ini **port, bukan tulis ulang**.

Pindahin logika `AuthContext.jsx` lama ke `src/features/auth/AuthContext.tsx`, kasih type. Inti yang dipertahankan: simpan token + user, sync antar-tab lewat storage event, sediakan `login()`, `logout()`, dan status terautentikasi. Bedanya cuma sekarang semua akses token lewat `lib/token.ts` (Bagian 6), dan datanya bertype `User`.

`login()` panggil `api.login()`, simpan token via `setToken()`, simpan user di state. `logout()` panggil `clearToken()` dan reset state. Guard `RequireAuth` dan `RedirectIfAuth` lo port apa adanya—logikanya gak berubah, cuma jadi `.tsx`.

Kalau nanti global UI state lo nambah dan Context kerasa ribet, baru pertimbangin Zustand. Untuk sekarang, Context lo udah cukup—jangan over-engineer.

## Bagian 9 — Routing

Audit bilang routing lo udah v7 + lazy/Suspense + guards, dan itu salvageable. Jadi ini juga port.

```bash
npm install react-router-dom
```

Pindahin struktur `<Routes>/<Route>` dari `App.jsx` lama ke `src/app/router.tsx`, dengan path yang sama (15 route lo). Pertahankan:

- `lazy()` + `<Suspense>` buat code-splitting per page (penting buat Leaflet & chart yang berat).
- Guard `<RequireAuth>` dan `<RedirectIfAuth>`.
- Catch-all `*` redirect ke `/dashboard`.

Yang berubah cuma import path—dari struktur lama ke `@/features/.../SomePage`. Logika routing gak disentuh.

## Bagian 10 — Layout shell

**Tujuan:** bikin rangka aplikasi (sidebar + topbar) pakai shadcn + Tailwind, sebelum ngisi page.

Lo udah `add sidebar` di Bagian 3. shadcn punya komponen Sidebar lengkap (collapsible, responsif). Bikin `src/components/layout/AppLayout.tsx` yang masukin Sidebar (navigasi ke 15 route lo) + Topbar (judul + tombol logout + indikator user) + area konten utama tempat page dirender.

Styling pakai class Tailwind dan CSS variable tema (`bg-background`, `text-foreground`, `border-border`). Warna teal otomatis kepakai lewat komponen yang `variant`-nya primary. Buang total ketergantungan ke 7.4k CSS lama.

## Bagian 11 — Bangun 1 page tuntas (template)

**Tujuan:** selesaikan satu page dari ujung ke ujung (type sampai UI) buat ngebentuk pola, baru replikasi. Jangan bikin semua UI dulu baru logika—itu yang bikin overwhelmed.

Mulai dari yang simpel: halaman daftar farm (Dashboard). Bikin `src/features/farms/FarmListPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useFarms } from './queries'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export function FarmListPage() {
  const { data, isLoading, error } = useFarms()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive">Gagal memuat farm: {error.message}</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {data?.items.map((farm) => (
        <Link key={farm.id} to={`/farms/${farm.id}`}>
          <Card className="p-4 transition hover:border-primary">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{farm.name}</h3>
              <Badge>{farm.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{farm.location}</p>
            <p className="mt-2 text-sm">{farm.crop_type} • {farm.area_ha} ha</p>
          </Card>
        </Link>
      ))}
    </div>
  )
}
```

Page ini nunjukin seluruh pola sekaligus, dan ini kontras langsung dengan versi lama lo:

- **Data:** satu baris `useFarms()`. Gak ada `useEffect`, `useState`, atau fetch manual. (Versi lama: pola load/loading/error ditulis ulang tiap page.)
- **Loading:** komponen `Skeleton`, otomatis dari `isLoading`.
- **Error:** ditangani konsisten dari `error.message`. (Versi lama: tiap page urus error sendiri, gak konsisten.)
- **Tampilan:** `Card`, `Badge` dari shadcn + class Tailwind. Gak nyentuh CSS global. Warna teal lewat `hover:border-primary`.
- **Typed:** `farm.name`, `farm.crop_type` dapet autocomplete, typo ketahuan. (Versi lama: untyped, akses defensif.)

Begitu page ini jalan dan kerasa enak, lo udah pegang pola yang dipakai ke semua page lain.

## Bagian 12 — Replikasi + charts + map + polish

Setelah template jadi, replikasi ke page lain dengan pola yang sama: bikin query hook di `features/<fitur>/queries.ts`, bikin page yang konsumsi hook itu, susun UI pakai shadcn + Tailwind.

Sebelum nulis ulang JSX tiap page, **ekstrak dulu domain logic** yang kependam di page lama (audit nyebut: CSV export, `classifyLog`, weather-code map, badge mapper). Pindahin ke `lib/utils.ts` atau utils per-fitur sebagai fungsi murni, kasih type. Ini logika bisnis nyata—jangan ikut kebuang pas rewrite tampilan.

### Charts

Project lama pakai `chart.js`. Karena UI ditulis ulang ke shadcn, gua saran pindah ke shadcn Chart (basisnya Recharts) biar nyatu sama design system. Port-nya kecil—cuma config chart.

```bash
npm install recharts
npx shadcn@latest add chart
```

Pakai buat MonitoringPage (grafik soil moisture dari waktu ke waktu, datanya dari `useReadings`). Ikutin contoh di docs shadcn Chart. Kalau lo lebih nyaman tetap `chart.js`, boleh—tinggal install `chart.js react-chartjs-2` dan port komponen chart lama.

### Map

Project lama pakai raw Leaflet (ngatur lifecycle DOM manual di React = ribet). Pindah ke react-leaflet (wrapper idiomatik):

```bash
npm install react-leaflet leaflet
npm install -D @types/leaflet
```

FarmMap lo jadi `<MapContainer>` + `<TileLayer>` + `<Marker>` per farm, jauh lebih bersih. Inget import CSS Leaflet (`import 'leaflet/dist/leaflet.css'`).

### Polish

- **Toast:** pakai `sonner` (udah di-add) buat notif sukses/gagal aksi (simpan farm, hapus, dll).
- **Dark mode:** udah default lewat `class="dark"`. Kalau mau toggle terang/gelap, simpan preferensi di state + class `<html>`.
- **Loading & empty state:** tiap page kasih Skeleton (loading) dan pesan ramah pas data kosong.
- **Mutation:** buat aksi yang ngubah data (create/delete farm), pakai `useMutation` dari TanStack Query—dia bisa otomatis nge-refresh cache yang relevan setelah sukses (`invalidateQueries`), jadi UI langsung sinkron.

## Penutup

Urutan kerjanya: Bagian 1 sampai 4 dikerjain sekali di awal (setup). Bagian 5 sampai 9 itu porting logika lo yang udah bagus ke TypeScript. Bagian 10 sampai 12 itu rebuild tampilan, satu page tuntas dulu baru sisanya.

Prinsip yang pegang seluruh proses: angkat logika yang sehat, tulis ulang yang amburadul, dan ekstrak domain logic yang kependam di page sebelum buang UI-nya. Pelan tapi rapi—strukturnya kebentuk sendiri.
