# HRIS PADI TECH

Sistem HRIS dan POS Operasional berbasis Web (Single Page Application) untuk UMKM yang mengelola divisi **Bimbingan Belajar** dan **Live Commerce TikTok**. Dibangun dengan arsitektur **Zero Vercel Compute** (Vite + React murni di sisi klien) yang terhubung langsung ke **Supabase PostgreSQL** via PostgREST & WebSocket Realtime.

---

## 🚀 Fitur Utama

- **Role-Based Authentication:** Proteksi rute berbasis peran (Owner, Tutor Bimbel, Host TikTok).
- **Modul Bimbingan Belajar (CRUD):** Pencatatan sesi, nama siswa, mata pelajaran, materi/topik, dan ringkasan pembelajaran.
- **Modul TikTok Live Commerce (CRUD):** Pencatatan durasi live, GMV Rupiah, tayangan, impresi, dan bukti screenshot.
- **Client-Side Image Compression:** Kompresi foto bukti otomatis di browser (WebP) sebelum diunggah ke Supabase Storage, menghemat kuota internet dan storage hingga 90%.
- **Realtime Owner Dashboard:** Visualisasi metrik interaktif (Recharts) yang ter-update otomatis secara realtime tanpa refresh melalui Supabase Realtime Channel WebSocket.
- **Ekspor Data Sisi Klien:**
  - **Ekspor CSV:** Menggunakan PapaParse untuk rekapitulasi data Bimbel dan TikTok Live.
  - **Ekspor PDF Laporan Belajar Siswa:** Format resmi bulanan (Header info, tabel kegiatan dengan bullet points, box perkembangan belajar, dan penomoran halaman) siap kirim ke wali murid.
- **Database Anti-Pause:** Otomatisasi `pg_cron` internal PostgreSQL untuk menjaga database tetap aktif (*prevent 7-day auto-pause*).

---

## 🛠️ Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS + Shadcn UI + Lucide Icons
- **Backend & Database:** Supabase (PostgreSQL + PostgREST + Storage + Realtime WebSocket)
- **Security:** PostgreSQL Row Level Security (RLS)
- **State & Routing:** React Context API + React Router DOM v7
- **Form & Validation:** React Hook Form + Zod
- **Data Visualization:** Recharts
- **Exporting Tools:** jsPDF + jspdf-autotable + PapaParse
- **Hosting:** Vercel (Static CDN Edge Delivery - Zero Serverless Invocations)

---

## ⚙️ Persiapan & Menjalankan Proyek

### 1. Klon Repositori & Instal Dependensi
```bash
git clone https://github.com/mochzaiathallah-dev/HRIS-PADI-TECH.git
cd HRIS-PADI-TECH
npm install
```

### 2. Konfigurasi Environment Variables
Salin `.env.example` menjadi `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 3. Skema Database Supabase
Jalankan skrip SQL yang ada pada file `supabase/schema.sql` di **Supabase SQL Editor**.

### 4. Jalankan Server Pengembangan
```bash
npm run dev
```

### 5. Build Produksi
```bash
npm run build
```

---

## 📄 Lisensi
Hak Cipta © 2026 PADI TECH. Dikembangkan untuk efisiensi operasional UMKM.
