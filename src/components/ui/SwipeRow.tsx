import { useRef, useState } from 'react';

export interface SwipeAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const ACTION_WIDTH = 76;

// Baris yang bisa digeser ke kiri (sentuh/mouse) untuk memunculkan aksi.
// Dibuat generik agar dipakai feed, anggota tim, dan tugas saya.
export default function SwipeRow({
  actions,
  contentClassName = '',
  children,
}: {
  actions: SwipeAction[];
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const width = actions.length * ACTION_WIDTH;

  const content = (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
      className={`relative bg-white ${contentClassName} ${dragging ? '' : 'transition-transform duration-150'}`}
    >
      {children}
    </div>
  );

  if (actions.length === 0) return content;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (!moved.current) {
      // Geser vertikal = scroll halaman, abaikan.
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) {
        start.current = null;
        return;
      }
      if (Math.abs(ddx) < 8) return;
      moved.current = true;
      setDragging(true);
    }
    const base = open ? -width : 0;
    setDx(Math.max(-width, Math.min(0, base + ddx)));
  }

  function endDrag() {
    if (!start.current && !moved.current) return;
    start.current = null;
    setDragging(false);
    if (!moved.current) {
      if (open) {
        setOpen(false);
        setDx(0);
      }
      return;
    }
    moved.current = false;
    const shouldOpen = dx < -width / 2;
    setOpen(shouldOpen);
    setDx(shouldOpen ? -width : 0);
  }

  // Blokir klik tak sengaja (mis. link) sesudah geser atau saat menutup.
  function onClickCapture(e: React.SyntheticEvent) {
    if (moved.current || open) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
      if (open) {
        setOpen(false);
        setDx(0);
      }
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex" style={{ width }} aria-hidden={!(open || dx !== 0)}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={a.onClick}
            style={{ width: ACTION_WIDTH }}
            className={`flex items-center justify-center px-2 text-center font-givonic text-xs font-bold text-white transition ${
              a.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-perrific-graphite hover:brightness-110'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {content}
    </div>
  );
}
