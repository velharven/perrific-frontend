import type { DashboardData } from '../useDashboardData';

export default function ProgressBlock({ data }: { data: DashboardData }) {
  const { stats } = data;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-givonic text-sm font-bold text-perrific-graphite">Progres hari ini</h2>
        <span className="font-mono text-xs text-perrific-graphite/50">{stats.progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-perrific-violet transition-all"
          style={{ width: `${stats.progress}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-gray-50 px-2 py-2.5">
          <p className="font-givonic text-lg font-extrabold text-perrific-graphite">{stats.total}</p>
          <p className="font-mono text-[11px] text-perrific-graphite/50">Total</p>
        </div>
        <div className="rounded-lg bg-green-50 px-2 py-2.5">
          <p className="font-givonic text-lg font-extrabold text-green-700">{stats.completed}</p>
          <p className="font-mono text-[11px] text-green-700/70">Selesai</p>
        </div>
        <div className="rounded-lg bg-perrific-paper px-2 py-2.5">
          <p className="font-givonic text-lg font-extrabold text-perrific-graphite">{stats.pending}</p>
          <p className="font-mono text-[11px] text-perrific-graphite/50">Tersisa</p>
        </div>
      </div>
    </section>
  );
}
