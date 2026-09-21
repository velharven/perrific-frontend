export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4">
      <div className="h-9 w-2/3 rounded-lg bg-gray-200" />
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="h-4 w-1/4 rounded bg-gray-200" />
        <div className="mt-3 h-2 w-full rounded-full bg-gray-200" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="mt-3 space-y-2">
          <div className="h-10 rounded-lg bg-gray-100" />
          <div className="h-10 rounded-lg bg-gray-100" />
          <div className="h-10 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
