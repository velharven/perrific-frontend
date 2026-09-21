import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_LABELS, type DashboardBlockDef } from './layout';

// Baris blok yang selalu bisa diatur (tanpa mode edit): gagang seret tipis
// selalu terlihat, tombol aksi muncul saat hover (dipaksa terlihat di layar
// sentuh yang tidak punya hover). Drag hanya dari gagangnya agar
// checkbox/link di dalam blok tetap bisa diklik.
export default function SortableBlock({
  block,
  onHide,
  onRemove,
  children,
}: {
  block: DashboardBlockDef;
  onHide: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="mb-1.5 flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          title={`Seret blok ${BLOCK_LABELS[block.type]}`}
          aria-label={`Seret blok ${BLOCK_LABELS[block.type]}`}
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-perrific-graphite/30 opacity-40 transition hover:bg-gray-100 hover:text-perrific-violet hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
            <circle cx="3" cy="2.5" r="1.2" fill="currentColor" />
            <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
            <circle cx="3" cy="7" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7" r="1.2" fill="currentColor" />
            <circle cx="3" cy="11.5" r="1.2" fill="currentColor" />
            <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
          </svg>
        </button>
        <span className="font-mono text-[10px] tracking-widest text-perrific-graphite/40">
          {BLOCK_LABELS[block.type].toUpperCase()}
        </span>
        <span className="flex-1" />
        <div className="flex items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <button
            type="button"
            onClick={onHide}
            className="rounded-md px-2 py-1 font-givonic text-[11px] font-semibold text-perrific-graphite/50 transition hover:bg-gray-100 hover:text-perrific-graphite"
          >
            Sembunyikan
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Hapus blok ${BLOCK_LABELS[block.type]}`}
            className="rounded-md px-2 py-1 font-givonic text-[11px] font-semibold text-red-500 transition hover:bg-red-50"
          >
            Hapus
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
