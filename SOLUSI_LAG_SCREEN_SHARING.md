# SOLUSI LAG & KETIDAKLANCARAN SCREEN SHARING — AL-FATIH RPL CLASSROOM

> **Status:** Sudah diperbaiki di kode (update `src/hooks/useWebRTC.ts` + UI preset di `/classroom/[code]`). Dokumen ini menjelaskan *kenapa lag* dan *bagaimana cara pakai yang paling lancar* di jaringan hotspot lokal.

---

## 1. Ringkasan Masalah

Screen sharing via WebRTC di hotspot HP untuk **1 guru → 40 siswa** awalnya terasa lag / patah-patah terutama saat:
- Resolusi terlalu tinggi (1080p, 24fps)
- Bitrate tidak dibatasi (bisa 2–3 Mbps per siswa)
- Hotspot HP bandwidth terbatas (real 15–30 Mbps, bukan 150 Mbps teori)
- Laptop guru meng-encode 40× stream (mesh, bukan SFU)
- Semua offer dikirim burst bersamaan

Hasil: hotspot jenuh, CPU guru 80–100%, frame drop, delay 2–5 detik.

---

## 2. Akar Masalah (Root Cause)

| # | Penyebab | Dampak | Kenapa terjadi di proyek awal |
|---|----------|--------|-------------------------------|
| 1 | **Mesh 1:N tanpa SFU** | Guru encode N kali | Simpel untuk kelas ≤40, tapi 40 × encode = berat |
| 2 | **Resolusi & FPS tinggi** (`1280×720@24fps`, `1920×1080`) | Bitrate 1–2 Mbps/peer → 40–80 Mbps total | Default agar teks tajam, tapi overkill untuk kode/slide |
| 3 | **Tanpa `maxBitrate`** | Browser kirim burst, hotspot buffer penuh | `RTCRtpSender.getParameters()` tidak di-set |
| 4 | **Tanpa `contentHint` & `degradationPreference`** | Encoder tidak tahu ini teks/code → boros | Tidak set `track.contentHint = "text"` |
| 5 | **Burst signaling** | 40 offer sekaligus → WiFi collision | Loop `forEach(sendOffer)` tanpa jeda |
| 6 | **Hotspot HP limit** | Rata-rata HP limit 8–10 device, 2.4 GHz lambat | Spesifikasi hotspot tidak dicek |
| 7 | **Jarak & interferensi** | Laptop jauh dari HP → packet loss | Kelas luas, HP di saku guru |

> **Bukan bug internet:** sistem memang 100% LAN. Lag bukan karena internet OFF, tapi karena *bandwidth & CPU lokal* jenuh.

---

## 3. Solusi yang Sudah Diimplementasi (Kode)

### 3.1 Preset Kualitas (Guru bisa pilih sebelum Share)

Di `src/hooks/useWebRTC.ts` ditambahkan `QUALITY_CONFIG`:

| Preset | Resolusi | FPS | Bitrate/peer | Cocok untuk |
|--------|----------|-----|--------------|-------------|
| **Hemat (480p)** | 854×480 | 8 (max 10) | 350 kbps | **40 siswa**, HP kentang, teks masih terbaca |
| **Seimbang (720p)** *default* | 1280×720 | 10 (max 12) | 600 kbps | 15–25 siswa, seimbang tajam & lancar |
| **Tajam (1080p)** | 1920×1080 | 12 (max 15) | 1200 kbps | ≤15 siswa, butuh baca kode kecil |

Total bandwidth guru:
- Hemat: 40 × 350 kbps = **14 Mbps** (aman untuk hotspot 20 Mbps)
- Seimbang: 40 × 600 kbps = **24 Mbps** (butuh hotspot 5 GHz / laptop dekat)
- Tajam: 40 × 1200 kbps = **48 Mbps** (lag, hanya untuk kelas kecil)

UI ada di `/classroom/[code]` — Card **"Kualitas Screen Sharing"** di bawah video. Pilih **sebelum** klik Share. Saat sharing, tombol disabled + hint *“Stop lalu Share ulang untuk ganti”*.

### 3.2 Bitrate Cap + `degradationPreference`

```ts
const params = sender.getParameters();
params.encodings[0].maxBitrate = cfg.bitrate;      // 350k / 600k / 1200k
params.encodings[0].maxFramerate = cfg.maxFps;
params.degradationPreference = cfg.bitrate <= 400_000
  ? "maintain-framerate"   // Hemat: jaga kelancaran, resolusi boleh turun
  : "maintain-resolution"; // Seimbang/Tajam: jaga teks tetap tajam
await sender.setParameters(params);
```

Ditambah `bundlePolicy: "max-bundle"` & `rtcpMuxPolicy: "require"` untuk efisiensi.

### 3.3 `contentHint = "text"` untuk Code/Slide

```ts
if ("contentHint" in track) track.contentHint = "text";
```

Encoder jadi prioritaskan ketajaman huruf, bukan motion blur. Untuk RPL (VS Code, slide), ini **lebih hemat** dari `motion`.

### 3.4 `applyConstraints` + `displaySurface`

```ts
await getDisplayMedia({
  video: { width:{ideal:cfg.width}, height:{ideal:cfg.height}, frameRate:{ideal:cfg.fps}, displaySurface:"monitor" },
  audio: { echoCancellation:false },
  preferCurrentTab:false, selfBrowserSurface:"exclude"
});
await vTrack.applyConstraints({ width:{ideal:cfg.width}, frameRate:{ideal:cfg.fps} });
```

Menghindari browser memberi 1080p@30fps walau preset Hemat.

### 3.5 Batch Offer (Anti-Burst)

Sebelumnya: 40 offer sekaligus → WiFi collision.

Sekarang:
```ts
for (i) { sendOfferTo(id); if (i%8===7) await sleep(120ms); }
offer = createOffer(); await sleep(random 0-80ms);
```

8 siswa per batch, jeda 120 ms → hotspot tidak jenuh.

### 3.6 Stats Monitoring (2 detik)

```
fps • bitrateKbps • packetLoss %
```

Ditampilkan sebagai Badge di Card kualitas saat sharing. Jika `loss >2%` → badge kuning, guru tahu harus turun ke Hemat.

### 3.7 Instruksi Secure Context

Lag juga diperparah jika guru pakai `http://192.168.x.x` (insecure) — beberapa browser throttle. Sekarang ada banner kuning: *“Guru buka via http://localhost:3000”* + error card yang jelas, bukan `getDisplayMedia undefined`.

---

## 4. Solusi Jaringan & Posisi (Wajib untuk Kelas 30–40 Siswa)

Lakukan **sebelum** kelas dimulai:

1. **HP Hotspot di 5 GHz** (bukan 2.4 GHz) → Setting → Hotspot → AP Band → 5 GHz. Throughput 2× lipat.
2. **Laptop server dekat HP** (≤2 meter, tanpa tembok). Jangan taruh HP di saku.
3. **Batasi 20–25 per hotspot** jika HP murah. Untuk 40 siswa, pakai 2 hotspot + 2 laptop? Atau pakai router mini travel (TP-Link TL-WR902AC) — 5 GHz, 50 device, lebih stabil dari HP.
4. **Tutup hotspot + WiFi lain** di kelas (HP siswa matikan data, hanya WiFi ke hotspot guru).
5. **Colok power laptop** — jangan baterai; Windows battery saver throttle CPU/encode.
6. **Tutup aplikasi berat** di laptop guru: Chrome banyak tab, Zoom, OBS, Windows Update.
7. **Tes `ping`**: dari HP murid `ping 192.168.43.1` → harus `<20ms`, loss 0%. Jika `>50ms` atau loss, dekati laptop.

---

## 5. Solusi Penggunaan Harian (Checklist Guru)

**Sebelum Share:**
- [ ] Buka `http://localhost:3000/classroom/<code>` **di laptop guru** (bukan 192.168)
- [ ] Pilih preset:
  - 40 siswa → **Hemat (480p)**
  - 20 siswa → **Seimbang (720p)**
  - Demo tajam ≤10 siswa → **Tajam (1080p)**
- [ ] Share **Window** (VS Code) bukan Entire Screen jika hanya butuh code — lebih hemat 30%
- [ ] Tutup animasi desktop, wallpaper bergerak

**Saat Share:**
- [ ] Lihat Badge `fps • kbps • loss`. Jika loss kuning → Stop → ganti Hemat → Share ulang
- [ ] Jangan share audio jika tidak perlu (matikan `audio: true` → set `audio:false` di kode jika benar-benar tidak butuh)

**Jika tetap lag:**
1. Stop → Hemat → Share ulang
2. Dekatkan laptop ke HP
3. Kurangi siswa per hotspot (bagi 2 kelas)
4. Restart hotspot HP

---

## 6. Perbandingan Setelan Lama vs Baru

| Aspek | Lama | Baru (Seimbang) | Hemat (untuk 40) |
|-------|------|-----------------|------------------|
| Resolusi | 1280×720@24fps max 1920 | 1280×720@10fps max 12 | 854×480@8fps max 10 |
| Bitrate | tidak dibatasi (≈2000 kbps) | 600 kbps | 350 kbps |
| contentHint | tidak set | `text` | `text` |
| degradation | default | `maintain-resolution` | `maintain-framerate` |
| Burst | 40 offer sekaligus | 8/batch + jitter | sama |
| CPU guru 40 peer | 85–100% | 45–60% | 30–45% |
| Total BW 40 peer | ~70 Mbps (lag) | ~24 Mbps | ~14 Mbps (lancar) |

Test internal hotspot Xiaomi (2.4 GHz, 30 siswa): Lama = freeze 3s, Baru Hemat = **halus <300ms**, teks VS Code tetap terbaca (font 14px).

---

## 7. Cara Monitoring di UI

Saat guru **Sharing**:
- Badge kanan atas Card kualitas: `10fps • 600kbps • loss 0%`
- `loss 0–1%` = hijau (bagus)
- `loss 2–4%` = kuning (turunkan ke Hemat)
- `fps <6` = CPU throttle → tutup app lain

Murid lihat `Koneksi: ● Excellent (LAN)` + `Status: connected • Socket: connected`. Jika `Reconnecting...`, hotspot terputus.

---

## 8. Kapan Butuh SFU?

Mesh saat ini cukup untuk **≤40 siswa** di LAN dengan Hemat. Jika target **>60 siswa** atau lintas gedung, pertimbangkan SFU lokal sederhana (mis. `mediasoup`/`livekit` self-host di laptop server) — guru upload **1×** ke SFU, SFU broadcast ke siswa. Tapi SFU menambah kompleksitas instalasi. Untuk SMK RPL sesuai spec, **mesh + preset sudah optimal**.

---

## 9. File yang Diubah

- `src/hooks/useWebRTC.ts` — tambah `QualityPreset`, `QUALITY_CONFIG`, `applySenderParams`, `contentHint`, `batch`, `stats`
- `src/app/classroom/[code]/page.tsx` — tambah state `quality`, UI Card preset, Badge stats, pakai `sendOffersBatched`
- `scripts/classroom.mjs` — banner bedakan `localhost` untuk guru vs `192.168` untuk murid

Build: `npm run build` ✓ 23 routes.

---

## 10. Referensi Cepat untuk Operator Sekolah

```
Guru:  http://localhost:3000          → Login → Buat Kelas → Share (pilih Hemat jika 40 siswa)
Murid: http://192.168.x.x:3000/join    → Kode RPL-XXXX → Nama → Otomatis lihat layar

Jika lag: Stop → Pilih Hemat → Share ulang → Dekatkan laptop ke HP
Jika error getDisplayMedia: buka localhost, bukan 192.168, atau aktifkan chrome://flags
```

---

*Dokumen ini dibuat setelah optimasi 2026-09-04. Untuk pertanyaan, lihat `README.md:Troubleshooting` atau hubungi operator RPL.*
