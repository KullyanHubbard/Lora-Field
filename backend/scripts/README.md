# Backend Operations Scripts

Tooling untuk run produksi LoraField di Windows. Pakai semua script ini sebelum expose backend ke Cloudflare Tunnel.

## Isi folder

| File | Fungsi |
|------|--------|
| `backup_db.py` | Backup SQLite live (pakai `sqlite3.backup()`). Rotasi 7 backup terakhir. |
| `backup-db.ps1` | Wrapper PowerShell untuk Task Scheduler. Panggil `backup_db.py` + log. |
| `start-resilient.ps1` | Auto-restart wrapper uvicorn. Crash → tunggu 5 detik → restart. Stop kalau 5 crash dalam 2 menit. |

Log output di `backend/logs/`:
- `app.log` (rotating, app-level) — events Python: startup, login, password reset, dll
- `supervisor.log` — output `start-resilient.ps1`
- `backup.log` — output backup harian

---

## 1. Setup auto-restart (Task Scheduler)

Tujuan: backend otomatis hidup saat Windows boot, dan otomatis restart kalau uvicorn crash.

**Langkah:**

1. Buka **Task Scheduler** (`taskschd.msc`)
2. **Create Task...** (bukan Basic Task — butuh opsi advanced)
3. **General tab:**
   - Name: `LoraField Backend`
   - Description: `Uvicorn supervisor untuk LoraField`
   - Pilih: `Run whether user is logged on or not`
   - Centang: `Run with highest privileges`
   - Configure for: `Windows 10` (atau Windows 11)
4. **Triggers tab → New:**
   - Begin the task: `At startup`
   - Centang: `Enabled`
5. **Actions tab → New:**
   - Action: `Start a program`
   - Program/script: `powershell.exe`
   - Add arguments: `-NoProfile -ExecutionPolicy Bypass -File "D:\CDP-Proyek\backend\scripts\start-resilient.ps1"`
   - Start in: `D:\CDP-Proyek\backend`
6. **Conditions tab:**
   - Uncheck `Start the task only if the computer is on AC power` (kalau di laptop)
7. **Settings tab:**
   - Centang: `Allow task to be run on demand`
   - **Uncheck**: `Stop the task if it runs longer than` (kita mau jalan selamanya)
   - If the task is already running: `Do not start a new instance`
8. **OK** → minta password user account.

**Verifikasi:**
- Right-click task → Run. Cek `backend/logs/supervisor.log` muncul.
- `curl http://127.0.0.1:8000/health` harus 200.
- Reboot Windows. Setelah login, backend harus hidup tanpa intervensi.

---

## 2. Setup backup harian (Task Scheduler)

Tujuan: salin `lorafield.db` setiap hari ke folder `data/backups/`, simpan 7 backup terakhir.

**Langkah:**

1. Task Scheduler → **Create Basic Task...**
2. Name: `LoraField DB Backup`
3. Trigger: `Daily`, jam: `02:00` (atau pilihan kamu, idealnya saat traffic minimal)
4. Action: `Start a program`
   - Program: `powershell.exe`
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -File "D:\CDP-Proyek\backend\scripts\backup-db.ps1"`
   - Start in: `D:\CDP-Proyek\backend`
5. Finish. Buka properties task → **Settings** tab → centang `Run task as soon as possible after a scheduled start is missed` (handle laptop tidur).

**Verifikasi:**
- Right-click task → Run. Cek `backend/data/backups/` ada file baru.
- Cek `backend/logs/backup.log`.

**Restore manual** (kalau DB corrupt):
```
# Stop backend dulu
copy "backend\data\backups\lorafield-YYYY-MM-DD-HHMMSS.db" "backend\data\lorafield.db"
# Restart backend
```

---

## 3. Cloudflare WAF — Rate Limiting

Karena kita expose via Cloudflare Tunnel, rate limiting paling efisien di edge Cloudflare (zero overhead di backend Python).

**Setup (free tier punya 1 rule, cukup untuk MVP):**

1. Login [dash.cloudflare.com](https://dash.cloudflare.com) → pilih domain
2. **Security → WAF → Rate limiting rules → Create rule**
3. Settings:
   - **Rule name**: `LoraField auth bruteforce protection`
   - **If incoming requests match**: 
     - Field: `URI Path` | Operator: `starts with` | Value: `/api/auth/`
   - **When rate exceeds**: `10 requests per 1 minute` (per IP)
   - **Then take action**: `Block` selama `1 minute`
4. **Deploy**

**Rule tambahan (opsional, kalau punya paket Pro+):**
- `/api/auth/login` saja: 5 req/menit (lebih ketat)
- `/api/auth/forgot-password`: 3 req/menit

**Verifikasi:**
- Coba login salah 11x dari 1 browser/IP → request ke-11 harus 429 dari Cloudflare.
- Cek **Security → Events** di dashboard Cloudflare untuk lihat rule trigger.

---

## 4. Manual operations

**Cek status:**
```powershell
# Backend hidup?
curl http://127.0.0.1:8000/health

# Cek log app
Get-Content D:\CDP-Proyek\backend\logs\app.log -Tail 50

# Cek log supervisor
Get-Content D:\CDP-Proyek\backend\logs\supervisor.log -Tail 30
```

**Stop/start manual:**
```powershell
# Stop
Stop-ScheduledTask -TaskName "LoraField Backend"
# (atau: Get-Process uvicorn | Stop-Process)

# Start
Start-ScheduledTask -TaskName "LoraField Backend"
```

**Backup manual ad-hoc:**
```powershell
& "D:\CDP-Proyek\backend\.venv\Scripts\python.exe" "D:\CDP-Proyek\backend\scripts\backup_db.py"
```
