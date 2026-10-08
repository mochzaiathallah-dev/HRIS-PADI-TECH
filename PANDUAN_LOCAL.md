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

### Langkah A: Instal Dependensi
```powershell
npm install
```

### Langkah B: Periksa File `.env`
Pastikan file `.env` telah ada di root direktori dengan konfigurasi:
```env
VITE_SUPABASE_URL=https://zusbjxtfwzymjfdbewst.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1c2JqeHRmd3p5bWpmZGJld3N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzQ3NDIsImV4cCI6MjEwNzAxMDc0Mn0.0p1r3qgDqAYTj6Q7p3Q86XqEbeUZVWJ1PGfJfPIWIPY
```

### Langkah C: Jalankan Server Pengembangan
```powershell
npm run dev
```

Buka browser Anda dan akses: **`http://localhost:5173`**

---

## 👑 3. Akun Utama (Owner) & Pendaftaran Karyawan

### Akun Owner Pertama (Dibuat di Supabase):
1. Buka [Supabase Dashboard > Authentication > Users](https://supabase.com/dashboard/project/zusbjxtfwzymjfdbewst/auth/users).
2. Klik **"Add User"** ➔ **"Create User"**:
   - **Email:** `owner@paditech.com`
   - **Password:** `password123`
   - Centang **Auto Confirm User**
   - **User Metadata (JSON):** `{"nama": "Pak Budi (Owner)", "role": "owner"}`
3. Klik **"Create User"**.

### Pendaftaran Karyawan Oleh Owner (Langsung di Aplikasi):
Setelah login sebagai Owner di `http://localhost:5173`, Owner dapat:
- Menekan tombol **"+ Daftarkan Karyawan"** di dashboard.
- Memasukkan Nama, Email, Password Awal, dan memilih role: **Tutor Bimbel** atau **Host TikTok Live**.
- Mengubah/Mereset kata sandi karyawan jika karyawan lupa sandi melalui tombol **"Ganti Kata Sandi"** pada tab *Manajemen Karyawan*.

---

## 🖥️ 4. Tiga Dashboard Khusus Sesuai Peran

Sistem secara otomatis mengarahkan pengguna ke dashboard khusus sesuai perannya:

| Peran | Halaman URL | Fitur Utama |
| :--- | :--- | :--- |
| **Owner** | `/dashboard` | • Executive KPI (Total GMV, Sesi, Jam Live, Views)<br>• Grafik Recharts Realtime (Area, Pie, Bar)<br>• Tabel Bimbel & TikTok + Ekspor CSV<br>• **Generate PDF Laporan Siswa (Format Resmi)**<br>• **Manajemen Karyawan (Tambah Akun & Reset Sandi)** |
| **Tutor Bimbel** | `/dashboard-tutor` | • Input Sesi Mengajar & Siswa Binaan<br>• Quick Subject Pills (Matematika, IPA, B. Inggris, dll)<br>• Riwayat Sesi Mengajar Terkirim |
| **Host TikTok Live** | `/dashboard-host` | • Input Durasi, Impresi & GMV (Format IDR Otomatis)<br>• **Kompresi Otomatis Foto Bukti (WebP - Hemat Kuota 90%)**<br>• Riwayat Live & Bukti Terunggah |

---

## 🧪 5. Skenario Pengujian Fitur (Testing Flow)

### 🔹 Skenario 1: Owner Mendaftarkan Karyawan Baru
1. Buka `http://localhost:5173/login` dan masuk dengan akun Owner (`owner@paditech.com` / `password123`).
2. Klik tombol **"+ Daftarkan Karyawan"** di kanan atas.
3. Pilih role **Tutor Bimbel**, isi Nama `Nikita Khoirunnisa`, Email `nikita@paditech.com`, Sandi `tutor123`.
4. Klik **"Daftarkan Karyawan"**. Akun langsung aktif dan muncul di daftar tabel karyawan.

---

### 🔹 Skenario 2: Tutor Login & Input Sesi Bimbel
1. Buka tab baru / mode incognito di `http://localhost:5173/login`.
2. Login dengan akun Tutor yang baru dibuat (`nikita@paditech.com` / `tutor123`).
3. Sistem otomatis mengarahkan ke **`/dashboard-tutor`**.
4. Isi data sesi (Pilih Murid *Ahmad Fauzan*, Mata Pelajaran *Matematika*, Topik *Operasi Hitung Pecahan*).
5. Klik **"Kirim Laporan Bimbel"**. Data langsung tersimpan ke Supabase.

---

### 🔹 Skenario 3: Host Login & Upload Bukti GMV Terkompresi
1. Login dengan akun Host TikTok di `http://localhost:5173/login`.
2. Sistem otomatis mengarahkan ke **`/dashboard-host`**.
3. Masukkan Durasi (contoh: *120 Menit*) dan GMV (contoh: `8500000` ➔ otomatis `Rp 8.500.000`).
4. Pilih file foto screenshot GMV ➔ Sistem otomatis mengompresi foto ke format **WebP** dengan penghematan ukuran >85%.
5. Klik **"Kirim Laporan TikTok Live"**. Foto terunggah ke Supabase Storage `bukti_tiktok`.

---

### 🔹 Skenario 4: Realtime WebSocket & Update Otomatis di Layar Owner
1. Buka 2 jendela berdampingan (Jendela 1: Owner di `/dashboard`, Jendela 2: Tutor/Host di `/dashboard-tutor` atau `/dashboard-host`).
2. Saat Tutor/Host menekan tombol kirim laporan di Jendela 2, layar Owner di Jendela 1 akan menampilkan banner notifikasi hijau dan metrik/grafik langsung bertambah seketika **tanpa perlu me-refresh halaman!**

---

### 🔹 Skenario 5: Cetak PDF Laporan Belajar Siswa (Format Resmi)
1. Di Dashboard Owner (`/dashboard`), klik tombol **"Generate PDF Laporan Siswa"** atau tombol **"PDF"** pada baris murid di tabel.
2. Modal akan menampilkan data siswa dan ringkasan sesi belajar bulan tersebut.
3. Klik **"Unduh Laporan PDF"**.
4. Buka dokumen PDF untuk melihat tampilan layout resmi:
   - Header Box: *Nama Siswa, Kelas, Tutor, Periode Laporan*.
   - Tabel *Ringkasan Kegiatan Belajar* (*No, Tanggal, Mapel, Topik, Bullet Points*).
   - Box *Perkembangan Belajar*.
   - Footer penomoran halaman otomatis.

---

### 🔹 Skenario 6: Owner Mereset Kata Sandi Karyawan
1. Di Dashboard Owner, buka tab **"👥 Manajemen Karyawan"**.
2. Klik tombol **"Ganti Kata Sandi"** pada baris karyawan yang lupa sandi.
3. Masukkan kata sandi baru (min. 6 karakter) ➔ Klik **"Simpan Sandi Baru"**.
4. Karyawan dapat langsung login menggunakan kata sandi yang baru tersebut.

---

## 🛠️ 6. Perintah Berguna

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server lokal (*Hot Module Replacement*) |
| `npm run build` | Menguji kompilasi produksi TypeScript & Vite bundle (*Zero Error*) |
| `npm run preview` | Menjalankan preview lokal dari hasil build folder `dist/` |
