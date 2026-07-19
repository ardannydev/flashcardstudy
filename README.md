FlashCardStudy — README

Deskripsi

FlashCardStudy adalah aplikasi web sederhana untuk membuat dan belajar flashcard secara lokal di browser. Aplikasi ini menggunakan storage lokal (localStorage) untuk menyimpan set dan metadata review, dan bisa dijalankan langsung dengan membuka file HTML di browser atau melalui server static sederhana.

Fitur utama

- Halaman utama (index.html): daftar set, preview istilah, tombol untuk membuat/edit/hapus set.
- Buat set (create.html): buat atau edit set berisi istilah dan arti.
- Pelajari (learn.html): mode pembelajaran bergaya kuis/choices (dengan integrasi SM-2 dasar untuk penjadwalan ulang).
- Flashcard (flashcard.html): tampilan kartu bergaya geser dan flip.
- Spaced Repetition (SM-2): implementasi sederhana yang menyimpan metadata per istilah (_review) dan memperbarui due date ketika menjawab.
- Aksesibilitas: elemen interaktif dilengkapi atribut ARIA dasar dan dukungan keyboard (Enter / Space), serta pengumuman via aria-live.

Penyimpanan

- Semua data disimpan di localStorage dengan kunci: qz_sets_v1
- Struktur set (ringkasan):
  {
    id, title, desc, terms: [ { id, term, def, _review? }, ... ], updatedAt
  }
- Metadata SM-2 per term disimpan di term._review = { reps, ease, interval, last, due }

- Berkas penting:
  - index.html — beranda / daftar set
  - create.html — halaman pembuatan set
  - learn.html — mode belajar (kuis)
  - flashcard.html — mode flashcard
  - app.js — helper storage, SM-2, utilitas bersama
  - style.css — styling terpusat

- Jika ingin mereset semua data: buka DevTools -> Application -> localStorage -> hapus kunci qz_sets_v1.
- SM-2 yang digunakan saat ini bersifat sederhana: kualitas jawaban masih dipetakan biner (benar -> quality 5, salah -> quality 2). Ini bisa diperluas menjadi rating 0–5 oleh pengguna agar penjadwalan lebih akurat.

Perubahan yang sudah dilakukan V1.2 (last 19/07/2026)
- Memindahkan beberapa CSS dari file HTML ke style.css untuk konsistensi tema gelap.
- Menambahkan dukungan SM-2 dan inisialisasi metadata saat menyimpan set.
- Menambahkan beberapa perbaikan aksesibilitas (ARIA, keyboard handlers) — beberapa style fokus disesuaikan atas permintaan.
- Menambahkan logo konsisten di index.html dan flashcard.html (HTML-only, tanpa mengubah style.css).

Perubahan V1.3 — Login akun & penyimpanan di Vercel (20/07/2026)
- Ditambahkan halaman login.html (form Masuk & Daftar) sebagai gerbang masuk aplikasi.
- Semua halaman (index.html, sets.html, create.html, learn.html, flashcard.html) sekarang mewajibkan login
  (requireLogin() di app.js) — kalau belum login, otomatis diarahkan ke login.html.
- Data set setiap pengguna kini disinkronkan ke server lewat Vercel Serverless Functions + Vercel KV,
  sehingga data tidak lagi hanya tersimpan di localStorage satu browser, melainkan tersimpan per-akun
  di server dan bisa diakses dari perangkat lain selama login dengan akun yang sama.
- localStorage tetap dipakai sebagai cache lokal (agar halaman tetap cepat & tetap bisa dibaca secara
  sinkron seperti sebelumnya), tapi setiap kali data disimpan (saveSets()), datanya juga otomatis
  dikirim ke server (pushSetsToServer()). Saat halaman dibuka, data terbaru ditarik dulu dari server
  (syncSetsFromServer()) sebelum ditampilkan.
- Password pengguna di-hash pakai scrypt (Node crypto) + salt unik per akun — password asli tidak pernah
  disimpan. Sesi login memakai token sederhana (HMAC-signed) yang disimpan di localStorage.

Struktur backend (folder /api, dijalankan sebagai Vercel Serverless Functions):
  - api/register.js — mendaftarkan akun baru (username + password), menyimpan user ke Vercel KV.
  - api/login.js     — memverifikasi username + password, mengembalikan token sesi.
  - api/sets.js       — GET untuk mengambil semua set milik akun yang sedang login,
                        PUT untuk menyimpan/menimpa seluruh data set milik akun tersebut.
  - api/_lib/auth.js  — helper hashing password (scrypt) dan pembuatan/verifikasi token.

Cara deploy ke Vercel
  1. Push seluruh folder proyek ini (termasuk package.json, vercel.json, dan folder api/) ke repo Git
     (GitHub/GitLab/Bitbucket), lalu import repo tersebut di dashboard Vercel (vercel.com) → "New Project".
  2. Aktifkan Vercel KV untuk proyek ini: buka tab "Storage" pada proyek di dashboard Vercel →
     "Create Database" → pilih "KV" → hubungkan (connect) ke proyek ini. Vercel akan otomatis
     menambahkan environment variables KV_REST_API_URL, KV_REST_API_TOKEN, dsb ke proyek.
  3. (Opsional tapi disarankan) Tambahkan environment variable AUTH_SECRET dengan nilai string acak
     yang panjang & rahasia (Project Settings → Environment Variables). Ini dipakai untuk menandatangani
     token login. Kalau tidak diisi, dipakai nilai default yang KURANG AMAN untuk produksi.
  4. Deploy. Vercel akan otomatis mendeteksi folder /api sebagai Serverless Functions
     (berkat konfigurasi di vercel.json) dan menyajikan file-file HTML/CSS/JS statis lainnya sebagai situs.
  5. Buka domain hasil deploy → akan diarahkan otomatis untuk login/daftar akun sebelum bisa memakai aplikasi.

Catatan keamanan & batasan
  - Reset data per-akun sekarang dilakukan lewat dashboard Vercel KV (bukan lagi lewat DevTools
    localStorage, karena localStorage hanya cache lokal).
  - Setiap akun hanya bisa membaca/menulis data set miliknya sendiri (dibatasi lewat token & key
    `sets:{username}` di KV), tidak bisa mengakses data akun lain.
  - Untuk pemakaian lokal tanpa Vercel (mis. buka file HTML langsung di browser), panggilan ke /api/*
    akan gagal — dalam kasus ini aplikasi tetap mencoba memakai data lokal (localStorage) sebagai
    fallback, tapi fitur login tetap wajib dilewati dulu (perlu dijalankan lewat `vercel dev` atau
    sudah ter-deploy agar endpoint /api tersedia).

created with love by ardwannyy