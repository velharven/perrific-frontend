import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Sel header properti yang bisa diseret seluruhnya untuk mengubah urutan kolom.
 * Elemen interaktif di dalamnya (input nama, tombol ×) menghentikan
 * pointerdown sendiri (di TableGrid) sehingga ketik/seleksi/klik tetap normal.
 */
export default function SortableTh({
  id,
  disabled = false,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };
  const interactiveProps = disabled ? {} : { ...attributes, ...listeners };
  return (
    <th
      ref={setNodeRef}
      style={style}
      title="Klik untuk mengatur • Seret untuk memindahkan"
      className={`group min-w-[170px] border-b border-l border-gray-200 p-2 text-left align-top ${
        disabled ? '' : 'cursor-grab active:cursor-grabbing'
      }`}
      {...interactiveProps}
    >
      <div className="flex items-center gap-1">{children}</div>
    </th>
  );
}
