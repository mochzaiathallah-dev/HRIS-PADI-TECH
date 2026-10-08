# 📖 Panduan Menjalankan & Menguji HRIS PADI TECH di Lokal

Panduan lengkap ini menjelaskan langkah demi langkah cara menjalankan, mengonfigurasi, dan menguji seluruh fitur sistem HRIS PADI TECH di komputer lokal Anda.

---

## 📋 1. Prasyarat Sistem

Pastikan komputer Anda telah terpasang:
- **Node.js**: Versi 18.x, 20.x, atau 22.x (Ketik `node -v` di terminal untuk memeriksa).
- **NPM**: Bawaan Node.js (Ketik `npm -v` di terminal).
- **Web Browser Modern**: Google Chrome, Microsoft Edge, Mozilla Firefox, atau Safari.

---

## ⚙️ 2. Langkah Menjalankan Server Lokal

Buka terminal (PowerShell / Command Prompt / Terminal VS Code) di folder proyek `d:\HRIS PADI TECH`, lalu jalankan:

### Langkah A: Instal Dependensi (Jika baru mengklon repositori)
```powershell
npm install
```

### Langkah B: Periksa File `.env`
Pastikan file `.env` telah ada di root direktori dengan isi:
```env
VITE_SUPABASE_URL=https://zusbjxtfwzymjfdbewst.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1c2JqeHRmd3p5bWpmZGJld3N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzQ3NDIsImV4cCI6MjEwNzAxMDc0Mn0.0p1r3qgDqAYTj6Q7p3Q86XqEbeUZVWJ1PGfJfPIWIPY
```

### Langkah C: Jalankan Server Pengembangan
```powershell
npm run dev
```

Terminal akan menampilkan URL lokal:
```text
  VITE v8.3.x  ready in 250 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Buka browser Anda dan akses: **`http://localhost:5173`**

---

## 👥 3. Membuat Akun Uji Coba di Supabase

Untuk menguji fitur multi-peran (*Role-Based Access*), buat 3 akun di dashboard Supabase:

1. Buka [Supabase Dashboard > Authentication > Users](https://supabase.com/dashboard/project/zusbjxtfwzymjfdbewst/auth/users).
2. Klik tombol hijau **"Add User"** ➔ **"Create User"**.
3. Masukkan Email, Password (min. 6 karakter), centang *Auto Confirm User*, dan tambahkan `User Metadata` (JSON):

| Peran | Contoh Email | Password | User Metadata (JSON) | Akses Halaman |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | `owner@paditech.com` | `password123` | `{"nama": "Pak Budi", "role": "owner"}` | `/dashboard` |
| **Tutor Bimbel** | `tutor@paditech.com` | `password123` | `{"nama": "Nikita Khoirunnisa", "role": "tutor"}` | `/input-laporan` |
| **Host TikTok** | `host@paditech.com` | `password123` | `{"nama": "Siti Rahma", "role": "host"}` | `/input-laporan` |

> *Catatan: Trigger PostgreSQL di database akan otomatis menyinkronkan data metadata ini ke tabel `public.users_profile`.*

---

## 🧪 4. Skenario Pengujian Fitur (Testing Flow)

### 🔹 Skenario 1: Pengujian Form Tutor Bimbel
1. Buka `http://localhost:5173/login`.
2. Login dengan akun **Tutor** (`tutor@paditech.com`).
3. Sistem akan otomatis mengarahkan ke tab **Form Bimbel** di `/input-laporan`.
4. Pilih **Tanggal**, pilih **Nama Murid** (contoh: *Ahmad Fauzan*), klik tombol *quick pill* **Mata Pelajaran** (*Matematika*), isi **Topik** (*Operasi Hitung Pecahan*), dan isi **Ringkasan Materi**.
5. Klik **"Kirim Laporan Bimbel"**.
6. Laporan berhasil tersimpan ke Supabase dan langsung muncul di kartu riwayat di bawah form.

---

### 🔹 Skenario 2: Pengujian Form Host TikTok & Kompresi Gambar
1. Di halaman `/input-laporan`, klik tab **Form TikTok Live**.
2. Masukkan **Durasi Live** (contoh: klik tombol *120 Menit*).
3. Masukkan **GMV Penjualan** (contoh: `7500000` ➔ format otomatis menjadi `Rp 7.500.000`).
4. Masukkan **Tayangan** dan **Impresi**.
5. Unggah foto *screenshot* bukti GMV (ukuran 2–5 MB).
6. Perhatikan indikator: Gambar otomatis dikompresi di browser (*client-side*) menjadi **WebP** dengan penghematan ukuran **>80%**.
7. Klik **"Kirim Laporan TikTok Live"**. Foto terunggah ke Supabase Storage `bukti_tiktok` dan data tersimpan ke tabel.

---

### 🔹 Skenario 3: Pengujian Realtime Dashboard Owner (WebSocket)
1. Buka 2 jendela/tab browser berdampingan:
   - **Jendela 1 (Desktop):** Login sebagai **Owner** (`owner@paditech.com`) ➔ buka `/dashboard`.
   - **Jendela 2 (Smartphone/Tab lain):** Login sebagai **Host / Tutor** ➔ buka `/input-laporan`.
2. Di Jendela 2, lakukan submit laporan baru (Bimbel atau TikTok).
3. **Hasil:** Di Jendela 1 (Owner), banner hijau *"Data Baru Terdeteksi Realtime"* akan menyala, angka total GMV, sesi bimbel, grafik tren Recharts, dan tabel data langsung bertambah secara otomatis **tanpa perlu me-refresh halaman browser!**

---

### 🔹 Skenario 4: Pengujian Cetak PDF Laporan Belajar Siswa
1. Di halaman **Owner Dashboard** (`/dashboard`), klik tombol biru **"Generate PDF Laporan Siswa"** di atas atau klik tombol **"PDF"** pada baris siswa di tabel Bimbel.
2. Modal akan muncul dengan data siswa dan sesi yang terdeteksi otomatis.
3. Anda dapat menyesuaikan nama Tutor atau menambahkan catatan evaluasi khusus.
4. Klik **"Unduh Laporan PDF"**.
5. Buka file PDF yang terunduh di komputer Anda. Format dokumen akan persis dengan standar dokumen resmi:
   - Header box (*Nama Siswa, Kelas, Tutor, Periode Laporan*).
   - Tabel *Ringkasan Kegiatan Belajar* dengan *bullet points*.
   - Box *Perkembangan Belajar*.
   - Footer penomoran halaman otomatis.

---

### 🔹 Skenario 5: Pengujian Ekspor CSV
1. Pada tab **Data Laporan Bimbel**, klik tombol **"Ekspor CSV"** ➔ File `.csv` langsung terunduh untuk dibuka di Microsoft Excel / Google Sheets.
2. Pada tab **Data Laporan TikTok**, klik tombol **"Ekspor CSV"** ➔ Rekapitulasi durasi, GMV, dan link bukti terunduh.

---

## 🛠️ 5. Perintah Pengujian Tambahan

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server lokal (*Hot Module Replacement*) |
| `npm run build` | Menguji kompilasi produksi TypeScript & Vite bundle (*Zero Error*) |
| `npm run preview` | Menjalankan preview lokal dari hasil build folder `dist/` |

---

## 🔒 6. Keamanan & Zero Vercel Compute

- Seluruh autentikasi dan kueri data berjalan langsung dari *browser* ke Supabase PostgREST via `@supabase/supabase-js`.
- Tidak ada *serverless functions* atau folder `api/` yang membebani limit hosting Vercel.
- Seluruh hak akses dijamin oleh **Row Level Security (RLS)** PostgreSQL Supabase.
