import { Link } from 'react-router-dom';
import { ActivityIcon, CalendarIcon } from '@/components/icons';
import { formatTime, type DashboardData } from '../useDashboardData';

export default function TodayBlock({ data }: { data: DashboardData }) {
  const { today, togglingId, handleToggle } = data;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-givonic text-sm font-bold text-perrific-graphite">Hari ini</h2>
        <Link to="/daily" className="font-givonic text-xs font-semibold text-perrific-violet hover:underline">
          Buka di Harian →
        </Link>
      </div>
      {today.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center">
          <CalendarIcon className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 font-givonic text-sm text-perrific-graphite/60">Belum ada aktivitas hari ini</p>
          <Link to="/daily" className="mt-1 inline-block font-givonic text-xs font-semibold text-perrific-violet hover:underline">
            + Tambah aktivitas pertama
          </Link>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {today.slice(0, 6).map((a) => {
            const done = a.status === 'COMPLETED';
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={done ? `Tandai belum selesai: ${a.title}` : `Tandai selesai: ${a.title}`}
                  disabled={togglingId === a.id}
                  onClick={() => handleToggle(a)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    done
                      ? 'border-perrific-violet bg-perrific-violet text-white'
                      : 'border-gray-300 bg-white hover:border-perrific-violet'
                  } disabled:opacity-50`}
                >
                  {done && (
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 8l2.5 2.5L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate font-givonic text-sm ${
                    done ? 'text-perrific-graphite/40 line-through' : 'text-perrific-graphite'
                  }`}
                >
                  {a.icon ? <ActivityIcon name={a.icon} className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 align-[-2px] text-gray-400" /> : null}{a.title}
                </span>
                {a.startTime && (
                  <span className="shrink-0 font-mono text-[11px] text-perrific-graphite/50">
                    {formatTime(a.startTime)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {today.length > 6 && (
        <Link to="/daily" className="mt-2 block font-givonic text-xs text-perrific-graphite/50 hover:text-perrific-graphite">
          + {today.length - 6} lainnya di Harian
        </Link>
      )}
    </section>
  );
}
