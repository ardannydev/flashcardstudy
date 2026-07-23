<div align="center">

# FlashCardStudy

### Belajar lebih konsisten dengan flashcard yang sederhana, cepat, dan terasa personal.

<p>
  <a href="https://flashcardstudy-kohl.vercel.app/"><strong>Live Demo</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#memulai">Cara Memulai</a>
  &nbsp;&middot;&nbsp;
  <a href="#update-terbaru">Update Terbaru</a>
</p>

![Status](https://img.shields.io/badge/status-active-22c55e?style=for-the-badge)
![Version](https://img.shields.io/badge/version-2.0.0-6366f1?style=for-the-badge)
![Built with](https://img.shields.io/badge/built%20with-HTML%20%7C%20CSS%20%7C%20JavaScript-f97316?style=for-the-badge)
![Deploy](https://img.shields.io/badge/deploy-Vercel-111827?style=for-the-badge&logo=vercel)

</div>

<br>

## Tentang Proyek

FlashCardStudy adalah aplikasi belajar berbasis web untuk membuat set flashcard, mengulang materi, dan memantau progres belajar. Aplikasi ini dibuat dengan tampilan yang ringan dan responsif agar nyaman digunakan dari desktop maupun mobile.

Setiap akun memiliki data flashcard sendiri. Data disimpan di Vercel KV dan menggunakan localStorage sebagai cache lokal agar halaman tetap terasa cepat.

## Fitur Utama

| Fitur | Deskripsi |
| --- | --- |
| Manajemen set | Buat, edit, hapus, dan lihat preview istilah dalam satu dashboard. |
| Mode kuis | Belajar dengan pilihan jawaban dan ringkasan hasil di akhir sesi. |
| Mode flashcard | Flip card, swipe, tandai kartu, dan pantau kartu yang sudah dikuasai. |
| Spaced repetition | Penjadwalan review berbasis SM-2 sederhana untuk membantu mengingat lebih lama. |
| Akun pengguna | Register, login, token sesi, dan data set per akun. |
| Sinkronisasi cloud | Data otomatis disinkronkan melalui Vercel Serverless Functions dan Vercel KV. |
| Public share | Endpoint berbagi set flashcard publik dengan rate limiting. |
| Responsive UI | Layout sets, navbar, avatar, dan tombol tetap nyaman di layar mobile. |
| Aksesibilitas | Dukungan keyboard, atribut ARIA, dan pengumuman untuk screen reader. |
| Web app metadata | Manifest dan favicon lokal untuk pengalaman instalasi yang lebih rapi. |

## Update Terbaru

### Juli 2026 - UI, keamanan, dan pengalaman navigasi

- Menambahkan navigasi antarhalaman tanpa reload penuh menggunakan History API.
- Isi halaman tujuan tetap diperbarui saat berpindah menu, termasuk dukungan Back dan Forward browser.
- Menambahkan fallback otomatis ke reload normal jika soft navigation gagal.
- Memperbarui desain halaman Sets dengan grid card yang lebih jelas dan responsif.
- Memperbaiki tombol aksi set agar lebih mudah digunakan di mobile.
- Mengganti avatar eksternal DiceBear menjadi SVG lokal berbasis `data:` URL agar sesuai dengan Content Security Policy.
- Menambahkan avatar unik berbasis username pada navbar, halaman profil, dan sidebar flashcard.
- Menambahkan favicon SVG lokal dan menghilangkan ketergantungan pada `favicon.ico` eksternal.
- Memulihkan mode lokal dengan helper `isLocalMode()` untuk development di localhost dan Live Server.
- Menambahkan header keamanan di `vercel.json`, termasuk CSP, X-Frame-Options, dan Referrer-Policy.
- Menambahkan rate limiting pada endpoint login, register, dan public share.

### Versi 2.0.0 - Akun dan penyimpanan cloud

- Menambahkan halaman login dan register.
- Menyimpan password menggunakan scrypt dengan salt unik.
- Menambahkan token sesi bertanda tangan HMAC.
- Menyinkronkan set flashcard antarperangkat melalui Vercel KV.
- Menambahkan endpoint user, sets, share, login, dan register.

## Tampilan dan Pengalaman

- Tema gelap dengan aksen indigo dan pink.
- Card layout yang menyesuaikan desktop, tablet, dan mobile.
- Transisi navigasi yang terasa lebih halus tanpa menghilangkan fungsi browser.
- Avatar lokal yang tetap tampil meskipun layanan pihak ketiga tidak tersedia.
- Favicon dan manifest yang konsisten dengan identitas FlashCardStudy.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Storage lokal | Browser localStorage |
| Backend | Vercel Serverless Functions |
| Database | Vercel KV |
| Authentication | Node.js crypto, scrypt, HMAC token |
| Testing | Vitest |
| Deployment | Vercel |

## Struktur Proyek

```text
flashcard project/
├── api/
│   ├── _lib/auth.js       # Hash password dan token sesi
│   ├── _lib/ratelimit.js  # Rate limiting endpoint
│   ├── login.js           # Login pengguna
│   ├── register.js        # Registrasi pengguna
│   ├── sets.js            # Sinkronisasi set per akun
│   ├── share.js           # Public share set
│   └── user.js            # Data profil pengguna
├── app.js                 # Helper storage, auth, SM-2, dan router
├── index.html             # Dashboard
├── sets.html              # Daftar set flashcard
├── create.html            # Buat atau edit set
├── learn.html             # Mode kuis
├── flashcard.html         # Mode flashcard
├── profile.html           # Profil pengguna
├── share.html             # Tampilan set publik
├── login.html             # Login dan register
├── style.css              # Styling terpusat
├── manifest.json          # Metadata PWA
├── favicon.svg            # Favicon lokal
├── vercel.json            # Konfigurasi function dan security headers
└── package.json           # Dependency dan script project
```

## Memulai

### Menjalankan secara lokal

```bash
npm install
npx vercel dev
```

Project ini juga dapat dibuka melalui static server, misalnya:

```bash
npx serve .
```

Mode lokal akan aktif pada `localhost`, `127.0.0.1`, `0.0.0.0`, atau port `5500`. Endpoint cloud tetap membutuhkan environment Vercel yang valid.

### Menjalankan test

```bash
npm test
```

### Deploy ke Vercel

1. Push repository ke GitHub.
2. Import repository di Vercel.
3. Hubungkan Vercel KV melalui menu Storage.
4. Tambahkan environment variable berikut di Vercel:

```env
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
AUTH_SECRET=isi-dengan-string-rahasia-yang-panjang
```

5. Deploy dan buka domain Vercel project.

`AUTH_SECRET` sangat disarankan untuk production. Jangan commit nilai rahasia ke repository.

## Data dan Spaced Repetition

Data set menggunakan key localStorage berikut sebagai cache lokal:

```text
qz_sets_v1
```

Setiap term dapat memiliki metadata review:

```js
{
  reps: 0,
  ease: 2.5,
  interval: 0,
  last: 0,
  due: 0
}
```

Implementasi SM-2 saat ini menggunakan pemetaan kualitas jawaban sederhana: jawaban benar memakai quality `5`, sedangkan jawaban salah memakai quality `2`.

## Keamanan

- Password tidak disimpan dalam bentuk plain text.
- Akses set dibatasi berdasarkan token dan username.
- Endpoint penting memiliki rate limiting.
- Content Security Policy membatasi sumber script, gambar, font, dan koneksi.
- Avatar dan favicon tidak bergantung pada request gambar pihak ketiga.
- `AUTH_SECRET` harus diganti dengan nilai rahasia yang kuat sebelum production.

## Kontribusi

1. Fork repository ini.
2. Buat branch fitur baru.
3. Jalankan pengecekan dan test sebelum commit.
4. Buat pull request dengan deskripsi perubahan yang jelas.

## Lisensi

Project ini bersifat private dan dikembangkan untuk kebutuhan FlashCardStudy.

<div align="center">

### Keep learning, one card at a time.

Made by [ardwannyy](https://github.com/ardannydev)

</div>
