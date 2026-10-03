# Desain Teknis: Sistem Skala Antarmuka Desktop Adaptif (Acuan 1600x900)

**Tanggal:** 2026-10-03  
**Status:** Disetujui (Approved)  
**Tujuan:** Menjadikan tampilan antarmuka desktop (ukuran card, popup modal, sidebar, typography, dan spacing) konsisten dan proporsional persis seperti di layar referensi pengguna resolusi 1600x900, di berbagai laptop dan layar monitor desktop lainnya.

---

## 1. Latar Belakang & Masalah
Aplikasi Purrific dikembangkan dan digunakan secara optimal oleh pengguna pada laptop beresolusi **1600x900**. Ketika aplikasi dibuka di layar laptop/desktop lain dengan resolusi berbeda (misalnya Full HD 1920x1080 atau HD 1366x768):
- Pada layar 1920x1080, elemen (seperti task card, popup dialog, teks) tampak mengecil dan menyisakan banyak ruang kosong yang tidak seimbang.
- Pada layar 1366x768, komponen desktop dapat terasa sesak jika ukuran pixel/rem tidak disesuaikan.
Pengguna menginginkan agar proporsi visual tampilan antarmuka desktop tetap konsisten 1:1 terhadap acuan 1600x900 di laptop/monitor lain.

---

## 2. Prinsip & Pendekatan Utama

### 2.1 Baseline Resolusi & Breakpoint
- **Acuan Utama (Reference Baseline):** $1600 \times 900\,\text{px}$.
- **Breakpoint Aktif:** Hanya diterapkan pada layar desktop/laptop dengan lebar layar $\ge 1024\,\text{px}$ (breakpoint `lg:` pada Tailwind).
- **Perlakuan Layar Mobile/Tablet (< 1024px):** Skala di-reset penuh ke `1.0` (normal) agar tata letak mobile alami (burger bar, drawer samping, gesture swipe) tidak terganggu dan font tidak mengecil di perangkat seluler.

### 2.2 Formula Perhitungan Skala
Pada mode **Otomatis (Adaptif 1600x900)**, rasio skala dihitung berdasarkan rasio lebar jendela peramban terhadap acuan 1600px dengan batas batas aman (*clamped*):
$$\text{scale} = \text{clamp}\left(0.80, \, \frac{\text{window.innerWidth}}{1600}, \, 1.35\right)$$

Contoh hasil perhitungan:
- Layar $1600 \times 900$: $\text{scale} = 1.00$ (100% acuan asli)
- Layar $1920 \times 1080$: $\text{scale} = 1.20$ (120%, membesar proporsional)
- Layar $1366 \times 768$: $\text{scale} \approx 0.854$ (85.4%, menyusut proporsional)
- Layar $1440 \times 900$: $\text{scale} = 0.90$ (90%)
- Layar $\ge 2560 \times 1440$ (2K/4K/Ultra-wide): $\text{scale} = 1.35$ (dibatasi maksimum 135% agar tidak berlebihan)

### 2.3 Mekanisme Injeksi: CSS `zoom` pada Root Element
Skala diterapkan langsung ke `document.documentElement` (`<html>`) melalui CSS `zoom`:
- **Kompatibilitas:** Didukung secara bawaan di semua peramban modern (Chromium/Chrome/Edge, WebKit/Safari, dan Firefox 126+).
- **Keunggulan Struktural:** Berbeda dari CSS `transform: scale()` yang menciptakan *stacking context* baru dan merusak elemen `position: fixed` serta backdrop modal, CSS `zoom` mempertahankan kelancaran `position: fixed`, tata letak *flow*, penanganan klik mouse, serta elemen popup/modal yang di-portal ke `document.body` (misalnya `ModalShell` dan `ConfirmModal`).

---

## 3. Arsitektur Komponen & Alur Data

### 3.1 Modul Pengelola Skala (`src/lib/displayScale.ts` & `src/hooks/useDisplayScale.ts`)
- **Tipe Data:**
  ```ts
  export type DisplayScaleMode = 'auto' | 'standard' | 'custom';
  ```
- **Kunci LocalStorage:**
  - `purrific_display_scale_mode`: `'auto'` | `'standard'` | `'custom'` (default: `'auto'`)
  - `purrific_display_scale_custom`: `number` (default: `1.0`, opsi: `0.8`, `0.9`, `1.0`, `1.1`, `1.2`)
- **Fungsi Utama:**
  - `computeTargetScale(mode: DisplayScaleMode, customValue: number, width: number): number`
  - `applyRootScale(scale: number): void`: Menyuntikkan nilai skala ke `document.documentElement.style.zoom`.
  - `useDisplayScale()`: Hook reaktif yang mengembalikan `{ mode, customScale, activeScale, screenWidth, screenHeight, setMode, setCustomScale }`.
  - Mendengarkan event `resize` dengan debounce 80ms untuk efisiensi CPU dan kelancaran 60fps saat jendela diubah ukurannya.
  - Mendengarkan event `storage` agar perubahan pengaturan di satu tab langsung tersinkronisasi ke tab Purrific lain di peramban yang sama.

### 3.2 Inisialisasi Aplikasi (`src/components/layout/AppLayout.tsx` & `src/main.tsx`)
- Panggilan inisialisasi dijalankan sejak dini pada startup aplikasi sehingga halaman langsung terbuka dengan skala yang benar tanpa kedipan (*layout shift*).

---

## 4. Antarmuka Pengguna (Settings UI)

### 4.1 Penempatan di `SettingsPage.tsx`
Diletakkan sebagai blok pengaturan baru menggunakan `SettingsBlock`:
```tsx
<SettingsBlock 
  title="Tampilan & Skala Layar" 
  desc="Sesuaikan skala ukuran card, popup modal, dan antarmuka desktop"
>
```

### 4.2 Elemen di Dalam Blok Pengaturan
1. **Status Banner / Info Badge**:
   - Menampilkan resolusi layar perangkat yang terdeteksi saat ini (misal `1600 × 900` atau `1920 × 1080`).
   - Menampilkan persentase skala yang sedang diterapkan (misal `100% (Acuan Asli)` atau `120% (Adaptif)`).
2. **Pilihan 3 Mode Tampilan (Radio Cards)**:
   - **Otomatis (Adaptif 1600x900)** `[Rekomendasi / Default]`: Skala menyesuaikan otomatis berdasarkan resolusi layar laptop/monitor.
   - **Standar 100%**: Mengunci skala ke rasio bawaan browser (1.0).
   - **Kustom**: Membuka pemilihan persentase manual.
3. **Pilihan Preset Persentase Kustom**:
   - Menampilkan tombol preset instan:
     - `80%` (Kompak)
     - `90%`
     - `100%` (Standar)
     - `110%`
     - `120%` (Besar)
   - Tombol yang terpilih diberi gaya aktif dengan warna khas oranye Purrific (`bg-perrific-violet text-white shadow-sm`).
4. **Respon Interaksi Seketika**:
   - Perubahan langsung aktif di layar saat tombol diklik tanpa memerlukan muat ulang halaman.

---

## 5. Kompatibilitas Elemen & Penanganan Kasus Khusus (Edge Cases)

1. **Popup Modal (`ModalShell.tsx` & `ConfirmModal.tsx`)**:
   - Modal di-portal langsung ke `document.body`. Karena `zoom` diterapkan pada root `html`, backdrop `fixed inset-0` tetap presisi menutup seluruh layar tanpa celah, dan kotak modal serta isinya terskala proporsional.
2. **Menu Dropdown Mengambang (`MenuPortal.tsx`)**:
   - Menu floating menggunakan `getBoundingClientRect()` terhadap tombol jangkar (*anchor*). Pada peramban modern, koordinat `getBoundingClientRect` berada dalam ruang koordinat yang konsisten dengan elemen yang di-zoom, menjaga menu tetap menempel presisi di bawah tombolnya.
3. **Pemisahan Layar (Snap Window / Split View)**:
   - Jika jendela ditarik ke separuh layar sehingga lebarnya $< 1024\,\text{px}$, sistem skala langsung me-reset ke `1.0` dan tampilan responsif mobile/tablet Purrific aktif dengan mulus.
4. **Penyimpanan Lokal Per Perangkat**:
   - Penggunaan `localStorage` memastikan bahwa pengaturan laptop kerja (misal 1366x768) tidak menimpa pengaturan di monitor PC rumah (1920x1080).

---

## 6. Rencana Pengujian (Testing Strategy)

1. **Unit Testing (`src/lib/displayScale.test.ts`)**:
   - Menguji kebenaran formula `computeTargetScale` pada berbagai lebar viewport (1600px, 1920px, 1366px, 1440px, 2560px, 800px).
   - Menguji transisi mode `'auto'`, `'standard'`, dan `'custom'`.
   - Menguji interaksi penyimpanan dan pembacaan `localStorage`.
2. **Kompatibilitas & Verifikasi Kode**:
   - Eksekusi `npm run typecheck` (`tsc --noEmit`).
   - Eksekusi `npm test` (`vitest run`).
