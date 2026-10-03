import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Mail } from 'lucide-react';

export default function TermsOfServicePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Syarat dan Ketentuan Layanan | Purrific';
  }, []);

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
            <FileText size={14} className="text-perrific-violet" />
            <span>Perjanjian Layanan Pengguna</span>
          </div>
          <h1 className="mt-4 font-space-grotesk text-3xl font-extrabold tracking-tight sm:text-4xl text-perrific-graphite">
            Syarat dan Ketentuan Layanan
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
                Penerimaan Ketentuan
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Selamat datang di Purrific. Syarat dan Ketentuan ini (&ldquo;Ketentuan&rdquo;) mengatur akses dan
                penggunaan Anda atas platform manajemen produktivitas, papan proyek, catatan, dan linimasa aktivitas Purrific,
                baik melalui situs web maupun layanan terkait lainnya.
              </p>
              <p>
                Dengan mendaftar, mengakses, atau menggunakan layanan Purrific, Anda menyatakan bahwa Anda telah membaca,
                memahami, dan menyetujui untuk terikat oleh Ketentuan ini serta{' '}
                <Link to="/privacy" className="text-perrific-violet font-semibold hover:underline">
                  Kebijakan Privasi
                </Link>{' '}
                kami. Jika Anda tidak menyetujui Ketentuan ini, Anda disarankan untuk tidak menggunakan layanan kami.
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
                Akun dan Tanggung Jawab Pengguna
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Untuk mengakses fitur tertentu di Purrific, Anda harus membuat akun pengguna:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-perrific-graphite/75">
                <li>
                  <strong>Keakuratan Informasi:</strong> Anda wajib memberikan informasi pendaftaran yang benar,
                  akurat, dan mutakhir.
                </li>
                <li>
                  <strong>Keamanan Akun:</strong> Anda bertanggung jawab penuh atas kerahasiaan kata sandi atau akun
                  autentikasi pihak ketiga (seperti Akun Google) serta seluruh aktivitas yang terjadi di bawah akun Anda.
                </li>
                <li>
                  <strong>Pemberitahuan Pelanggaran:</strong> Anda harus segera memberi tahu tim Purrific jika
                  mengetahui adanya akses tanpa izin atau pelanggaran keamanan pada akun Anda.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                3
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Hak Kekayaan Intelektual dan Kepemilikan Konten Pengguna
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                <strong>Hak Milik Pengguna:</strong> Anda memegang kepemilikan penuh dan hak kekayaan intelektual atas
                seluruh konten, teks, berkas, catatan, tugas, dan materi yang Anda buat atau unggah ke Purrific (&ldquo;Konten Pengguna&rdquo;).
                Purrific tidak mengklaim kepemilikan atas Konten Pengguna Anda.
              </p>
              <p>
                <strong>Lisensi Terbatas:</strong> Anda memberikan lisensi non-eksklusif dan bebas royalti kepada Purrific
                semata-mata untuk tujuan teknis dalam mengoperasikan, menyimpan, mentransmisikan, dan menampilkan konten
                sesuai konfigurasi dan instruksi Anda di platform.
              </p>
              <p>
                <strong>Hak Kekayaan Intelektual Purrific:</strong> Seluruh kode sumber, desain UI/UX, logo, basis data,
                dan materi grafis aplikasi Purrific adalah milik eksklusif Purrific dan dilindungi undang-undang hak cipta.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                4
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Batasan Penggunaan yang Sah
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Dalam menggunakan platform Purrific, Anda setuju untuk tidak:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-perrific-graphite/75">
                <li>Melakukan aktivitas yang melanggar hukum, regulasi privasi, atau peraturan perundang-undangan yang berlaku.</li>
                <li>Menyalahgunakan, mengganggu, atau merusak infrastruktur, server, atau jaringan backend Purrific.</li>
                <li>Mencoba memperoleh akses tanpa izin ke data atau akun pengguna lain.</li>
                <li>
                  Menggunakan bot, scraper, atau alat otomatis yang tidak diizinkan untuk mengikis data atau membebani sistem secara tidak wajar.
                </li>
                <li>Menyebarkan malware, trojan, atau konten berbahaya lainnya melalui lampiran atau catatan di Purrific.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                5
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Batasan Tanggung Jawab & Ketersediaan Layanan
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Purrific disediakan atas dasar <strong>&ldquo;sebagaimana adanya&rdquo; (as is)</strong> dan{' '}
                <strong>&ldquo;sebagaimana tersedia&rdquo; (as available)</strong>. Kami berupaya semaksimal mungkin
                untuk menjaga ketersediaan sistem dan keandalan fitur.
              </p>
              <p>
                Sejauh yang diizinkan oleh hukum yang berlaku, Purrific dan para pengembangnya tidak bertanggung jawab
                atas kerugian tidak langsung, insidental, atau hilangnya keuntungan maupun data yang disebabkan oleh
                gangguan koneksi pihak ketiga (termasuk kendala jaringan atau downtime API Google Calendar), kesalahan manusia,
                atau keadaan kahar (force majeure).
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                6
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Perubahan Ketentuan
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Kami berhak untuk mengubah atau memperbarui Syarat dan Ketentuan ini sewaktu-waktu. Kami akan memberi tahu
                pengguna mengenai perubahan material dengan memperbarui tanggal &ldquo;Terakhir diperbarui&rdquo; di bagian
                atas halaman ini atau melalui pemberitahuan dalam aplikasi. Penggunaan berkelanjutan Anda atas layanan
                setelah pembaruan tersebut berarti Anda menyetujui ketentuan yang diperbarui.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pt-6 border-t border-perrific-line/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-perrific-paper text-xs font-bold text-perrific-wood border border-perrific-line">
                7
              </span>
              <h2 className="font-space-grotesk text-xl font-bold text-perrific-graphite">
                Kontak & Bantuan
              </h2>
            </div>
            <div className="pl-9 space-y-3 text-sm leading-relaxed text-perrific-graphite/80">
              <p>
                Apabila Anda memiliki pertanyaan terkait Syarat dan Ketentuan Layanan ini, silakan hubungi kami di:
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
            <Link to="/privacy" className="hover:text-perrific-violet transition">
              Kebijakan Privasi
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
