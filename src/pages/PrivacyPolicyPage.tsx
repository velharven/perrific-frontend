import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, KeyRound, Mail, ExternalLink } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-perrific-paper font-manrope text-perrific-graphite antialiased">
      {/* Top Brand Bar */}
      <div className="h-1 w-full bg-perrific-wood" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-perrific-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/Purrific.svg" alt="Purrific" width="32" height="32" className="h-8 w-8 shrink-0" />
            <span className="font-space-grotesk text-lg font-extrabold tracking-[-0.03em] text-perrific-graphite group-hover:text-perrific-violet transition-colors">
              Purrific
            </span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-perrific-line bg-perrific-paper px-4 py-2 text-xs font-semibold text-perrific-graphite hover:bg-white transition shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </header>

      {/* Hero / Header Section */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-perrific-line bg-white px-3.5 py-1 text-xs font-semibold text-perrific-wood shadow-2xs">
            <ShieldCheck size={14} className="text-perrific-violet" />
            <span>Legal & Transparansi Data</span>
          </div>
          <h1 className="mt-4 font-space-grotesk text-3xl font-extrabold tracking-tight sm:text-4xl text-perrific-graphite">
            Kebijakan Privasi Purrific
          </h1>
          <p className="mt-2 text-sm text-perrific-graphite/60">
            Terakhir diperbarui: 3 Oktober 2026 · Efektif berlaku untuk seluruh pengguna Purrific
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 rounded-2xl border border-perrific-line bg-white p-6 sm:p-10 shadow-xs">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                1
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Pendahuluan
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Selamat datang di <strong>Purrific</strong>. Kami menghargai privasi Anda dan berkomitmen
                untuk melindungi data pribadi serta informasi aktivitas yang Anda percayakan kepada kami.
                Kebijakan Privasi ini menjelaskan bagaimana Purrific mengumpulkan, menggunakan, menyimpan,
                dan melindungi informasi Anda saat menggunakan aplikasi web kami, termasuk integrasi dengan
                layanan pihak ketiga seperti Google Calendar.
              </p>
              <p>
                Dengan mengakses atau menggunakan layanan Purrific, Anda memahami dan menyetujui praktik
                pengelolaan data yang diuraikan dalam dokumen ini.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                2
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Penggunaan Data Google Calendar & Izin Akses
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Purrific menyediakan fitur opsional untuk menyinkronkan aktivitas harian personal Anda
                dengan akun Google Calendar Anda. Jika Anda memilih untuk menghubungkan Google Calendar,
                Purrific akan meminta izin akses berikut:
              </p>

              <div className="rounded-xl border border-perrific-line bg-perrific-paper/70 p-4 font-mono text-xs text-perrific-graphite">
                <span className="font-semibold text-perrific-wood">Scope OAuth: </span>
                https://www.googleapis.com/auth/calendar.events
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-perrific-graphite">Tujuan dan Cara Penggunaan:</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-perrific-graphite/75">
                  <li>
                    <strong>Sinkronisasi 2 Arah (Two-Way Sync):</strong> Membaca agenda kegiatan Google Calendar
                    Anda untuk ditampilkan pada linimasa aktivitas harian Purrific, serta membuat atau memperbarui
                    event di Google Calendar saat Anda mengelola jadwal di Purrific.
                  </li>
                  <li>
                    <strong>Pencegahan Duplikasi & Resolusi Konflik:</strong> Menjaga keteraturan jadwal tanpa
                    mengubah kalender pihak ketiga di luar event yang secara spesifik Anda jadwalkan melalui Purrific.
                  </li>
                  <li>
                    <strong>Tanpa Penjualan Data:</strong> Purrific <strong>TIDAK PERNAH</strong> menjual,
                    menyewakan, meminjamkan, atau menukar data pribadi, data kontak, maupun data event Google
                    Calendar Anda kepada pihak ketiga, broker data, atau jaringan periklanan mana pun.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 - Google API Limited Use Clause */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600 border border-blue-200">
                3
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Klausul Kepatuhan Penggunaan Terbatas Google API (Google API Limited Use Disclosure)
              </h2>
            </div>
            <div className="pl-9 space-y-4 text-sm leading-relaxed text-perrific-graphite/80">
              {/* Mandatory clause callout block */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/70 p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 text-sm">
                      Klausul Kepatuhan Resmi Google API:
                    </h3>
                    <p className="mt-1.5 text-blue-950 font-medium italic leading-relaxed text-sm">
                      &ldquo;Penggunaan dan transfer informasi yang diterima oleh Purrific dari Google API ke aplikasi lain akan mematuhi Kebijakan Data Pengguna Layanan Google API (Google API Services User Data Policy), termasuk persyaratan Penggunaan Terbatas (Limited Use requirements).&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p>
                  Secara khusus, sesuai dengan persyaratan Penggunaan Terbatas (Limited Use requirements):
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-perrific-graphite/75">
                  <li>
                    Data yang diperoleh dari Google API hanya digunakan untuk menyediakan dan meningkatkan
                    fitur manajemen aktivitas yang dihadapi langsung oleh pengguna (user-facing features).
                  </li>
                  <li>
                    Data tidak ditransfer ke pihak lain kecuali jika diperlukan untuk menyediakan fitur tersebut,
                    mematuhi hukum yang berlaku, atau sebagai bagian dari penggabungan usaha.
                  </li>
                  <li>
                    Data Google Anda tidak digunakan untuk melayani iklan, termasuk iklan yang dipersonalisasi
                    atau penargetan ulang.
                  </li>
                  <li>
                    Data Anda tidak digunakan untuk melatih model kecerdasan buatan (AI) umum atau model bahasa besar (LLM).
                  </li>
                  <li>
                    Manusia tidak diperkenankan membaca data kalender Anda kecuali telah mendapatkan persetujuan eksplisit
                    dari Anda untuk tujuan dukungan teknis khusus, jika diwajibkan oleh hukum, atau untuk keperluan keamanan internal.
                  </li>
                </ul>
              </div>

              <div className="pt-1">
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition underline underline-offset-4"
                >
                  <span>Baca Kebijakan Data Pengguna Layanan Google API secara lengkap</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                4
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Keamanan & Enkripsi Data di Penyimpanan
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Keamanan data Anda adalah prioritas utama kami. Kami menerapkan perlindungan teknis dan
                organisasional berlapis untuk mencegah akses, pengubahan, atau kebocoran yang tidak sah:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <div className="rounded-xl border border-perrific-line bg-perrific-paper/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-perrific-graphite text-xs">
                    <Lock size={15} className="text-perrific-wood" />
                    <span>Enkripsi AES-256-GCM at Rest</span>
                  </div>
                  <p className="text-xs text-perrific-graphite/70">
                    Refresh token dan access token OAuth Google Calendar disimpan dalam database dengan
                    enkripsi kuat standar industri AES-256-GCM menggunakan kunci enkripsi server terisolasi.
                  </p>
                </div>

                <div className="rounded-xl border border-perrific-line bg-perrific-paper/50 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-perrific-graphite text-xs">
                    <KeyRound size={15} className="text-perrific-wood" />
                    <span>Transmisi TLS / HTTPS Terproteksi</span>
                  </div>
                  <p className="text-xs text-perrific-graphite/70">
                    Seluruh komunikasi antara browser Anda, server Purrific, dan Google API dilindungi oleh
                    protokol enkripsi SSL/TLS 1.3 selama proses transmisi (in transit).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                5
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Kontrol Pengguna & Pencabutan Akses
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Anda memegang kendali penuh atas akun dan data yang Anda integrasikan dengan Purrific:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-perrific-graphite/75">
                <li>
                  <strong>Memutuskan Sambungan Mandiri:</strong> Anda dapat memutuskan sambungan Google Calendar
                  kapan saja dengan membuka menu <em>Settings &gt; Integrasi Google Calendar</em> dan menekan tombol
                  <strong> &ldquo;Putuskan&rdquo;</strong>.
                </li>
                <li>
                  <strong>Penghapusan Token Otomatis:</strong> Saat koneksi diputuskan, token autentikasi terenkripsi
                  akan langsung dihapus secara permanen dari server kami, dan sinkronisasi otomatis akan langsung berhenti.
                </li>
                <li>
                  <strong>Pencabutan Akses melalui Akun Google:</strong> Anda juga dapat mencabut izin akses aplikasi
                  Purrific kapan saja secara terpusat melalui halaman manajemen izin akun Google Anda di{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-perrific-violet font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Google Account Permissions
                    <ExternalLink size={11} />
                  </a>.
                </li>
                <li>
                  <strong>Penghapusan Akun:</strong> Jika Anda menghapus akun Purrific Anda, seluruh profil, data
                  aktivitas, dan kredensial integrasi akan dimusnahkan secara permanen dari basis data produksi kami.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                6
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Kontak / Hubungi Kami
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Apabila Anda memiliki pertanyaan, keluhan, permohonan penghapusan data, atau masukan terkait
                Kebijakan Privasi ini, silakan menghubungi tim kami melalui:
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-perrific-graphite pt-1">
                <Mail size={16} className="text-perrific-violet" />
                <a
                  href="mailto:support@purrific.app"
                  className="text-perrific-violet hover:underline underline-offset-4"
                >
                  support@purrific.app
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-perrific-graphite/60">
          <p>© 2026 Purrific. Seluruh hak cipta dilindungi undang-undang.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-perrific-violet transition">
              Syarat & Ketentuan
            </Link>
            <span>·</span>
            <Link to="/" className="hover:text-perrific-violet transition">
              Beranda
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
