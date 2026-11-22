# 🐻 GrizzlySMS Telegram Bot (Vercel Serverless)

Bot Telegram untuk order nomor virtual & menerima SMS OTP dari **GrizzlySMS**, berjalan **100% gratis 24/7 di Vercel** menggunakan **Telegram Webhook** — **tanpa VPS, tanpa database berbayar, dan zero dependencies**.

## ✨ Fitur

- **Menu Interaktif (Inline Keyboard)**: pilih layanan populer → lihat harga real-time per negara → **pilih operator** (`telkomsel`, `indosat`, `axis`, `xl`, dll. atau *Any*) → **pilih jumlah nomor (1, 2, 3, 5, 10 sekaligus)** → order langsung.
- **Order Massal (> 1 nomor)**: bisa lewat tombol (`Beli 2`, `Beli 3`, `Beli 5`, `Beli 10`) atau command `/order wa 6 5` / `/order wa 6 telkomsel 5`.
- **Auto-Cancel Otomatis (310 detik) — Tanpa Database!**: langsung mengecek daftar nomor aktif dari API GrizzlySMS (`getActiveActivations`). Jika OTP belum masuk selama **310 detik**, nomor otomatis dibatalkan & saldo di-refund, lalu mengirim notifikasi ke Telegram kamu.
- **Command Lengkap**: `/order`, `/active`, `/operators`, `/price`, `/balance`, `/status`, `/retry`, `/finish`, `/cancel`.
- **Keamanan Berlapis**: Whitelist Telegram User ID (`ALLOWED_USER_IDS`) + verifikasi `WEBHOOK_SECRET`.
- **Zero Dependencies**: pure Node.js (ESM) dengan `fetch` bawaan, cold start sangat cepat di Vercel.

---

## 🚀 Cara Deploy ke Vercel (100% Gratis & Jalan Terus)

### 1. Siapkan Token & API Key
1. Buat bot baru di Telegram via **@BotFather** (`/newbot`) dan simpan `TELEGRAM_BOT_TOKEN`.
2. Ambil API Key akun kamu di dashboard **GrizzlySMS** (`GRIZZLY_API_KEY`).
3. Cek Telegram User ID kamu lewat **@userinfobot** (untuk `ALLOWED_USER_IDS`).

### 2. Upload ke GitHub & Deploy di Vercel
1. Upload/push isi folder project ini ke repository GitHub kamu.
2. Buka [vercel.com](https://vercel.com), klik **Add New Project**, lalu import repository tersebut.
3. Di menu **Environment Variables**, tambahkan:
   - `TELEGRAM_BOT_TOKEN` = token dari @BotFather
   - `GRIZZLY_API_KEY` = API key GrizzlySMS kamu
   - `ALLOWED_USER_IDS` = Telegram User ID kamu (pisahkan koma jika lebih dari 1)
   - `WEBHOOK_SECRET` = teks acak rahasia (misal `grizzly_rahasia_2026`)
   - `AUTO_CANCEL_SECONDS` = `310` *(opsional, default 310)*
   - `MAX_ORDER_QTY` = `10` *(opsional, default 10)*
4. Klik **Deploy**. Kamu akan mendapat URL seperti `https://nama-bot-kamu.vercel.app`.

### 3. Aktifkan Webhook Telegram (Sekali Saja)
Buka URL berikut di browser:

```text
https://nama-bot-kamu.vercel.app/api/setup?secret=grizzly_rahasia_2026
```

Jika muncul `"ok": true`, bot langsung aktif! Ketik `/start` di Telegram.

### 4. Aktifkan Auto-Cancel 310 Detik Otomatis (100% Gratis, Tanpa Database)
Agar nomor yang tidak menerima OTP selama 310 detik otomatis di-cancel di background tanpa kamu klik tombol apapun:
1. Daftar gratis di [cron-job.org](https://cron-job.org) (tidak perlu kartu kredit).
2. Klik **Create Cronjob**:
   - **URL**: `https://nama-bot-kamu.vercel.app/api/cron-autocancel?secret=grizzly_rahasia_2026`
   - **Schedule**: *Every 1 minute* (`* * * * *`).
3. Simpan! Setiap 1 menit endpoint tersebut mengecek order aktif langsung ke GrizzlySMS, dan otomatis cancel + refund nomor yang sudah ≥ 310 detik tanpa OTP.

*(Catatan: Tanpa cron pun, bot tetap otomatis membatalkan nomor jika kamu klik tombol `🔄 Cek OTP` setelah lewat 310 detik.)*

---

## 🧪 Menjalankan Test Lokal

```bash
npm test
```
