# Panduan arsitektur frontend Purrific

Dokumen ini menjelaskan struktur internal, modul kode, tata letak antarmuka, sistem rute, dan pengelolaan state pada aplikasi frontend Purrific.

## Struktur direktori

```text
purrific-frontend/
├── public/                      # Aset statis publik
├── src/
│   ├── api/                     # Modul pemanggilan endpoint backend API
│   │   ├── activities.ts        # Permintaan data aktivitas harian dan checklist
│   │   ├── calendar.ts          # Permintaan OAuth, event, dan sinkronisasi Google Calendar
│   │   ├── notes.ts             # Permintaan data catatan dan tabel
│   │   ├── notifications.ts     # Permintaan daftar dan status notifikasi
│   │   ├── projects.ts          # Permintaan proyek, kolom kanban, peran, dan anggota
│   │   ├── tasks.ts             # Permintaan tugas, penugasan saya, komentar, dan lampiran
│   │   └── teams.ts             # Permintaan tim, undangan, dan persetujuan gabung
│   ├── components/
│   │   ├── auth/                # Komponen alur autentikasi (GoogleAuthButton, UsernameModal)
│   │   ├── daily/               # Komponen kalender dan penjadwalan harian
│   │   │   ├── CalendarCardSettings.tsx # Modal popover pengaturan kartu kalender terpadu (Purrific & Google Calendar)
│   │   │   ├── CalendarSidebar.tsx # Menu samping drag & drop untuk Item dan Team Task belum terjadwal
│   │   │   └── CalendarView.tsx    # Tampilan kalender (Minggu, Hari) ala Notion Calendar dengan drag & drop dan Undo
│   │   ├── dashboard/           # Komponen widget dasbor personal
│   │   │   ├── blocks/          # Blok individual (Focus, Greeting, Progress, Teams, Today)
│   │   │   ├── AddBlockModal.tsx
│   │   │   ├── DashboardBlockView.tsx
│   │   │   ├── DashboardSkeleton.tsx
│   │   │   ├── SortableBlock.tsx
│   │   │   ├── layout.ts
│   │   │   └── useDashboardData.ts
│   │   ├── kanban/              # Komponen papan kanban berbasis drag and drop
│   │   │   └── KanbanBoard.tsx
│   │   ├── landing/             # Komponen halaman muka publik
│   │   │   ├── CTASection.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── PersonaSection.tsx
│   │   │   ├── ProblemSection.tsx
│   │   │   └── SolutionSection.tsx
│   │   ├── layout/              # Rangka halaman utama dan navigasi
│   │   │   ├── AppLayout.tsx    # Sidebar privat, daftar tim, navigasi utama
│   │   │   ├── DropIndicator.tsx
│   │   │   ├── ProjectLayout.tsx# Sub-navigasi proyek (Overview, Kanban, Tugas Saya, dsb.)
│   │   │   ├── ProtectedRoute.tsx# Penjaga rute terotentikasi
│   │   │   ├── SortableSection.tsx
│   │   │   └── SortableTabRow.tsx
│   │   ├── note/                # Editor catatan berbasis blok ala Notion
│   │   │   ├── BlockEditor.tsx
│   │   │   ├── CropEditorModal.tsx
│   │   │   ├── HeadingOutline.tsx
│   │   │   ├── SlashMenu.tsx
│   │   │   └── cover.ts
│   │   ├── project/             # Editor pengaturan proyek
│   │   │   ├── BoardColumnEditor.tsx
│   │   │   ├── CreateProjectModal.tsx
│   │   │   └── RoleTab.tsx
│   │   ├── table/               # Grid tabel basis data personal
│   │   │   ├── ColumnMenu.tsx
│   │   │   ├── EmbeddedTable.tsx
│   │   │   ├── PersonCell.tsx   # Sel tipe pengguna/anggota tim
│   │   │   ├── SortableRow.tsx
│   │   │   ├── SortableTh.tsx
│   │   │   ├── TableGrid.tsx
│   │   │   └── useTableData.ts
│   │   ├── task/                # Modal tampilan detail dan riwayat tugas
│   │   │   └── TaskDetailView.tsx
│   │   ├── team/                # Komponen manajemen tim dan persetujuan
│   │   │   └── ApprovalLists.tsx
│   │   ├── ui/                  # Komponen antarmuka umum (Avatar, ModalShell, Toast, dll.)
│   │   └── icons.tsx            # Komponen ikon SVG terpusat
│   ├── fonts/                   # Berkas font kustom
│   ├── hooks/                   # Custom hooks aplikasi
│   │   ├── useGoogleCalendar.ts # Pengelolaan status koneksi, OAuth, dan sinkronisasi Google Calendar
│   │   ├── useNavLabels.ts      # Pengelolaan label tab kustom di sidebar
│   │   ├── useTeamPeople.ts     # Pengambilan daftar anggota tim untuk PersonCell
│   │   ├── useUndoStack.tsx     # Riwayat pembatalan aksi (undo/redo)
│   │   └── useUsernameAvailability.ts # Pemeriksaan debounce ketersediaan username
│   ├── lib/                     # Modul pembantu utilitas
│   │   ├── api.ts               # Instance Axios dengan interceptor token JWT
│   │   ├── avatar.ts            # Pembentukan inisial dan warna avatar
│   │   ├── google.ts            # Pembacaan konfigurasi Client ID Google
│   │   ├── invite.ts            # Helper validasi dan pembentukan link undangan
│   │   ├── next.ts
│   │   ├── preview.ts
│   │   └── socket.ts            # Client singleton Socket.io
│   ├── pages/                   # Halaman tampilan utama
│   │   ├── BoardPage.tsx        # Tampilan papan kanban proyek
│   │   ├── DailyInstancePage.tsx# Wadah rute instance aktivitas harian
│   │   ├── DailyPage.tsx        # Halaman aktivitas harian personal (tabel 'Semua Kegiatan' & 'Kalender' Notion-style, drag & drop sidebar, sinkronisasi Google Calendar)
│   │   ├── DashboardInstancePage.tsx # Wadah rute instance dasbor
│   │   ├── DashboardPage.tsx
│   │   ├── JoinPage.tsx         # Halaman penerimaan undangan tim
│   │   ├── LandingPage.tsx      # Halaman awal publik
│   │   ├── LoginPage.tsx        # Halaman masuk
│   │   ├── NotFoundPage.tsx     # Halaman 404
│   │   ├── NotePage.tsx         # Halaman editor catatan blok
│   │   ├── PrivatRedirect.tsx   # Pengalih rute ke entri privat aktif pertama
│   │   ├── ProjectApprovalPage.tsx # Halaman daftar usulan tugas yang perlu persetujuan
│   │   ├── ProjectPage.tsx      # Halaman ringkasan/overview proyek
│   │   ├── ProjectSettingsPage.tsx # Pengaturan proyek, kolom kanban, dan peran
│   │   ├── RegisterPage.tsx     # Halaman registrasi pengguna
│   │   ├── SettingsPage.tsx     # Pengaturan profil, kata sandi, dan integrasi Google Calendar
│   │   ├── TablePage.tsx        # Halaman tabel basis data personal
│   │   ├── TaskDetailPage.tsx   # Halaman atau popup detail tugas
│   │   ├── TeamPage.tsx         # Halaman profil dan ringkasan tim
│   │   ├── TeamProjectsPage.tsx # Daftar proyek di bawah satu tim
│   │   └── TeamSettingsPage.tsx # Pengaturan tim dan anggota
│   ├── store/                   # State global React Context
│   │   ├── auth.tsx             # AuthProvider dan hook useAuth
│   │   └── socket.tsx           # SocketProvider dan hook useSocket
│   ├── styles/                  # Berkas stylesheet CSS
│   ├── types/
│   │   └── index.ts             # Definisi antarmuka TypeScript terpusat
│   ├── App.tsx                  # Deklarasi routing aplikasi dan provider
│   └── main.tsx                 # Mounting React root
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## Arsitektur perutean (routing)

Routing dikelola oleh `react-router-dom` versi 6 di dalam `src/App.tsx`.

### 1. Rute publik
- `/`: Halaman landing produk (`LandingPage`).
- `/login`: Form masuk akun (`LoginPage`).
- `/register`: Form pendaftaran akun baru (`RegisterPage`).

### 2. Rute terproteksi (`ProtectedRoute`)
Setiap rute di bawah `ProtectedRoute` mewajibkan token login aktif. Jika token kosong atau tidak valid, pengguna dialihkan ke `/login`.

- Rute alur tim:
  - `/join/:code`: Halaman konfirmasi dan pengajuan bergabung ke tim melalui kode undangan.

- Rute dalam kerangka umum (`AppLayout`):
  - `/dashboard`: Dialihkan oleh `PrivatRedirect` ke ID dasbor pertama pengguna.
  - `/dashboard/:dashboardId`: Tampilan widget dasbor personal pengguna.
  - `/daily`: Dialihkan oleh `PrivatRedirect` ke ID halaman daily pertama pengguna.
  - `/daily/:dailyId`: Tampilan aktivitas harian personal dengan kalender per tanggal.
  - `/notes/:noteId`: Halaman editor catatan blok personal ala Notion.
  - `/tables/:tableId`: Halaman tabel basis data personal.
  - `/team/:teamId`: Halaman profil tim.
  - `/team/:teamId/projects`: Daftar proyek di dalam tim.
  - `/team/:teamId/settings`: Pengaturan tim, undangan anggota, dan antrean persetujuan.
  - `/settings`: Pengaturan akun pengguna, pergantian avatar, username, dan kata sandi.

- Rute ruang kerja proyek (`ProjectLayout`):
  Menyediakan bilah navigasi khusus konteks proyek:
  - `/projects/:projectId`: Tampilan ringkasan proyek (Overview) berisi aktivitas terbaru, komentar, dan lampiran.
  - `/projects/:projectId/kanban`: Papan kanban proyek dengan kolom fleksibel.
  - `/projects/:projectId/kanban/:taskId`: Modal detail tugas di atas papan kanban.
  - `/projects/:projectId/persetujuan`: Daftar usulan tugas yang menunggu persetujuan (`ProjectApprovalPage`).
  - `/projects/:projectId/settings`: Pengaturan nama proyek, avatar, susunan kolom kanban, peran kustom, dan penugasan peran anggota.

## Pengelolaan state aplikasi

Frontend menggunakan pendekatan state management yang modular:

### 1. State autentikasi global (`store/auth.tsx`)
- Menyimpan status login (`user`, `token`, `isAuthenticated`, `isLoading`).
- Menyimpan token JWT di `localStorage` dengan kunci `purrific_token`.
- Menyediakan metode `login(token, user)`, `logout()`, dan `refreshUser()`.

### 2. State koneksi Socket.io (`store/socket.tsx`)
- Menginisialisasi koneksi websocket menggunakan token yang tersimpan.
- Otomatis menghubungkan soket ketika pengguna login dan memutuskan koneksi saat logout.
- Menyediakan hook `useSocket()` untuk mendengarkan event real-time di komponen halaman manapun.

### 3. State navigasi privat lokal (`hooks/useNavLabels.ts`)
- Menyimpan nama kustom tab sidebar privat per pengguna pada `localStorage`.
- Menggunakan CustomEvent browser `purrific:navlabels-changed` agar perubahan nama label langsung tersinkronisasi di sidebar desktop maupun drawer mobile tanpa reload.

### 4. State lokal komponen dan custom hook
- Halaman kanban (`BoardPage.tsx`) mengelola state lokal kartu tugas, kolom aktif, modal pembuatan tugas, dan filter pencarian.
- Halaman aktivitas harian (`DailyPage.tsx`) mengelola state kalender tanggal terpilih, daftar checklist, mode input waktu, dan alih tampilan antara tabel database 'Semua Kegiatan' dan 'Kalender' Notion-style.
- Kalender aktivitas harian (`CalendarView.tsx`) mengelola mode tampilan ('week' dan 'day'), penataan layout kegiatan bertumpuk (`computeTimedItemsLayout`), garis horizontal penunjuk waktu sekarang ala Notion Calendar, interaksi drag & drop kartu kalender, penargetan koordinat jam presisi (`HOUR_HEIGHT`), serta pintasan keyboard (`Delete`/`Backspace` untuk hapus, `Ctrl+Z`/`Cmd+Z` untuk stack undo riwayat pembatalan, dan `0`/`w` serta `1`/`d` untuk beralih mode minggu/hari).
- Menu samping penjadwalan (`CalendarSidebar.tsx`) mengelola daftar item personal dan tugas tim yang belum terjadwal di kalender dengan pencarian instan, kuota scroll, dan payload draggable.
- Pengaturan kartu kalender terpadu (`CalendarCardSettings.tsx`) menyediakan modal popover terpadu untuk kartu Purrific (`DailyActivity`) maupun kartu Google Calendar (`GoogleCalendarEvent`), menyamakan pengaturan waktu, judul, deskripsi, sub-checklist, pengulangan (`Repeat`), tautan Google Calendar, serta aksi hapus dan buka detail.
- `CalendarSyncProvider` memeriksa perubahan Google setiap 30 detik selama aplikasi terlihat, online, dan akun terhubung, termasuk saat berpindah dari halaman Daily. Koneksi baru dan pemulihan tab/jaringan memicu sinkronisasi segera. Pembukaan kalender, perubahan rentang, dan tombol sinkronisasi meminta impor rentang dengan `hydrateRange: true`; rentang yang diminta saat proses berjalan tetap diantrekan. Provider mencoba kembali kegagalan dengan jeda bertahap dan menyiarkan revisi untuk memperbarui aktivitas serta kartu tanpa reload. Kalender menampilkan status proses, perubahan tertunda, dan waktu sinkronisasi terakhir dalam WIB.
- Grid tabel basis data (`TableGrid.tsx` dan `useTableData.ts`) mengelola struktur kolom, baris data, dan auto-save ke backend.

## Lapisan komunikasi jaringan (API layer)

Pemanggilan API backend dipusatkan melalui Axios di `src/lib/api.ts`:
- Base URL diambil dari variabel lingkungan `VITE_API_URL` (default: `http://localhost:4000`).
- Interceptor request secara otomatis menyisipkan header `Authorization: Bearer <token>` bila token ditemukan di penyimpanan lokal.
- Interceptor response menangkap status HTTP `401 Unauthorized` untuk membersihkan sesi kedaluwarsa dan mengarahkan pengguna kembali ke halaman login.
- File-file pemanggil API di `src/api/` membungkus endpoint sesuai domain (activities, calendar, notes, notifications, projects, tasks, teams) dan mengembalikan data terstruktur. Modul `calendar.ts` mendukung URL auth, callback OAuth, status koneksi, pengambilan event, sinkronisasi dua arah, dan sinkronisasi instan per-aktivitas (`syncActivity`).

## Interaksi drag and drop

Aplikasi memadukan pustaka `@dnd-kit` untuk komponen berbasis modul serta HTML5 Drag and Drop API native untuk visualisasi timeline kalender:
1. Papan kanban (`KanbanBoard.tsx`): Menggunakan `@dnd-kit/core` dan `@dnd-kit/sortable`. Kartu tugas dapat dipindahkan antar-kolom maupun diatur ulang urutannya di dalam kolom yang sama. Sensor penunjuk dikonfigurasi dengan toleransi pergerakan minimal agar tidak mengganggu klik biasa.
2. Kolom kanban (`BoardColumnEditor.tsx`): Urutan kolom kanban pada menu pengaturan dapat digeser secara horizontal atau vertikal.
3. Tabel data personal (`SortableRow.tsx` dan `SortableTh.tsx`): Baris dan kolom tabel dapat diatur ulang urutannya dengan drag and drop.
4. Blok dasbor personal (`SortableBlock.tsx`): Pengguna dapat menyusun ulang urutan kartu widget pada halaman dasbor.
5. Kalender timeline dan sidebar penjadwalan (`CalendarView.tsx` dan `CalendarSidebar.tsx`): Memanfaatkan HTML5 Drag and Drop native untuk memindahkan kartu kalender antar slot jam dan tanggal dengan pelestarian durasi otomatis serta penataan kegiatan berdampingan (side-by-side) ala Notion Calendar, sekaligus mendukung penarikan item tertunda dari sidebar ke kisi kalender secara presisi berdasarkan posisi vertikal (`HOUR_HEIGHT` 60px/jam) yang dilengkapi dukungan stack undo (`Ctrl+Z`).

Perubahan, pemindahan (drag & drop), dan penghapusan pada kartu berulang membuka `RecurrenceScopeModal` ala Notion Calendar dengan tiga pilihan cakupan: `Event ini` (`THIS_EVENT`), `Event ini dan ... seterusnya` (`THIS_AND_FOLLOWING`), serta `Semua event` (`ALL_EVENTS`), lengkap dengan dukungan riwayat pembatalan (`Ctrl+Z`).

## Tata gaya dan sistem desain

Desain antarmuka dibangun menggunakan Tailwind CSS dengan font sans modern:
- Desain responsif mendukung tampilan desktop layar lebar hingga layar ponsel pintar.
- Shell aplikasi menyediakan bilah sisi (sidebar) yang dapat dilipat dan drawer khusus untuk perangkat bergerak.
- Modal dan portal popover menggunakan koordinat fixed atau `MenuPortal.tsx` agar tidak terpotong oleh overflow kontainer induk.
