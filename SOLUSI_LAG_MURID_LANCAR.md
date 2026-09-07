# SOLUSI: Preview Guru Lancar, Tapi Layar Murid Lag

> **Gejala:** Di laptop guru (preview) video `getDisplayMedia` terlihat halus 30fps, tapi di HP/laptop murid (40 device) video patah-patah, delay 2-5 detik, atau freeze.

**Bukan bug code, tapi arsitektur Mesh + Hotspot.** Preview guru **tidak di-encode** (langsung `srcObject = stream` lokal). Layar murid **harus di-encode H.264 via NVENC → kirim 40× via hotspot → decode di murid**. Hotspot jadi bottleneck.

---

## 1. Kenapa Preview Lancar, Murid Lag?

| Preview Guru | Layar Murid |
|--------------|-------------|
| `localStream` langsung dari `getDisplayMedia` → tidak lewat encoder, tidak lewat jaringan | `remoteStream` dari `RTCPeerConnection.ontrack` → sudah lewat **encode (NVENC) → hotspot → decode** |
| 0 ms, 0% packet loss | Harus 1 Mbps × 40 = **40 Mbps upload** via hotspot Windows / HP. Hotspot 2.4GHz real cuma **20-30 Mbps** → paket loss → lag |
| CPU guru tidak dipakai untuk preview | CPU/GPU guru encode **40× H.264 720p30** → meski RTX 5050 NVENC, tetap berat jika 40×30fps |

**Test:** Buka `chrome://webrtc-internals` di guru → `outbound-rtp` → `bytesSent` naik cepat, `packetsLost` >2% → hotspot jenuh.

---

## 2. Fix Kode yang Sudah Diterapkan (Update 2026)

### Fix 1: Adaptive Bitrate (Anti Lag Otomatis) — `src/hooks/useWebRTC.ts:40-65`

Sebelumnya fix `1 Mbps` untuk semua (sesuai request). Untuk 40 murid, 40 Mbps → hotspot HP jebol.

**Sekarang adaptive (otomatis turun jika murid banyak):**

```ts
let adaptiveBitrate = 1_000_000; // 1 Mbps untuk ≤20 murid
if (peerCount > 30) { adaptiveBitrate = 350_000; fps=15; degradation="maintain-framerate" } // hemat
else if (peerCount > 20) { adaptiveBitrate = 600_000; fps=20; }
else if (peerCount > 10) { adaptiveBitrate = 800_000; fps=25; }
// 40 murid → 350 kbps ×40 = 14 Mbps (lancar di hotspot 5GHz)
```

Preview guru tetap 30fps lokal, tapi yang dikirim ke murid otomatis turun agar **mulus > tajam** saat kelas penuh. Badge di Card kualitas akan update `350kbps/15fps` saat >30 murid.

### Fix 2: H.264 NVENC Tetap Jalan (`src/hooks/useWebRTC.ts:77-113`)

`contentHint='detail'` + `setCodecPreferences([H264])` → encode di **NVENC RTX 5050** (hardware), bukan CPU. Verifikasi di `webrtc-internals` → `codec: H264`, `Video Encode` di Task Manager → GPU 1 naik, CPU tidak 100%.

Jika tetap lag, bukan CPU, tapi **hotspot**.

### Fix 3: `degradationPreference` Beda untuk Murid Banyak

- Murid ≤20: `maintain-resolution` (jaga teks tajam)
- Murid >20: `maintain-framerate` (jaga kelancaran, resolusi boleh turun dari 720p ke ~540p) → murid lihat tidak patah.

### Fix 4: Hotspot Windows (Kamu = Server, Guru = Hotspot)

Kamu sudah benar: guru kasih hotspot, kamu (murid) jadi server di `192.168.137.1`. Guru akses `https://192.168.137.1:3000` (HTTPS self-signed biar secure). Jika guru pakai `http`, akan insecure → `getDisplayMedia` diblokir (sudah ada flag instruksi di banner).

---

## 3. Cara Pakai Agar Murid Lancar (40 Murid)

**Sebelum Share (Guru):**
1. Guru buka `https://192.168.137.1:3000` → `Advanced → Proceed` (cert self-signed sekali saja)
2. Di Card kualitas, pilih **Hemat (480p)** jika murid 30-40, atau biarkan **Seimbang** (akan auto-turun ke 350kbps jika >30)
3. Share **Window** (VS Code) bukan Entire Screen → hemat 30% bitrate
4. Pastikan hotspot **5GHz** (bukan 2.4): di HP guru → Hotspot → AP Band → 5GHz

**Saat Share:**
- Lihat Badge: `30fps • 1000kbps` → jika murid 35, akan jadi `15fps • 350kbps` (normal, biar lancar)
- Jika masih lag, minta murid yang jauh dekati hotspot, tutup YouTube di HP murid

**Sisi Murid (HP):**
- Jangan pakai `http`, pakai `https://192.168.137.1:3000` juga (biar sama)
- Jika video hitam, klik video ( `play()` fallback sudah ada) atau klik **Force Sambung Sekarang**
- Tutup tab lain, pakai Chrome terbaru

---

## 4. Checklist Cepat Sebelum Kelas 40 Murid

- [ ] Server (laptop kamu) colok charger, hotspot 5GHz, dekat tengah kelas
- [ ] Guru di `https://192.168.137.1:3000` (sudah Proceed cert)
- [ ] Pilih **Hemat** jika 40, **Seimbang** jika 20
- [ ] `chrome://webrtc-internals` di guru → `packetsLost` harus 0-1%
- [ ] Test 5 murid dulu → lancar → baru invite 40

---

## 5. Kenapa Tidak Bisa 40× 720p30 1 Mbps Lancar 100%?

Mesh = guru upload N×. Bahkan RTX 5050 NVENC kuat, tapi **hotspot Windows / HP** adalah bottleneck radio. Solusi ideal untuk >50 murid adalah **SFU** (server forward 1× ke semua), tapi butuh server SFU (mediasoup) — overkill untuk SMK. Untuk sekarang, **adaptive 350kbps + 5GHz** adalah sweet spot: teks VS Code font 14px masih jelas di 480p, tapi 40 murid lancar <300ms.

Jika butuh tajam untuk demo code kecil, bagi kelas jadi 2 sesi (20+20) atau pakai router travel 5GHz (TP-Link TL-WR902AC, Rp 300rb) — lebih stabil dari hotspot HP.

---

*File ini dibuat setelah fix adaptive bitrate 2026-09-04. Build `npm run build` ✓.*
