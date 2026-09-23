# Purrific Frontend

Aplikasi antarmuka pengguna untuk Purrific. Frontend ini dibangun menggunakan React 18, Vite, TypeScript, dan Tailwind CSS. Aplikasi menyediakan antarmuka papan kanban kolaboratif untuk tim dan ruang kerja personal berupa perencana harian serta editor catatan blok ala Notion.

## Kebutuhan sistem

- Node.js versi 18 atau lebih tinggi.
- npm atau package manager yang kompatibel.
- Server backend Purrific yang sedang berjalan (default port 4000).

## Langkah instalasi

1. Masuk ke direktori frontend:

```bash
cd purrific-frontend
```

2. Pasang dependensi proyek:

```bash
npm install
```

3. Buat file konfigurasi lingkungan:

```bash
cp .env.example .env
```

4. Sesuaikan variabel di dalam file `.env`:

```env
# Alamat URL backend API
VITE_API_URL=http://localhost:4000

# Alamat URL server Socket.io
VITE_SOCKET_URL=http://localhost:4000

# Google OAuth Client ID (Opsional, gunakan Client ID yang sama dengan backend jika menggunakan login Google)
VITE_GOOGLE_CLIENT_ID=
```

5. Jalankan server pengembangan:

```bash
npm run dev
```

Aplikasi frontend dapat diakses melalui browser pada `http://localhost:5173`.

## Daftar perintah script

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan server pengembangan Vite dengan modul penggantian panas (HMR). |
| `npm run build` | Menjalankan pemeriksaan tipe antarmuka (`tsc -b`) dan kompilasi bundel produksi (`vite build`). |
| `npm run preview` | Menjalankan server lokal untuk melihat hasil kompilasi produksi di browser. |
| `npm run typecheck` | Memeriksa validitas tipe TypeScript seluruh kode sumber tanpa membuat build (`tsc --noEmit`). |

## Fitur tampilan utama

- Papan kanban tim dengan dukungan drag and drop via `@dnd-kit`, filter pencarian, filter anggota, dan filter prioritas.
- Halaman detail tugas lengkap dengan tab percakapan komentar, riwayat aktivitas, dan pratinjau lampiran.
- Ruang kerja personal berisi daftar aktivitas harian per tanggal, integrasi tugas tim, jam kerja, dan checklist.
- Editor catatan personal berbasis blok dengan menu slash (`/`), pembuatan sub-halaman, dan pilihan gambar sampul.
- Tampilan tabel basis data personal dengan kolom kustom (teks, angka, opsi pilihan, tanggal, centang).
- Pengaturan izin peran per proyek untuk membatasi aksi anggota tim.

## Dokumentasi arsitektur

Untuk penjelasan rinci mengenai arsitektur kode frontend, struktur komponen, sistem routing, dan pengelolaan state, silakan baca [codebase.md](file:///C:/Users/VelHarven/Music/Ta/purrific-frontend/codebase.md).
