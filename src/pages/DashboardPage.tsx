import DashboardBlockView from '@/components/dashboard/DashboardBlockView';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { BLOCK_ORDER } from '@/components/dashboard/layout';
import { useDashboardData } from '@/components/dashboard/useDashboardData';

// Tampilan bawaan (susunan tetap). Kamar dashboard (/dashboard/:id)
// memakai susunan custom via DashboardInstancePage.
export default function DashboardPage() {
  const data = useDashboardData();

  if (data.loading) return <DashboardSkeleton />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {BLOCK_ORDER.map((type) => (
        <DashboardBlockView key={type} type={type} data={data} />
      ))}
    </div>
  );
}
