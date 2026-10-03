# Spesifikasi Desain Responsif Handphone & Tablet Purrific

**Tanggal:** 2026-10-03  
**Status:** Disetujui (Approved)  
**Lingkup:** Tampilan responsif seluruh website Purrific untuk Handphone (<768px) dan Tablet (768px–1023px) tanpa mengganggu penskalaan otomatis Desktop (≥1024px).

---

## 1. Latar Belakang & Tujuan
Purrific telah mengimplementasikan sistem penskalaan desktop adaptif berbasis acuan 1600×900 untuk layar `≥ 1024px`. Untuk melengkapi pengalaman pengguna di perangkat seluler dan tablet, seluruh website dirombak agar responsif, fleksibel, dan ramah sentuhan (*touch-friendly*):
- Pada layar **Handphone (`< 768px`)**, antarmuka dioptimalkan untuk navigasi satu tangan (drawer geser, bottom sheet untuk modal, tampilan jadwal per hari, dan kolom kanban yang nyaman di-swipe).
- Pada layar **Tablet (`768px – 1023px`)**, antarmuka memanfaatkan ruang layar secara cerdas dengan sidebar yang dapat diciutkan (*collapsible*), grid 2 kolom, dan dialog di tengah.
- Pada layar **Desktop (`≥ 1024px`)**, sistem penskalaan otomatis 1600×900 dan `--app-vh` tetap berjalan sempurna tanpa regresi.

---

## 2. Arsitektur Breakpoint & Layout

| Breakpoint | Rentang Viewport | Zoom Dokumen | Navigasi & Sidebar | Modals & Dialog |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile (Handphone)** | `< 768px` | `1.0` (Murni native) | • Drawer geser dari kiri dibuka lewat floating burger / header burger.<br>• Touch target minimal 44×44px.<br>• Project layout: chip tab horizontal sticky di atas. | **Bottom Sheet**: menempel di dasar layar (`bottom-0 rounded-t-2xl`), drag handle, `max-h-[85vh]`. |
| **Tablet Portrait** | `768px – 1023px` | `1.0` (Murni native) | • Sidebar desktop default **terciutkan (collapsed)** agar area kerja luas.<br>• Tombol buka/tutup cepat di kiri atas.<br>• Ruang kerja kanban, catatan, dan tabel leluasa. | **Center Modal**: popup di tengah layar (`max-w-lg` atau `max-w-2xl`). |
| **Tablet Landscape / Desktop** | `≥ 1024px` | `0.80 – 1.35` (Skala otomatis 1600×900) | • Sidebar desktop terbuka normal sesuai status collapse pengguna.<br>• Penskalaan proporsional penuh dengan `--app-vh`. | **Center Modal**: popup proporsional di tengah layar. |

---

## 3. Komponen Utama & Spesifikasi Halaman

### 3.1 Komponen Modal & Form ([`ModalShell.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/components/ui/ModalShell.tsx))
- **Transformasi Bottom Sheet di Handphone (`< 640px`)**:
  - Container modal menggunakan kelas Tailwind:
    `fixed inset-x-0 bottom-0 z-[60] flex max-h-[88vh] w-full flex-col rounded-t-2xl border-t border-gray-200 bg-white p-4 shadow-2xl sm:static sm:inset-auto sm:max-h-[82vh] sm:rounded-2xl sm:border`
  - Dilengkapi indikator visual drag bar di bagian paling atas:
    `<div className="mx-auto mb-2.5 h-1 w-12 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />`
  - Tombol tutup (`X`) dan tombol submit/batal diletakkan pada posisi yang mudah dijangkau jempol.
- **Center Modal di Tablet & Desktop (`≥ 640px`)**:
  - Tetap berada di tengah layar secara vertikal dan horizontal dengan padding `p-4 sm:p-6`.

### 3.2 Layout Aplikasi ([`AppLayout.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/components/layout/AppLayout.tsx)) & ([`ProjectLayout.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/components/layout/ProjectLayout.tsx))
- **AppLayout**:
  - Di layar `< 1024px`: Sidebar desktop disembunyikan (`hidden lg:block`), navigasi diakses melalui drawer slide-in dari kiri dengan backdrop overlay halus (`bg-black/30`).
  - Tombol floating burger (`FloatingMobileBurger`) diposisikan dengan margin aman (`bottom-5 left-5` atau `top-4 left-4`), z-index tinggi, dan touch target luas.
- **ProjectLayout**:
  - Di layar `< 768px`: Header atas sticky menampilkan nama project, tombol kembali ke tim, dan tab navigasi horizontal yang dapat digeser (*scrollable tabs*).
  - Di layar `768px – 1023px` (Tablet): Sidebar project menggunakan mode collapsible (`md:flex md:w-56`), dengan default `collapsed` pada tablet portrait (lebar viewport < 900px) agar kanban memiliki ruang lebar.

### 3.3 Board Kanban ([`BoardPage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/BoardPage.tsx) & [`KanbanBoard.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/components/kanban/KanbanBoard.tsx))
- **Interaksi Sentuh (Touch Drag vs Scroll)**:
  - `TouchSensor` dikonfigurasi dengan:
    `useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })`
    Pengguna dapat melakukan scrolling horizontal antar kolom dan scrolling vertikal isi kolom tanpa memicu drag secara tidak sengaja.
  - Kartu yang sedang di-drag menampilkan bayangan terangkat dan opacity 90%.
- **Lebar Kolom & Layout di HP**:
  - Kolom menggunakan lebar `w-[84vw] sm:w-80 shrink-0` dengan container `overflow-x-auto nice-scroll pb-24 sm:pb-8`.
  - Margin bawah ekstra (`pb-24`) mencegah kartu paling bawah tertutup oleh floating pill project switcher atau preview banner.
- **Kotak Aksi Mengambang Non-Blocking ("Buka Pengaturan Card")**:
  - Saat kartu task di-tap/klik, aplikasi tidak langsung memblokir layar dengan modal penuh.
  - Sebuah kotak mengambang (*floating action box*) muncul di bagian bawah layar (`fixed bottom-4 inset-x-4 max-w-md mx-auto z-40`):
    - Berisi judul task dan tombol utama berlabel **"Buka Pengaturan Card"**.
    - Tombol tutup (`×`) untuk menutup kotak.
    - **Tanpa backdrop overlay pemblokir**: Pengguna tetap dapat men-scroll board kanban secara bebas saat kotak ini muncul.
    - Menekan tombol "Buka Pengaturan Card" akan membuka modal detail task penuh.
- **Menu Alternatif "Pindah Status"**:
  - Di modal detail task ([`TaskDetailPage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/TaskDetailPage.tsx)), pemilih status kolom disediakan secara mencolok sehingga pemindahan task bisa dilakukan dengan 1 kali tap tanpa harus drag melintasi kolom.

### 3.4 Kalender & Jadwal Harian ([`CalendarView.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/components/daily/CalendarView.tsx))
- **Default View di HP**:
  - Jika lebar layar `< 640px`, default `viewMode` diarahkan ke `'day'` (Tampilan Hari).
  - Tampilan Hari menyajikan timeline vertikal per jam (00:00 - 23:00) yang lapang dan mudah diklik untuk membuat/mengedit jadwal.
- **Tampilan Minggu (Week View) di HP**:
  - Saat pengguna memilih mode Minggu di HP, grid hari tidak ditekan ke dalam 1 layar, melainkan memiliki pembungkus `overflow-x-auto nice-scroll` dengan lebar kolom minimal `min-w-[120px]` per hari (`grid-cols-[56px_repeat(7,minmax(120px,1fr))]`).
- **Kotak Aksi Mengambang Non-Blocking ("Buka Pengaturan Card")**:
  - Saat kartu jadwal di-tap/klik pada kalender, sistem memunculkan kotak mengambang di bawah layar (`fixed bottom-4 inset-x-4 max-w-md mx-auto z-40`).
  - Menampilkan ringkasan kegiatan dan tombol aksi jelas: **"Buka Pengaturan Card"**.
  - **Dapat di-scroll secara bebas**: Kotak ini tidak menggunakan backdrop overlay gelap yang memblokir layar, sehingga pengguna tetap bisa men-scroll jadwal/timeline kalender secara bebas meskipun kotak aksi sedang tampil.
  - Menekan "Buka Pengaturan Card" akan membuka modal/bottom-sheet pengaturan kartu kegiatan (`CalendarCardSettings`).
- **Laci Tugas Belum Terjadwal (Unscheduled Tasks Drawer)**:
  - Di HP, tombol "Tugas belum terjadwal" membuka bottom drawer atau modal ringkas agar pengguna bisa memilih tugas untuk dimasukkan ke jam tertentu.

### 3.5 Catatan, Tabel, & Pengaturan
- **Catatan ([`NotePage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/NotePage.tsx))**:
  - Pembungkus dokumen menggunakan `px-3 sm:px-6 py-4 max-w-3xl mx-auto`.
  - Blok gambar dan lampiran memiliki `max-w-full h-auto rounded-lg`.
  - Floating toolbar blok teks memiliki penataan wrap agar tidak meluap keluar layar HP.
- **Tabel Data ([`TablePage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/TablePage.tsx) & [`TableGrid.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/components/table/TableGrid.tsx))**:
  - Container tabel memiliki `overflow-x-auto nice-scroll`.
  - Checkbox pemilihan baris dan tombol tambah baris memiliki touch target minimal 36×36px.
- **Halaman Tim & Organisasi ([`TeamPage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/TeamPage.tsx), [`OrganizationPage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/OrganizationPage.tsx))**:
  - Kartu KPI: `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`.
  - Daftar anggota tim: item fleksibel yang menumpuk rapi di HP dengan tombol aksi yang mudah disentuh.
- **Halaman Pengaturan ([`SettingsPage.tsx`](file:///c:/Users/VelHarven/Music/Ta/purrific-frontend/src/pages/SettingsPage.tsx))**:
  - Tab navigasi pengaturan di HP berupa bar horizontal scrollable di atas form, memberikan ruang penuh untuk input pengaturan di bawahnya.

---

## 4. Keamanan & Penanganan Error (*Error Handling*)
1. **Fallback Resolusi Rendah:** Jika dimensi layar perangkat tidak terdeteksi (SSR atau headless), sistem fallback dengan aman ke skala `1.0` dan viewport default 390×844.
2. **Double Scrollbar Elimination:** Menggunakan `nice-scroll` dengan `overflow-x-auto` yang terisolasi per komponen, menghindari scroll horizontal pada level `body`/`html`.
3. **Touch Conflict Guard:** `DndContext` diatur dengan constraint delay 200ms pada pointer/touch sehingga event native browser untuk vertical swipe/pull-to-refresh tidak terblokir kecuali pengguna sengaja melakukan hold-drag pada elemen draggable.

---

## 5. Rencana Pengujian
1. **Automated Unit & Integration Tests:**
   - Menjalankan `npm run typecheck` (`tsc --noEmit`) tanpa error.
   - Menjalankan `npm test` (`vitest run`) memastikan seluruh 21 test files (151 tests) tetap hijau/lolos.
2. **Pengujian Matriks Viewport:**
   - Mobile: 375×667 (iPhone SE), 390×844 (iPhone 14/15), 412×915 (Android)
   - Tablet: 768×1024 (iPad Portrait), 820×1180 (iPad Air), 1024×768 (iPad Landscape)
   - Desktop: 1366×768, 1600×900, 1920×1080.
