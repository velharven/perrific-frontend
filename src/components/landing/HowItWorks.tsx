export default function HowItWorks() {
  return (
    <section id="cara-kerja" className="bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-givonic text-[26px] font-extrabold leading-[0.95] tracking-[-0.03em] text-perrific-graphite sm:text-[32px]">
            Tiga Ketukan.
          </h2>
          <p className="mt-3 font-givonic text-sm leading-relaxed text-perrific-graphite/60">Tidak perlu tutorial — buat, tugaskan, lihat.</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-perrific-line bg-perrific-paper p-5 text-center">
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white font-mono text-xs font-bold text-perrific-graphite">01</span>
            <h3 className="mt-3 font-givonic text-sm font-bold text-perrific-graphite">Buat Board</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Tim & proyek dalam 2 menit.</p>
          </div>
          <div className="rounded-2xl bg-perrific-violet p-5 text-center text-white">
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white font-mono text-xs font-bold text-perrific-violet">02</span>
            <h3 className="mt-3 font-givonic text-sm font-bold">Tugaskan</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-white/75">Otomatis jadi jadwal mereka.</p>
          </div>
          <div className="rounded-2xl border border-perrific-line bg-perrific-paper p-5 text-center">
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white font-mono text-xs font-bold text-perrific-graphite">03</span>
            <h3 className="mt-3 font-givonic text-sm font-bold text-perrific-graphite">Lihat Di Harian</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Centang & atur jam.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
