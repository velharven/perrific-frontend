export default function SolutionSection() {
  return (
    <section id="fitur" className="bg-perrific-paper">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-givonic text-[26px] font-extrabold leading-[0.95] tracking-[-0.03em] text-perrific-graphite sm:text-[32px]">
            Semua Yang Perlu, Tidak Lebih.
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] font-givonic text-sm leading-relaxed text-perrific-graphite/60">
            Empat hal inti — sisanya mengikuti tanpa kamu atur manual.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-perrific-line bg-white p-5">
            <h3 className="font-givonic text-sm font-bold text-perrific-graphite">Board</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Tugas di To Do / Doing / Done — geser ringan, tanpa loading.</p>
          </div>
          <div className="rounded-2xl border border-perrific-line bg-white p-5">
            <h3 className="font-givonic text-sm font-bold text-perrific-graphite">Harian</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Checklist & time-block per hari, sudah terisi dari board.</p>
          </div>
          <div className="rounded-2xl bg-perrific-violet p-5 text-white">
            <h3 className="font-givonic text-sm font-bold">Sinkron Otomatis</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-white/75">Tugas ditugaskan langsung jadi jadwal. Tanpa Zapier, tanpa copy-paste.</p>
          </div>
          <div className="rounded-2xl border border-perrific-line bg-white p-5">
            <h3 className="font-givonic text-sm font-bold text-perrific-graphite">Pengingat</h3>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Deadline & progres harian — tetap sinkron.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
