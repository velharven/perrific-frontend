export default function PersonaSection() {
  return (
    <section id="persona" className="bg-perrific-paper">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-givonic text-[26px] font-extrabold tracking-[-0.03em] text-perrific-graphite sm:text-[30px]">Untuk Tim Yang Ingin Gerak Cepat.</h2>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-perrific-line bg-white p-5">
            <p className="font-mono text-[11px] tracking-widest text-perrific-wood">KETUA</p>
            <p className="mt-2 font-givonic text-sm font-bold text-perrific-graphite">Nggak Perlu Nagih.</p>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Progres terlihat tanpa chat tiap jam.</p>
          </div>
          <div className="rounded-2xl bg-perrific-graphite p-5 text-white">
            <p className="font-mono text-[11px] tracking-widest text-white/60">ANGGOTA</p>
            <p className="mt-2 font-givonic text-sm font-bold">Bangun Tidur, Jadwal Ada.</p>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-white/60">Tugas sudah jadi time-block.</p>
          </div>
          <div className="rounded-2xl border border-perrific-line bg-white p-5">
            <p className="font-mono text-[11px] tracking-widest text-perrific-wood">TIM KECIL</p>
            <p className="mt-2 font-givonic text-sm font-bold text-perrific-graphite">Tanpa Setup 2 Jam.</p>
            <p className="mt-1 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Buka langsung pakai, untuk 3–6 orang.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
