# GEMINI.md: Aturan Kerja Gemini di LoraField

Kamu diminta membantu memperbaiki **frontend** LoraField. Proyek ini juga dikerjakan agen lain dan
pemiliknya sering menjalankan backend, web, dan simulator di terminal. Tugasmu: kerjakan hanya yang
diminta, tanpa mengganggu bagian lain.

## Baca dulu

`CLAUDE.md` adalah sumber kebenaran proyek: stack, kontrak API, database, konvensi kode, dan aturan UI.
Semua aturan di sana berlaku juga untukmu. Kalau ada yang bertentangan dengan file ini, ikuti yang
lebih ketat dan tanyakan ke user.

## Boleh diubah

- `frontend/src/**`, hanya file yang dibutuhkan tugas yang diminta user.

## Dilarang diubah tanpa izin eksplisit user di chat

- `backend/**`: API, database, logika irigasi.
- `simulator/**`: simulator perangkat IoT.
- `CLAUDE.md`, `GEMINI.md`, semua `README.md`.
- `frontend/package.json` dan `frontend/package-lock.json`: jangan menambah, menghapus, atau
  menaikkan versi dependency.
- Config: `frontend/vite.config.ts`, `frontend/tsconfig*.json`, `frontend/eslint.config.js`,
  `frontend/.prettierrc`, `frontend/components.json`.
- `frontend/public/static/`, `.gitignore`, `.gitattributes`, `Dockerfile`, `docker-compose.yml`,
  `lorafield.bat`.
- `.env` di mana pun, dan `backend/data/` (database asli user).
- `frontend/src/components/ui/**` (komponen shadcn), kecuali tugasnya memang komponen itu.
- `frontend/src/lib/api.ts` dan `frontend/src/types/index.ts` adalah cermin kontrak API backend.
  Jangan mengubah bentuk data, jangan mengarang endpoint atau field. Kalau butuh data yang belum
  ada di API, berhenti dan tanya.

## Jangan ganggu proses yang sedang jalan

- Backend (port 8000), web dev server (port 5173), dan simulator bisa sedang berjalan di terminal
  user. Jangan mematikan, me-restart, atau menjalankan ulang proses itu, dan jangan memakai port itu.
- Jangan menjalankan `python simulator/lorafield_sim.py cleanup` atau perintah lain yang menulis ke
  database.
- Jangan menjalankan perintah git yang mengubah riwayat atau working tree: `commit`, `push`, `reset`,
  `checkout`, `restore`, `stash`, `clean`, `rebase`, `merge`. User yang melakukan commit.
- Jangan menghapus file yang tidak kamu buat di sesi ini.

## Aturan frontend yang paling sering dilanggar

Detail lengkap ada di `CLAUDE.md`. Ringkasnya:

- Data dari backend hanya lewat hook TanStack Query di `src/features/*/queries.ts`. Tidak ada
  `fetch` di komponen. Token hanya lewat `src/lib/token.ts`.
- Status dari backend dibaca apa adanya: `node.status`, `decision.type`, `gateway_status`,
  `irrigation_mode`, batas kelembapan di `summary.thresholds`. Jangan menghitung ulang di frontend
  dengan angka atau aturan sendiri.
- Warna hanya dari token tema: `src/index.css`, `src/lib/toneClasses.ts`, `src/lib/chartColors.ts`.
  Tidak ada kode hex di TSX. Tidak ada inline style kecuali nilai dinamis (misalnya lebar bar dari data).
- Semua teks UI lewat i18n. Setiap key baru wajib ada di `src/i18n/locales/id.json` dan `en.json`.
  Hapus key yang tidak dipakai lagi.
- Angka yang dipakai di lebih dari satu tempat jadi konstanta bernama, misalnya di
  `src/lib/timeWindows.ts`, `src/lib/fieldLimits.ts`, `src/lib/queryTiming.ts`.
- Waktu dari backend dibaca lewat `parseServerDate` di `src/lib/format.ts`.
- Jangan pakai em dash di teks mana pun.
- Layout **Ringkasan Kebun** di Dashboard (3 kolom) dilindungi. Jangan ubah struktur, ukuran, atau
  posisi kartunya tanpa persetujuan user.
- Tidak ada data dummy di kode frontend. Data uji datang dari `simulator/` lewat API.
- Setiap perubahan harus aman di mode terang dan gelap, serta di layar HP (tanpa scroll horizontal).

## Sebelum menyatakan selesai

Jalankan dari folder `frontend/`, semuanya wajib bersih:

```
npx tsc -p tsconfig.app.json --noEmit
npx eslint src
npx prettier --check src
npm run build
```

Lalu laporkan ke user: file apa saja yang diubah dan kenapa. Kalau ragu soal desain, data, atau
batas tugas, berhenti dan tanya user. Jangan menebak.
