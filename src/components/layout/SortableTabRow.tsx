import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Pembungkus baris tab agar bisa di-seret (drag-and-drop) untuk mengubah urutan.
 * Seluruh baris jadi area drag; sensor hanya aktif setelah ambang gerak/waktu
 * sehingga klik, double-click, dan klik kanan tetap berfungsi normal.
 */
export default function SortableTabRow({
  id,
  as = 'div',
  disabled = false,
  className = '',
  children,
}: {
  id: string;
  as?: 'div' | 'li';
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const verticalTransform = transform ? { ...transform, x: 0 } : null;
  const style: CSSProperties = {
    transform: CSS.Translate.toString(verticalTransform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
  };
  const interactiveProps = disabled ? {} : listeners;
  const cls = `w-full ${disabled ? className : `${className} cursor-grab active:cursor-grabbing`}`;
  if (as === 'li') {
    return (
      <li ref={setNodeRef} style={style} className={cls} {...interactiveProps}>
        {children}
      </li>
    );
  }
  return (
    <div ref={setNodeRef} style={style} className={cls} {...interactiveProps}>
      {children}
    </div>
  );
}
