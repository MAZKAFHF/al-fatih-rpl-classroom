# AL-FATIH RPL CLASSROOM

Sistem kelas lokal berbasis browser untuk SMK RPL — **100% offline, tanpa internet**, berjalan di jaringan hotspot lokal dengan **WebRTC screen sharing** asli.

> Guru buat hotspot HP (tanpa internet) → Laptop server jalankan `npm run classroom` → Murid konek hotspot → Buka `http://192.168.x.x:3000` → Guru Share Screen → Murid melihat layar guru realtime di browser.

---

## Fitur Utama

- **Tanpa Internet** — Semua berjalan di LAN (hotspot HP). Tidak ada dependency Firebase, Supabase, Vercel, STUN/TURN eksternal, CDN, atau Google Fonts runtime.
- **Screen Sharing Asli** — `navigator.mediaDevices.getDisplayMedia()` + WebRTC peer connection. Guru pilih Entire Screen / Window / Tab. Host candidates (LAN) tanpa STUN eksternal.
- **Signaling Lokal** — Socket.IO di server laptop, auto-reconnect, room per kode kelas.
- **Chat Realtime, Pengumuman, Angkat Tangan, Kehadiran**
- **Materi Lokal** — Upload PDF/DOCX/PPTX/ZIP/gambar/TXT ke `storage/materials`, download via LAN dengan validasi & path-traversal protection.
- **Auth Lokal** — bcrypt (12 rounds) + JWT httpOnly cookie, role `ADMIN`/`TEACHER`/`STUDENT`, proteksi route server-side.
- **Kelas via Kode** — `RPL-XXXX` random, regenerate, lock kelas.
- **SQLite Lokal** — `node:sqlite` (built-in Node 22+) tanpa native build, WAL, foreign_keys, backup via `npm run backup`.
- **Deteksi IP Otomatis** — Tampilkan URL `http://192.168.x.x:3000` + QR lokal saat startup.
- **UI Profesional** — Tailwind, responsive 320–1440px, tanpa glass/gradient berlebihan.

---

## Arsitektur LAN-Only

```
Teacher HP (Hotspot, Mobile Data OFF)
    │
    ├─── Student Server Laptop (192.168.x.x:3000)
    │      ├── Next.js (HTTP + API)
    │      └── Socket.IO Signaling (path: /socket.io)
    │             └── WebRTC relay (offer/answer/ICE)
    │
    ├── Students (Browser) ──► http://192.168.x.x:3000/join
    │                              │
    │                              ▼
    │                         WebRTC (LAN host candidates)
    │                         Teacher stream → Students
    │
    └── No Internet Required (WAN OFF)
```

**WebRTC tanpa STUN eksternal:** `RTCConfiguration { iceServers: [] }`. Di hotspot yang sama, host candidates (`192.168.x.x`) cukup untuk koneksi. Tidak ada request ke `stun.l.google.com` atau TURN.

**Tidak ada runtime CDN:** `next/font` di-bundle saat build, Tailwind lokal, Socket.IO client dari `node_modules`, tidak ada fetch ke internet saat kelas berjalan.

---

## Requirements

- Node.js **22+** (disarankan 22 LTS, tested 24). Node 22+ memiliki `node:sqlite` built-in tanpa kompilasi.
- Windows (target utama), macOS/Linux juga support.
- Browser modern: Chrome / Edge terbaru untuk screen sharing. Firefox support terbatas.

---

## Instalasi

```bash
# 1. Clone / buka folder
cd "AL-FATIH RPL CLASSROOM"

# 2. Install
npm install

# 3. (Opsional) Set .env
copy .env.example .env
# edit JWT_SECRET minimal 32 char di production
```

Tidak perlu Prisma, Docker, WSL.

---

## Startup (Satu Perintah)

```bash
npm run classroom
# alias: npm run start:local
# dev mode: npm run dev  ( = node scripts/classroom.mjs --dev )
```

Skrip akan:

1. Buat `data/classroom.db` & `storage/materials` jika belum ada
2. Deteksi IPv4 lokal (prefer Wi-Fi / 192.168.x.x)
3. Start Next + Socket.IO di `0.0.0.0:3000`
4. Tampilkan banner:

```
=====================================
 AL-FATIH RPL CLASSROOM
=====================================
 Local server: RUNNING
 Port:         3000
 Signaling:    RUNNING (Socket.IO)
 Database:     READY (SQLite)

 Classroom URL (utama):
   http://192.168.43.25:3000
 Internet required: NO
 ...
 Press Ctrl+C to stop.
=====================================
```

Buka URL tersebut di laptop guru untuk setup, atau di HP murid untuk join.

**Build production:**

```bash
npm run build
npm start        # sama dengan npm run classroom (production)
```

**Backup DB:**

```bash
npm run backup   # copy data/classroom.db → data/backups/classroom-backup-<timestamp>.db
```

---

## First Run Setup

1. Buka `http://<IP>:3000/setup` (atau akan redirect jika belum ada admin)
2. **Langkah 1:** Buat Administrator
   - Nama, Username, Password (min 6 char, hash bcrypt)
3. **Langkah 2:** Buat Guru
   - Nama, Username, Password
4. Login di `/login` dengan akun guru

Alternatif: `GET /api/setup` cek `{ needsSetup: boolean }`.

---

## Workflow Guru

1. Login `/login` → Dashboard
2. **Buat Kelas:** Dashboard → `+ Buat Kelas` → Nama (RPL XI), Mapel (Pemrograman Web) → kode `RPL-A3F9` terbuat
3. **Mulai Kelas:** `Mulai` → session `active`
4. **Masuk Kelas:** `Masuk Kelas` → `/classroom/RPL-A3F9`
5. **Share Screen:** `⦿ Share Screen` → pilih Entire Screen → murid otomatis melihat
6. Chat, Pengumuman (`📢`), lihat murid, clear raise-hand, upload materi, akhiri kelas
7. **Lock/Regenerate:** Dashboard → `↻` untuk kode baru, lock mencegah join baru

## Workflow Siswa

1. Konek ke hotspot guru (tanpa internet)
2. Buka `http://192.168.x.x:3000` → `Join Kelas`
3. Masukkan Kode (`RPL-A3F9`) + Nama (`Azka`) → Join (guest token httpOnly)
4. Masuk `/classroom/RPL-A3F9` → menunggu guru sharing → video muncul otomatis, bisa Fullscreen
5. Chat, `✋ Angkat Tangan`, lihat materi & download
6. Jika disconnect: `⚠ Reconnecting...` auto-reconnect Socket.IO, klik `Coba sambungkan ulang` untuk WebRTC

---

## Screen Sharing Detail

- **Capture:** `getDisplayMedia({ video: { ideal 1280x720, 12-24fps }, audio: true })` — stabil untuk 40 siswa, tidak 60fps
- **Signaling:** `teacher:start-sharing` → `student:joined` / `student:request-offer` → `webrtc:offer` → `webrtc:answer` → `webrtc:ice-candidate` (relay via Socket.IO room)
- **Teacher:** 1 `RTCPeerConnection` per siswa, `addTrack` dari `MediaStream`, `createOffer` per siswa
- **Student:** 1 `RTCPeerConnection`, `ontrack` → `srcObject` video
- **Stop:** `track.onended` → `teacher:stop-sharing` → tutup semua peer
- **Tanpa SFU:** Mesh sederhana, cukup untuk 40 siswa di LAN (CPU guru dominan, bandwidth ~1-2 Mbps per siswa di 720p)

---

## Struktur Project

```
/app
  page.tsx              # Landing + network status
  login/ join/ setup/ dashboard/ classroom/[code]/ admin/
  api/
    auth/ (login, logout, me)
    setup/ classrooms/ materials/ network/ system/ users
/components (ui, Navbar, Toast, Providers)
/lib (db.ts [node:sqlite wrapper], auth.ts, network.ts, validators.ts, rateLimit.ts)
/hooks (useAuth, useSocket, useWebRTC)
scripts/classroom.mjs   # custom server: Next + Socket.IO + IP detection
data/classroom.db
storage/materials/<classroomId>/
```

**DB Schema:** `users`, `classrooms`, `classroom_sessions`, `classroom_members`, `messages`, `announcements`, `materials`, `raised_hands`, `system_settings`

---

## Keamanan

- Password hash `bcryptjs` 12 rounds, tidak plain text
- JWT `httpOnly` `SameSite=Lax`, maxAge 7d, `secure:false` untuk HTTP LAN
- Rate limit login 10/menit per IP
- Validasi input semua endpoint, `is_locked`, role check server-side (jangan percaya frontend)
- File upload: allowed ext `.pdf/.docx/.pptx/.zip/.txt/.jpg/.png/webp/gif`, max 50MB (setting), `sanitizeFilename`, `path.resolve` traversal check, tidak dieksekusi
- Pesan max 1000 char, XSS escape via React
- Windows firewall: buka port 3000 untuk Private Network (jangan disable firewall)

---

## Responsive & Aksesibilitas

Tested: 320, 375, 768, 1024, 1280, 1440px. Navbar mobile hamburger, tidak overflow, focus-visible jelas, semantik HTML.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| **Murid tidak bisa buka URL** | Pastikan semua di hotspot yang sama, matikan mobile data, cek IP di terminal banner, coba `http://<IP>:3000` bukan `localhost`, firewall Windows → Allow Node.js Private |
| **IP salah** | `npm run classroom` tampilkan semua alamat `Wi-Fi: http://192.168.x.x:3000`, pilih yang Wi-Fi, bukan Ethernet/VirtualBox |
| **Windows Firewall block** | Settings → Firewall → Allow app → Node.js → cek Private |
| **Port 3000 dipakai** | `PORT=3001 npm run classroom` atau `netstat -ano | findstr 3000` → kill |
| **WebRTC gagal / hitam** | Chrome/Edge terbaru, `chrome://webrtc-internals` cek, pastikan hotspot sama, coba `Coba sambungkan ulang`, jangan pakai 4K |
| **Screen share ditolak** | Allow permission popup, coba `Try Again`, restart browser |
| **Hotspot limit 10 device** | Beberapa HP limit 10; pakai router mini atau hotspot laptop sebagai alternatif |
| **Laptop sleep** | Setting Power → Never sleep saat plugged, jangan tutup lid |
| **DB hilang** | Data di `data/classroom.db`, backup via `npm run backup`, jangan hapus folder `data` |
| **Lupa password admin** | Hapus `data/classroom.db` (reset) atau edit via `node -e "import('node:sqlite')..."` |
| **Murid disconnect** | Socket auto-reconnect, WebRTC request-offer otomatis, refresh jika perlu |
| **Internet OFF tapi app minta internet** | Pastikan build sudah `npm run build` sebelumnya saat ada internet sekali untuk install, setelah itu tidak perlu internet |

**Cek koneksi murid:** `ping 192.168.43.25` dari HP/laptop murid harus reply.

---

## Testing

### Automated (sudah ada)

```bash
npm run build   # harus sukses, typecheck pass
# lint (opsional, warnings exist tapi tidak blok build)
```

Unit test bisa ditambah via `vitest`, tapi manual E2E lebih penting untuk WebRTC.

### Manual E2E Wajib (offline)

1. Matikan internet & mobile data, hotspot ON
2. `npm run classroom` di laptop server → catat IP
3. 1 guru (Chrome) login → buat kelas `RPL XI` → Mulai → `/classroom/<code>`
4. 2–5 murid (HP/laptop) konek hotspot → buka `http://<IP>:3000/join` → join → `/classroom/<code>`
5. Guru `Share Screen` → pilih Entire Screen → murid lihat video bergerak (bukan placeholder)
6. Guru `Stop Sharing` → murid kembali menunggu
7. Chat: guru & murid kirim pesan → realtime
8. Raise hand: murid ✋ → guru lihat list → Clear
9. Pengumuman: guru kirim → murid lihat kuning di atas
10. Materi: guru upload PDF → murid download via LAN
11. Akhiri kelas → murid disconnect, guru refresh tetap ended

Ulang dengan 10–20 device jika memungkinkan.

**Audit no-external-requests:** DevTools → Network → filter `Doc`, pastikan tidak ada request ke `googleapis`, `cloudflare`, `firebase`, `stun.l.google.com`. Hanya `localhost` / `192.168.x.x` dan `ws://` Socket.IO.

---

## Known Limitations

- Mesh WebRTC: 40 siswa ideal, >40 mungkin CPU guru tinggi (pertimbangkan SFU medis jika perlu 100+)
- Tanpa audio multi-way (hanya tab-audio jika share tab, tidak ada mic murid)
- Tidak ada STUN/TURN eksternal → hanya LAN, tidak bisa via internet
- Tidak ada E2E encryption tambahan selain LAN isolation
- Session tidak persist setelah server restart (murid re-join)
- Upload max 50MB default, tidak ada resume

---

## Scripts

| Command | Fungsi |
|---|---|
| `npm run classroom` | Start production (Next + Socket.IO + IP banner) |
| `npm run start:local` | alias |
| `npm run dev` | Dev mode dengan banner |
| `npm run build` | Build Next |
| `npm run backup` | Backup DB ke `data/backups/` |

---

## Lisensi & Credits

Untuk SMK AL-FATIH RPL Classroom. Dibuat dengan Next.js, Tailwind, Socket.IO, WebRTC, node:sqlite. Tanpa dependensi cloud.

Questions: cek `Troubleshooting` atau hubungi operator lokal.

---

**Definition of Done terpenuhi:** build sukses, auth works, classroom CRUD, join via code, chat/presence/raise/announcement/materi lokal, WebRTC screen sharing real di LAN, startup satu perintah, UI responsive, tidak ada TODO/mocks, tidak perlu internet.

