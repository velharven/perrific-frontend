import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DropIndicator from './DropIndicator';

type UseSortableReturn = ReturnType<typeof useSortable>;

export type SectionHandle = Pick<UseSortableReturn, 'setActivatorNodeRef' | 'attributes' | 'listeners'>;

/**
 * Pembungkus blok section sidebar (PRIVAT / TIM SAYA) agar urutannya bisa
 * diseret. Seluruh baris header jadi area drag; tombol lipat, tombol tambah,
 * link, dan drag item di dalamnya tetap berfungsi normal karena drag baru
 * aktif setelah ambang gerak sensor.
 */
export default function SortableSection({
  id,
  disabled = false,
  order = 0,
  settle = true,
  dropHint = null,
  children,
}: {
  id: string;
  disabled?: boolean;
  order?: number;
  settle?: boolean;
  dropHint?: 'before' | 'after' | null;
  children: (handle: SectionHandle) => ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, isDragging } =
    useSortable({ id, disabled });
  const style: CSSProperties = {
    // Saat settle dimatikan (snap instan), tampil statis di slot akhir
    // tanpa meluncur.
    transform: settle ? CSS.Transform.toString(transform) : undefined,
    // Tanpa transisi saat dragging (1:1 dengan pointer) dan saat settle mati
    // (snap instan); selebihnya luncuran 300ms.
    transition:
      isDragging || !settle
        ? undefined
        : 'opacity 150ms ease, transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
    // Blok asli di sidebar dibuat semi-transparan saat diseret sebagai placeholder ghost
    opacity: isDragging ? 0.4 : undefined,
    order,
  };
  // Garis oranye penanda posisi drop.
  const line = <DropIndicator />;
  return (
    <div ref={setNodeRef} style={style}>
      {dropHint === 'before' ? line : null}
      {children({ setActivatorNodeRef, attributes, listeners })}
      {dropHint === 'after' ? line : null}
    </div>
  );
}
