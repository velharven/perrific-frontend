import { useState, useRef, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import MenuPortal from '@/components/ui/MenuPortal';
import { TableColumnIcon, SearchIcon, CloseIcon, CheckIcon } from '@/components/icons';
import { useTeamPeople } from '@/hooks/useTeamPeople';

interface PersonCellProps {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  ariaLabel?: string;
}

export default function PersonCell({ value, onChange, ariaLabel }: PersonCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);

  const { people, loading } = useTeamPeople();

  const rawStr = typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : '';

  // Cocokkan orang dari list untuk mendapatkan avatar (jika ada)
  const matchedPerson = people.find((p) => p.name.toLowerCase() === rawStr.toLowerCase());

  // Filter pencarian dan batasi hanya 3 orang saja dengan diri sendiri di urutan teratas
  const q = search.trim().toLowerCase();
  const displayList = (!q
    ? people
    : people.filter((p) => p.name.toLowerCase().includes(q))
  ).slice(0, 3);

  const hasCustomMatch = Boolean(
    q && !displayList.some((p) => p.name.toLowerCase() === q),
  );

  // Reset kata kunci pencarian saat menu dibuka / ditutup
  useEffect(() => {
    if (isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  function handleSelect(name: string | null) {
    onChange(name);
    setIsOpen(false);
  }

  return (
    <div
      ref={triggerRef}
      className="group/person relative flex w-full min-w-0 items-center justify-between gap-1"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={ariaLabel || 'Pilih orang'}
        title={rawStr ? `${rawStr} — klik untuk ganti` : 'Pilih orang'}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs transition hover:bg-gray-100"
      >
        <TableColumnIcon type="PERSON" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        {rawStr ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <Avatar
              src={matchedPerson?.avatarUrl}
              name={rawStr}
              size={18}
              className="h-4.5 w-4.5 shrink-0 text-[8px]"
            />
            <span className="truncate text-xs font-medium text-gray-800">{rawStr}</span>
          </div>
        ) : (
          <span className="truncate text-xs text-gray-300">Pilih orang...</span>
        )}
      </button>

      {rawStr && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          title="Hapus orang"
          aria-label="Hapus orang"
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-200/80 hover:text-gray-700 group-hover/person:opacity-100 focus:opacity-100"
        >
          <CloseIcon className="h-3 w-3" />
        </button>
      )}

      {isOpen && (
        <MenuPortal
          anchorRef={triggerRef}
          label="Pilih orang"
          width={240}
          estimatedHeight={190}
          onClose={() => setIsOpen(false)}
        >
          {/* Searchbar di bagian atas menu */}
          <div className="border-b border-gray-100 p-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/60 px-2 py-1 transition focus-within:border-perrific-violet focus-within:bg-white focus-within:ring-1 focus-within:ring-perrific-violet">
              <SearchIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  } else if (e.key === 'Enter') {
                    if (displayList.length > 0) {
                      handleSelect(displayList[0].name);
                    } else if (search.trim()) {
                      handleSelect(search.trim());
                    }
                  }
                }}
                placeholder="Cari orang..."
                aria-label="Cari orang"
                className="w-full bg-transparent text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Hapus pencarian"
                  className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* List Orang: maksimal 3 orang dengan diri sendiri di urutan teratas */}
          <div className="p-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Anggota Tim
            </div>
            {displayList.map((p) => {
              const isSelected = p.name.toLowerCase() === rawStr.toLowerCase();
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.name)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                    isSelected
                      ? 'bg-orange-50 font-medium text-orange-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Avatar
                    src={p.avatarUrl}
                    name={p.name}
                    size={22}
                    className="h-5.5 w-5.5 shrink-0 text-[9px]"
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.isMe && (
                    <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                      Anda
                    </span>
                  )}
                  {isSelected && (
                    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-orange-600" />
                  )}
                </button>
              );
            })}

            {hasCustomMatch && (
              <button
                type="button"
                onClick={() => handleSelect(search.trim())}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
              >
                <TableColumnIcon type="PERSON" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-gray-600">
                  Gunakan <span className="font-semibold text-gray-800">"{search.trim()}"</span>
                </span>
              </button>
            )}

            {displayList.length === 0 && !hasCustomMatch && (
              <div className="px-3 py-2 text-center text-xs text-gray-400">
                {loading ? 'Memuat anggota...' : 'Tidak ada anggota ditemukan'}
              </div>
            )}
          </div>

          {/* Opsi kosongkan bidang bila sudah ada nilai */}
          {rawStr && (
            <div className="border-t border-gray-100 p-1">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-rose-600 transition hover:bg-rose-50"
              >
                <CloseIcon className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                <span>Kosongkan bidang</span>
              </button>
            </div>
          )}
        </MenuPortal>
      )}
    </div>
  );
}
