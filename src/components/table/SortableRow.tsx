import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Baris tabel yang bisa diseret via handle titik-titik di gutter kiri (id `row:<id>`).
 * Satu useSortable per baris; isi gutter lain (checkbox, +) dioper sebagai node.
 */
const SortableRow = forwardRef<
  HTMLTableRowElement,
  {
    id: string;
    disabled?: boolean;
    className?: string;
    gutter?: ReactNode;
    beforeGrip?: ReactNode;
    children: ReactNode;
  }
>(function SortableRow({ id, disabled = false, className = '', gutter, beforeGrip, children }, ref) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };
  function setRefs(el: HTMLTableRowElement | null) {
    setNodeRef(el);
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }
  return (
    <tr ref={setRefs} style={style} className={className}>
      <td className="relative w-10 whitespace-nowrap border-b border-gray-200 p-1">
        <span className="flex items-center justify-center">
          {beforeGrip}
          {!disabled && (
            <span
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              role="button"
              tabIndex={0}
              title="Seret untuk memindahkan baris"
              aria-label="Seret untuk memindahkan baris"
              className="absolute left-[-20px] top-1/2 -translate-y-1/2 cursor-grab touch-none px-0.5 text-gray-300 opacity-0 transition hover:text-gray-500 focus:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 active:cursor-grabbing max-sm:opacity-100"
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
                <circle cx="3" cy="2.5" r="1.3" fill="currentColor" />
                <circle cx="7" cy="2.5" r="1.3" fill="currentColor" />
                <circle cx="3" cy="7" r="1.3" fill="currentColor" />
                <circle cx="7" cy="7" r="1.3" fill="currentColor" />
                <circle cx="3" cy="11.5" r="1.3" fill="currentColor" />
                <circle cx="7" cy="11.5" r="1.3" fill="currentColor" />
              </svg>
            </span>
          )}
          {gutter}
        </span>
      </td>
      {children}
    </tr>
  );
});

export default SortableRow;
