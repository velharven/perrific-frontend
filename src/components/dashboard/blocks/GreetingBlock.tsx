import { greetingFor, type DashboardData } from '../useDashboardData';

export default function GreetingBlock({ data }: { data: DashboardData }) {
  return (
    <header>
      <h1 className="font-givonic text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-perrific-graphite sm:text-[32px]">
        {greetingFor(data.now.getHours())}, {data.userName}
      </h1>
      <p className="mt-1 font-givonic text-sm text-perrific-graphite/60">
        {data.todayLabel}
        {data.stats.total > 0 && (
          <>
            {' · '}
            {data.stats.completed} dari {data.stats.total} aktivitas selesai
          </>
        )}
      </p>
    </header>
  );
}
