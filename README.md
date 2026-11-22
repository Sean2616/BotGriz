# 🐻 GrizzlySMS Telegram Bot (Vercel Serverless)

Bot Telegram untuk order nomor virtual & menerima SMS OTP dari **GrizzlySMS**, dirancang khusus agar berjalan **24/7 gratis di Vercel** menggunakan **Telegram Webhook** (tanpa perlu VPS dan tanpa dependencies berat).

## ✨ Fitur

- **Menu Interaktif (Inline Keyboard)**: pilih layanan populer -> lihat harga real-time per negara -> konfirmasi & order langsung.
- **Command Cepat**: `/order <service> <country> [maxPrice]`, `/price <service> <country>`, `/balance`, `/status <id>`, `/retry <id>`, `/finish <id>`, `/cancel <id>`.
- **Kontrol Order Langsung di Pesan**: tombol `🔄 Cek OTP`, `📩 Minta SMS Lagi`, `✅ Selesai`, dan `❌ Cancel (Refund)`.
- **Keamanan Berlapis**:
  - Whitelist Telegram User ID (`ALLOWED_USER_IDS`) agar saldo GrizzlySMS tidak bisa dipakai orang lain.
  - Verifikasi `X-Telegram-Bot-Api-Secret-Token` (`WEBHOOK_SECRET`).
- **Zero Dependencies**: pure Node.js (ESM) dengan `fetch` bawaan, cold start sangat cepat di Vercel.

---

## 🚀 Cara Deploy ke Vercel (Gratis & Jalan Terus)

### 1. Siapkan Token & API Key
1. Buat bot baru di Telegram via **@BotFather** (`/newbot`) dan simpan `TELEGRAM_BOT_TOKEN`.
2. Ambil API Key akun kamu di dashboard **GrizzlySMS** (`GRIZZLY_API_KEY`).
3. Cek Telegram User ID kamu lewat **@userinfobot** (untuk `ALLOWED_USER_IDS`).

### 2. Upload ke GitHub & Deploy di Vercel
1. Push folder project ini ke repository GitHub (boleh **Private**).
2. Buka [vercel.com](https://vercel.com), klik **Add New Project**, lalu import repository tersebut.
3. Di menu **Environment Variables**, tambahkan:
   - `TELEGRAM_BOT_TOKEN` = token dari @BotFather
   - `GRIZZLY_API_KEY` = API key GrizzlySMS kamu
   - `ALLOWED_USER_IDS` = Telegram User ID kamu (pisahkan koma jika lebih dari 1, misal `123456,789012`)
   - `WEBHOOK_SECRET` = teks acak rahasia (misal `grizzly_rahasia_2026`)
4. Klik **Deploy** dan tunggu sampai selesai. Kamu akan mendapat URL seperti `https://nama-bot-kamu.vercel.app`.

### 3. Aktifkan Webhook Telegram (Sekali Saja)
Buka URL berikut di browser (ganti sesuai domain Vercel & `WEBHOOK_SECRET` kamu):

```text
https://nama-bot-kamu.vercel.app/api/setup?secret=grizzly_rahasia_2026
```

Jika muncul respons:
```json
{ "ok": true, "message": "Webhook & daftar command bot berhasil didaftarkan!" }
```
Berarti bot sudah aktif 24/7! Langsung buka bot kamu di Telegram dan ketik `/start`.

---

## 🧪 Menjalankan Test Lokal

```bash
npm test
```

## 📌 Catatan Penting (Arsitektur Vercel)
Karena Vercel menggunakan **Serverless Functions** (stateless, timeout 10 detik di plan Hobby), bot tidak melakukan polling background terus-menerus untuk menunggu OTP. Sebagai gantinya, setelah nomor didapat, cukup tekan tombol **`🔄 Cek OTP`** di pesan order kapan saja SMS sudah dikirim.
