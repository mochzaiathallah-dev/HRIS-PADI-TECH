# Security & Protection Layer

Karena aplikasi web ini berkomunikasi langsung dengan *database* tanpa melalui perantara API milik sendiri, keamanan tingkat basis data adalah hal mutlak.

1. **Row Level Security (RLS) Supabase:**
   - Ini adalah benteng utama. Tanpa RLS, siapa pun yang melihat Anon Key di *browser* dapat menghapus *database*.
   - **Policy:** Tutor/Host hanya diizinkan melakukan operasi `INSERT` dan `SELECT` pada data yang memiliki `user_id` mereka sendiri. Owner diizinkan `SELECT` semua data. Operasi `DELETE` dan `UPDATE` dikunci sepenuhnya untuk karyawan operasional.

2. **Perlindungan Environment Variables:**
   - Kunci `service_role` **DILARANG KERAS** dimasukkan ke dalam *repository* Git atau *environment* Vercel. 
   - Vercel hanya menyimpan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.

3. **Perlindungan DDoS & Injection:**
   - *Hosting* statis di Vercel Edge Network kebal terhadap DDoS konvensional karena tidak ada *server* yang merender halaman[cite: 4].
   - PostgREST dari Supabase secara otomatis memblokir SQL Injection melalui *parameterized binding*.

4. **Rate Limiting (Klien & Supabase):**
   - Konfigurasi batas *Auth Rate Limit* di *dashboard* Supabase untuk mencegah serangan *brute force* pada halaman *login*.