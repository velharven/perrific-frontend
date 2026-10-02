import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ActivityIcon,
  PROPERTY_COLUMNS_LEFT,
  PROPERTY_COLUMNS_RIGHT,
  TAB_ICONS,
  TableColumnIcon,
} from '@/components/icons';
import type { TableColumnType } from '@/types';
import type { TableDataState } from './useTableData';

// Menu pengaturan satu properti: ikon + nama, pemilih ikon, ganti jenis (2 kolom ala Notion), hapus.
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
  const W = 320;
  const H = 380;
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
      className="fixed z-50 w-80 overflow-visible rounded-2xl border border-gray-200 bg-white py-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
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
          className="min-w-0 flex-1 rounded-xl bg-gray-100/80 px-2.5 py-1.5 font-manrope text-sm font-semibold text-perrific-graphite focus:bg-gray-100 focus:outline-none"
        />
      </div>

      <div className="h-px bg-gray-100" />

      {/* Header: Pilih jenis */}
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <p className="font-manrope text-xs font-semibold text-gray-500">
          Pilih jenis
        </p>
      </div>

      {/* Grid 2 Kolom ala Notion */}
      <div className="grid grid-cols-2 gap-x-2 px-2 py-1">
        {/* Kolom Kiri: Teks, Status, Orang, Telepon */}
        <div className="flex flex-col gap-0.5">
          {PROPERTY_COLUMNS_LEFT.map((typeItem) => {
            const isCurrent = col.type === typeItem.type;
            return (
              <button
                key={typeItem.type}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                onClick={() => pickType(typeItem.type)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-manrope text-xs transition ${
                  isCurrent
                    ? 'bg-perrific-violet/10 font-semibold text-perrific-violet'
                    : 'text-perrific-graphite hover:bg-gray-50'
                }`}
              >
                <TableColumnIcon
                  type={typeItem.type}
                  className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-perrific-violet' : 'text-gray-400'}`}
                />
                <span className="truncate text-left">{typeItem.label}</span>
                {isCurrent && (
                  <span aria-hidden="true" className="ml-auto shrink-0 font-bold text-perrific-violet">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Kolom Kanan: Angka, Tanggal, File & media, URL, Email */}
        <div className="flex flex-col gap-0.5">
          {PROPERTY_COLUMNS_RIGHT.map((typeItem) => {
            const isCurrent = col.type === typeItem.type;
            return (
              <button
                key={typeItem.type}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                onClick={() => pickType(typeItem.type)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-manrope text-xs transition ${
                  isCurrent
                    ? 'bg-perrific-violet/10 font-semibold text-perrific-violet'
                    : 'text-perrific-graphite hover:bg-gray-50'
                }`}
              >
                <TableColumnIcon
                  type={typeItem.type}
                  className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-perrific-violet' : 'text-gray-400'}`}
                />
                <span className="truncate text-left">{typeItem.label}</span>
                {isCurrent && (
                  <span aria-hidden="true" className="ml-auto shrink-0 font-bold text-perrific-violet">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-100" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          t.removeColumn(col.id);
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 font-manrope text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        Hapus properti
      </button>
    </div>,
    document.body,
  );
}
