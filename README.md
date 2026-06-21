# 🏛️ DPRD Kota Semarang & Pemerintahan Indonesia — Chatbot Backend API

Backend API profesional berbasis **TypeScript** (Bun runtime) untuk chatbot pintar yang difokuskan pada pelayanan informasi seputar **DPRD Kota Semarang** dan **Pemerintahan Republik Indonesia**. 

Sistem ini dirancang sangat tangguh (*robust*) dengan fitur **Dual-Provider AI Fallback** dan siap untuk di-deploy ke lingkungan **Serverless (Vercel)**.

---

## ✨ Fitur Unggulan

1. 🔒 **Kunci Topik Ketat (System Instruction)**
   AI diprogram mutlak untuk HANYA menjawab pertanyaan seputar pemerintahan, legislasi, dan DPRD. Jika pengguna bertanya tentang resep makanan, koding, atau topik lain, AI akan menolaknya dengan sopan.
   
2. 🔄 **Dual-Provider AI dengan Auto-Fallback**
   - **Utama:** Google Gemini 2.5 Flash (Sangat cepat & efisien)
   - **Cadangan (Fallback):** OpenAI GPT-OSS 120B via OpenRouter
   Jika server Gemini mengalami gangguan (misal: Error 503), sistem akan otomatis mengoper pertanyaan ke OpenAI tanpa terjadi *downtime* pada pengguna.

3. ☁️ **Vercel Serverless Ready**
   Arsitektur sudah disesuaikan agar bisa langsung di-deploy ke Vercel hanya dalam 1 kali klik.

4. 🗄️ **Database Terstruktur (PostgreSQL Neon)**
   Memiliki skema database yang menyimpan sesi, riwayat pesan, topik, dan *feedback* pengguna dengan dukungan transaksi data yang aman.

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| **Runtime** | [Bun](https://bun.sh) (Super cepat) |
| **Framework** | Express 5 |
| **Database** | PostgreSQL (Neon DB) |
| **Primary AI** | Google Gemini 2.5 Flash |
| **Backup AI** | OpenAI GPT-OSS 120B (via OpenRouter) |
| **Bahasa** | TypeScript 5 |

---

## 📁 Struktur Proyek

```text
├── api/
│   └── index.ts               # Titik masuk khusus untuk Vercel Serverless
├── src/
│   ├── config/                # Konfigurasi AI, Database, Environment
│   ├── controllers/           # HTTP Request Handlers
│   ├── middlewares/           # Error Handler & Rate Limiter
│   ├── routes/                # Definisi Endpoint API RESTful
│   ├── services/              # Logika Bisnis Utama (AI Prompting & Chat Flow)
│   ├── types/                 # TypeScript Type Definitions
│   ├── utils/                 # Utilities (Logger, dll)
│   └── app.ts                 # Konfigurasi Express.js
├── migrations/
│   └── 001_initial_schema.sql # Skema tabel database PostgreSQL
├── index.ts                   # Titik masuk untuk Development Lokal (Bun)
├── migrate.ts                 # Script untuk menjalankan migrasi database
├── vercel.json                # Konfigurasi perutean Vercel
├── .env                       # Environment Variables (Kredensial API)
├── .env.example               # Template Environment Variables
└── package.json               # Dependensi proyek
```

---

## 🚀 Cara Menjalankan di Lokal (Development)

### 1. Install Dependencies
```bash
bun install
```

### 2. Konfigurasi Kredensial
Salin `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Lalu isi variabel berikut di file `.env`:
- `DATABASE_URL` = URL PostgreSQL (Neon) Anda
- `GEMINI_API_KEY` = Kunci API Google Gemini Anda
- `OPENROUTER_API_KEY` = Kunci API OpenRouter Anda (untuk fallback OpenAI)

### 3. Migrasi Database
Siapkan skema tabel (Hanya perlu dijalankan sekali):
```bash
bun run db:migrate
```

### 4. Jalankan Server
```bash
bun run dev
```
Server akan aktif di `http://localhost:3000`.

---

## ☁️ Panduan Deploy ke Vercel

Proyek ini sudah dilengkapi dengan `api/index.ts` dan `vercel.json` sehingga siap di-deploy ke Vercel tanpa perlu konfigurasi tambahan pada kode.

1. *Push* repositori ini ke GitHub.
2. Buat proyek baru di [Vercel](https://vercel.com) dan hubungkan dengan repositori Anda.
3. Di bagian **Environment Variables** pada dashboard Vercel, masukkan variabel berikut:
   - `DATABASE_URL`
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL` (isi dengan `openai/gpt-oss-120b:free`)
   - `AI_PROVIDER` (isi dengan `auto`)
   - `CORS_ORIGIN` (isi dengan `*` atau URL Frontend Anda nanti)
4. Klik **Deploy**!
5. API Anda sekarang sudah aktif secara global (misal: `https://dprd-backend.vercel.app`).

---

## 📡 API Endpoints

Semua endpoint dilindungi oleh *rate-limiter* bawaan.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/` | Informasi Status API |
| `GET` | `/api/v1/health` | Health check infrastruktur |
| `POST` | `/api/v1/chat/sessions` | Membuat sesi percakapan baru |
| `GET` | `/api/v1/chat/sessions` | Melihat semua sesi (paginasi) |
| `GET` | `/api/v1/chat/sessions/:id` | Mengambil riwayat pesan dalam satu sesi |
| `DELETE` | `/api/v1/chat/sessions/:id` | Menghapus sesi percakapan |
| `POST` | `/api/v1/chat/sessions/:id/messages` | **Mengirim pertanyaan ke AI** |
| `POST` | `/api/v1/chat/messages/:id/feedback` | Memberi penilaian/rating (1-5) ke AI |
| `GET` | `/api/v1/chat/topics` | Melihat daftar kategori topik |

### 💡 Contoh Request (Kirim Pesan)

```bash
curl -X POST http://localhost:3000/api/v1/chat/sessions/{SESSION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Apa tugas DPRD?"}'
```
*Respons akan otomatis menampilkan apakah API menggunakan `gemini` atau `openrouter` di parameter `provider`.*

---

## 📊 Skema Database

Database PostgreSQL (Neon) menggunakan 4 tabel utama:

1. **`topics`** — Kategori percakapan (DPRD, Hukum, Pemilu, dll).
2. **`sessions`** — Data riwayat chat room beserta judul otomatis (*auto-title*).
3. **`messages`** — Menyimpan pertanyaan pengguna dan jawaban AI dengan urutan terstruktur (*sequence number*).
4. **`feedback`** — Tempat pengguna memberikan rating (1-5 bintang) untuk jawaban AI.

---

> Dibuat untuk pelayanan informasi publik **DPRD Kota Semarang** yang transparan dan informatif. 🏛️
