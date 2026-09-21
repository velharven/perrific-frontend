import { ActivityIcon, CheckCircleIcon } from '@/components/icons';
import { formatTime, type DashboardData } from '../useDashboardData';

export default function FocusBlock({ data }: { data: DashboardData }) {
  const { nextUp, stats } = data;
  if (nextUp) {
    return (
      <div className="flex gap-3 rounded-xl border border-perrific-line bg-perrific-paper p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-perrific-violet/10">
          <ActivityIcon name="target" className="h-4 w-4 text-perrific-violet" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-widest text-perrific-wood">FOKUS BERIKUTNYA</p>
          <p className="mt-0.5 truncate font-givonic text-sm font-semibold text-perrific-graphite">
            {nextUp.icon ? <ActivityIcon name={nextUp.icon} className="mr-1 inline-block h-3.5 w-3.5 align-[-2px] text-perrific-violet" /> : null}{nextUp.title}
            {nextUp.startTime && (
              <span className="ml-2 rounded-full bg-perrific-violet px-2 py-0.5 font-mono text-[11px] font-medium text-white">
                {formatTime(nextUp.startTime)}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }
  if (stats.total > 0) {
    return (
      <div className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600" />
        <p className="font-givonic text-sm text-green-800">
          Semua aktivitas hari ini selesai. Nikmati harimu!
        </p>
      </div>
    );
  }
  return null;
}
