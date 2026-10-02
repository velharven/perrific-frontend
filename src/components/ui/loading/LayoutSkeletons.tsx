import Skeleton from './Skeleton';

export function DocumentSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-3xl space-y-6 pt-4 animate-fadeIn">
      {/* Cover / Icon placeholder */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" rounded="lg" />
        <Skeleton className="h-5 w-32" rounded="md" />
      </div>
      {/* Title */}
      <Skeleton className="h-10 w-3/5" rounded="lg" />
      {/* Metadata bar */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" rounded="md" />
        <Skeleton className="h-4 w-20" rounded="md" />
      </div>
      {/* Content blocks */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-full" rounded="md" />
        <Skeleton className="h-4 w-11/12" rounded="md" />
        <Skeleton className="h-4 w-4/5" rounded="md" />
      </div>
      <div className="space-y-3 pt-3">
        <Skeleton className="h-4 w-full" rounded="md" />
        <Skeleton className="h-4 w-5/6" rounded="md" />
        <Skeleton className="h-4 w-3/4" rounded="md" />
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div role="status" aria-busy="true" className="w-full space-y-6 pt-2 animate-fadeIn">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-44" rounded="lg" />
          <Skeleton className="h-8 w-24" rounded="lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" rounded="lg" />
          <Skeleton className="h-8 w-24" rounded="lg" />
        </div>
      </div>

      {/* Board Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3].map((col) => (
          <div key={col} className="w-[85vw] shrink-0 rounded-2xl bg-stone-100/80 p-3 sm:w-80 space-y-3">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-5 w-24" rounded="md" />
              <Skeleton className="h-5 w-6" rounded="full" />
            </div>
            <div className="space-y-2.5">
              <div className="rounded-xl bg-white p-3 shadow-sm space-y-2">
                <Skeleton className="h-4 w-4/5" rounded="md" />
                <Skeleton className="h-3 w-1/2" rounded="sm" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-14" rounded="full" />
                  <Skeleton className="h-5 w-5" rounded="full" />
                </div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm space-y-2">
                <Skeleton className="h-4 w-3/5" rounded="md" />
                <Skeleton className="h-3 w-2/3" rounded="sm" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-16" rounded="full" />
                  <Skeleton className="h-5 w-5" rounded="full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div role="status" aria-busy="true" className="w-full space-y-4 pt-2 animate-fadeIn">
      {/* Table toolbar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" rounded="lg" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" rounded="lg" />
          <Skeleton className="h-8 w-20" rounded="lg" />
        </div>
      </div>

      {/* Table border grid */}
      <div className="overflow-hidden rounded-xl border border-stone-200/80 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 border-b border-stone-200/80 bg-stone-50/70 p-3.5">
          <Skeleton className="h-4 w-28" rounded="md" />
          <Skeleton className="h-4 w-20" rounded="md" />
          <Skeleton className="h-4 w-24" rounded="md" />
          <Skeleton className="h-4 w-16" rounded="md" />
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid grid-cols-4 items-center gap-4 border-b border-stone-100 p-3.5 last:border-none">
            <Skeleton className="h-4 w-3/4" rounded="md" />
            <Skeleton className="h-4 w-1/2" rounded="md" />
            <Skeleton className="h-4 w-2/3" rounded="md" />
            <Skeleton className="h-4 w-1/3" rounded="md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListCardsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-5xl space-y-6 pt-2 animate-fadeIn">
      {/* Header section */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14" rounded="xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" rounded="lg" />
          <Skeleton className="h-4 w-32" rounded="md" />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" rounded="md" />
              <Skeleton className="h-5 w-5" rounded="full" />
            </div>
            <Skeleton className="h-3.5 w-full" rounded="sm" />
            <Skeleton className="h-3.5 w-4/5" rounded="sm" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-20" rounded="md" />
              <Skeleton className="h-6 w-16" rounded="full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSettingsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-3xl space-y-6 pt-2 animate-fadeIn">
      <div>
        <Skeleton className="h-7 w-40" rounded="lg" />
        <Skeleton className="mt-1 h-4 w-60" rounded="md" />
      </div>

      <div className="space-y-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" rounded="md" />
          <Skeleton className="h-9 w-full" rounded="lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" rounded="md" />
          <Skeleton className="h-20 w-full" rounded="lg" />
        </div>
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-28" rounded="lg" />
        </div>
      </div>
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="w-full space-y-6 pt-2 animate-fadeIn">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" rounded="md" />
        <Skeleton className="h-4 w-4" rounded="sm" />
        <Skeleton className="h-4 w-36" rounded="md" />
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_240px]">
        {/* Main Content */}
        <div className="space-y-5">
          <Skeleton className="h-8 w-3/4" rounded="lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" rounded="md" />
            <Skeleton className="h-28 w-full" rounded="xl" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-5 w-28" rounded="md" />
            <Skeleton className="h-10 w-full" rounded="lg" />
            <Skeleton className="h-10 w-full" rounded="lg" />
          </div>
        </div>

        {/* Sidebar attributes */}
        <div className="space-y-4 rounded-xl border border-stone-200/80 bg-stone-50/50 p-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" rounded="sm" />
            <Skeleton className="h-7 w-full" rounded="md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" rounded="sm" />
            <Skeleton className="h-7 w-full" rounded="md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" rounded="sm" />
            <Skeleton className="h-7 w-full" rounded="md" />
          </div>
        </div>
      </div>
    </div>
  );
}
