import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActivityIcon, TABLE_COLUMN_LABELS, TAB_ICONS, TableColumnIcon } from '@/components/icons';
import type { TableColumnType } from '@/types';
import type { TableDataState } from './useTableData';

const TYPES: TableColumnType[] = ['TEXT', 'NUMBER', 'SELECT', 'DATE', 'CHECKBOX'];

// Menu pengaturan satu properti: ikon + nama, pemilih ikon, ganti jenis, hapus.
// Di-portal ke body dengan posisi fixed agar tak terpotong scroll tabel.
export default function ColumnMenu({
  t,
  columnId,
  x,
  y,
  onClose,
}: {
  t: TableDataState;
  columnId: string;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const index = t.columns.findIndex((c) => c.id === columnId);
  const col = index >= 0 ? t.columns[index] : undefined;
  const [iconOpen, setIconOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll(e: Event) {
      // Scroll di dalam menu (grid ikon) bukan alasan menutup.
      if (rootRef.current && rootRef.current.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  if (!col) return null;

  const customIcon = col.icon ?? null;
  const W = 256;
  const H = 400;
  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const top = y + H > window.innerHeight ? Math.max(8, y - H) : y;

  function pickIcon(icon: string | null) {
    t.changeColumn(index, { icon });
    t.flushNow();
    setIconOpen(false);
  }

  function pickType(type: TableColumnType) {
    if (type === col?.type) return;
    t.changeColumn(index, { type });
    t.flushNow();
  }

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label="Pengaturan properti"
      className="fixed z-50 w-64 overflow-visible rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
      style={{ left, top }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIconOpen((v) => !v)}
            title="Ganti ikon"
            aria-label="Ganti ikon"
            aria-expanded={iconOpen}
            aria-haspopup="menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite transition hover:bg-gray-100"
          >
            {customIcon ? <ActivityIcon name={customIcon} /> : <TableColumnIcon type={col.type} />}
          </button>
          {iconOpen && (
            <div
              role="menu"
              aria-label="Pilih ikon"
              className="absolute left-0 top-full z-10 mt-1 grid max-h-56 w-52 grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
            >
              <button
                type="button"
                onClick={() => pickIcon(null)}
                title="Ikuti jenis"
                aria-label="Ikuti jenis"
                aria-pressed={customIcon === null}
                className={`flex h-8 items-center justify-center rounded-lg transition hover:bg-gray-100 ${
                  customIcon === null ? 'bg-perrific-violet/10 text-perrific-violet' : 'text-gray-500'
                }`}
              >
                <TableColumnIcon type={col.type} />
              </button>
              {TAB_ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => pickIcon(ic.key)}
                  title={ic.label}
                  aria-label={ic.label}
                  aria-pressed={customIcon === ic.key}
                  className={`flex h-8 items-center justify-center rounded-lg transition hover:bg-gray-100 ${
                    customIcon === ic.key ? 'bg-perrific-violet/10 text-perrific-violet' : 'text-gray-500'
                  }`}
                >
                  <ActivityIcon name={ic.key} />
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={nameRef}
          value={col.name}
          onChange={(e) => t.changeColumn(index, { name: e.target.value })}
          onBlur={() => t.flushNow()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              t.flushNow();
              onClose();
            }
          }}
          maxLength={80}
          aria-label="Nama properti"
          placeholder="Nama properti"
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 font-givonic text-sm font-semibold text-perrific-graphite focus:bg-gray-50 focus:outline-none"
        />
      </div>
      <div className="h-px bg-gray-100" />
      <p className="px-3 pb-1 pt-2 font-mono text-[10px] tracking-widest text-perrific-graphite/40">
        JENIS PROPERTI
      </p>
      {TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="menuitemradio"
          aria-checked={col.type === type}
          onClick={() => pickType(type)}
          className="flex w-full items-center gap-2.5 px-3 py-2 font-givonic text-sm transition hover:bg-gray-50"
        >
          <TableColumnIcon type={type} className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-left font-medium text-perrific-graphite">
            {TABLE_COLUMN_LABELS[type]}
          </span>
          {col.type === type && (
            <span aria-hidden="true" className="shrink-0 font-bold text-perrific-violet">
              ✓
            </span>
          )}
        </button>
      ))}
      <div className="h-px bg-gray-100" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          t.removeColumn(col.id);
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 font-givonic text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Hapus properti
      </button>
    </div>,
    document.body,
  );
}
