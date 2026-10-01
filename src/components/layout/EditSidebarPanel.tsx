import { useEffect, useState, useRef } from 'react';
import {
  X,
  Check,
  ArrowLeft,
  Plus,
  GripVertical,
  FileText,
  Users,
  Building2,
  Star,
  Link2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import SortableTabRow from './SortableTabRow';
import type { SidebarSection, PresetSection } from '@/hooks/useNavLabels';

interface EditSidebarPanelProps {
  open: boolean;
  onClose: () => void;
  sectionOrder: SidebarSection[];
  presetSections: PresetSection[];
  onReorderSections: (activeId: SidebarSection, overId: SidebarSection) => void;
  onAddPreset: (id: PresetSection) => void;
  onRemovePreset: (id: PresetSection) => void;
  sectionLabel: (s: string) => string;
}

export default function EditSidebarPanel({
  open,
  onClose,
  sectionOrder,
  presetSections,
  onReorderSections,
  onAddPreset,
  onRemovePreset,
  sectionLabel,
}: EditSidebarPanelProps) {
  const [editView, setEditView] = useState<'main' | 'preset'>('main');
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset view saat panel dibuka
  useEffect(() => {
    if (open) {
      setEditView('main');
    }
  }, [open]);

  // Listener tombol Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editView === 'preset') {
          setEditView('main');
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, editView]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sectionIds = sectionOrder.map((s) => `section:${s}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sectionIds.indexOf(String(active.id));
    const newIndex = sectionIds.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      const activeSection = sectionOrder[oldIndex];
      const overSection = sectionOrder[newIndex];
      onReorderSections(activeSection, overSection);
    }
  }


  const presets = [
    {
      id: 'privat',
      name: 'Privat',
      desc: 'Tab pribadi: harian, note',
      icon: <FileText size={15} strokeWidth={1.6} />,
      iconClass: 'bg-perrific-violet/10 text-perrific-violet',
    },
    {
      id: 'teams',
      name: 'Tim Saya',
      desc: 'Tim dan proyekmu',
      icon: <Users size={15} strokeWidth={1.6} />,
      iconClass: 'bg-green-600/10 text-green-700',
    },
    {
      id: 'organisasi',
      name: 'Organisasi',
      desc: 'Kolaborasi dan delegasi antar-tim',
      icon: <Building2 size={15} strokeWidth={1.6} />,
      iconClass: 'bg-blue-600/10 text-blue-600',
    },
    {
      id: 'favorit',
      name: 'Favorit',
      desc: 'Tab berbintang pilihanmu',
      icon: <Star size={15} className="fill-amber-500 text-amber-500" strokeWidth={1.6} />,
      iconClass: 'bg-amber-100 text-amber-500',
    },
    {
      id: 'shortcut',
      name: 'Shortcut',
      desc: 'Pintas ke halaman',
      icon: <Link2 size={15} strokeWidth={1.6} />,
      iconClass: 'bg-sky-100 text-sky-600',
    },
  ] as const;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Panel Edit Sidebar"
      className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-[340px] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[360px] ${
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      }`}
    >
      {/* Header Panel */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5">
        {editView === 'preset' ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditView('main')}
                aria-label="Kembali ke urutan bagian"
                title="Kembali"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <h2 className="font-givonic text-sm font-bold text-perrific-graphite">
                Tambah Bagian
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Tutup"
              aria-label="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                title="Tutup edit sidebar"
                aria-label="Tutup edit sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <h2 className="font-givonic text-sm font-bold text-perrific-graphite">
                Edit Sidebar
              </h2>
            </div>

            {/* Tombol Selesai di pojok kanan atas */}
            <button
              type="button"
              onClick={onClose}
              title="Selesai mengedit sidebar"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-givonic text-xs font-semibold text-perrific-violet transition hover:bg-perrific-violet/10"
            >
              <Check size={14} strokeWidth={1.8} aria-hidden="true" />
              <span>Selesai</span>
            </button>
          </>
        )}
      </div>

      {/* Konten Panel */}
      <div className="nice-scroll flex-1 overflow-y-auto p-3">
        {editView === 'preset' ? (
          <div className="space-y-1" aria-label="Pilih bagian baru">
            {presets.map((p) => {
              const isActive = presetSections.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="flex w-full items-center gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-gray-50"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${p.iconClass}`}
                  >
                    {p.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-givonic text-sm font-semibold text-perrific-graphite">
                      {p.name}
                    </span>
                    <span className="block truncate font-givonic text-xs text-perrific-graphite/50">
                      {p.desc}
                    </span>
                  </span>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => onRemovePreset(p.id)}
                      aria-label={`Hapus bagian ${p.name}`}
                      className="shrink-0 rounded-full border border-red-200 px-3 py-1 font-givonic text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddPreset(p.id)}
                      aria-label={`Tambah bagian ${p.name}`}
                      className="shrink-0 rounded-full bg-perrific-violet px-3 py-1 font-givonic text-xs font-semibold text-white transition hover:bg-perrific-red"
                    >
                      Tambah
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="px-1 font-givonic text-xs text-perrific-graphite/50">
              Tarik dan geser untuk mengatur urutan bagian sidebar.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5" aria-label="Urutan bagian sidebar">
                  {sectionOrder.map((s) => (
                    <SortableTabRow
                      key={`section:${s}`}
                      id={`section:${s}`}
                      className="flex cursor-grab items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition hover:border-gray-200 hover:bg-gray-50 active:cursor-grabbing"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 shrink-0 items-center justify-center text-perrific-graphite/40"
                      >
                        <GripVertical size={15} strokeWidth={1.6} />
                      </span>
                      <span className="font-mono text-xs font-medium tracking-wider text-perrific-graphite">
                        {sectionLabel(s)}
                      </span>
                    </SortableTabRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={() => setEditView('preset')}
              title="Tambah bagian baru"
              aria-label="Tambah bagian baru"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-3 font-givonic text-xs font-semibold text-perrific-graphite/70 transition hover:border-perrific-violet hover:bg-perrific-violet/5 hover:text-perrific-violet"
            >
              <Plus size={15} strokeWidth={1.8} />
              <span>Bagian baru</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
