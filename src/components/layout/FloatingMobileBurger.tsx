import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';

const STORAGE_KEY = 'purrific:floating-burger-pos';
const BUTTON_SIZE = 48;
const PADDING = 8;
const DRAG_THRESHOLD = 5;

interface Position {
  x: number;
  y: number;
}

function clampPosition(x: number, y: number): Position {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(PADDING, window.innerWidth - BUTTON_SIZE - PADDING);
  const maxY = Math.max(PADDING, window.innerHeight - BUTTON_SIZE - PADDING);
  return {
    x: Math.min(Math.max(PADDING, x), maxX),
    y: Math.min(Math.max(PADDING, y), maxY),
  };
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') return { x: 16, y: 16 };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Position>;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return clampPosition(parsed.x, parsed.y);
      }
    }
  } catch {
    // Abaikan jika localStorage tidak tersedia atau JSON tidak valid
  }
  return clampPosition(16, 16);
}

export default function FloatingMobileBurger({
  onOpen,
  hidden = false,
}: {
  onOpen: () => void;
  hidden?: boolean;
}) {
  const [pos, setPos] = useState<Position>(getInitialPosition);
  const [isPointerDown, setIsPointerDown] = useState(false);

  const startRef = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initX: 16,
    initY: 16,
    hasMoved: false,
  });

  // Pastikan posisi tetap dalam batas layar saat orientasi layar atau ukuran viewport berubah
  useEffect(() => {
    function handleResize() {
      setPos((prev) => {
        const clamped = clampPosition(prev.x, prev.y);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
          } catch {
            // Abaikan kesalahan penulisan storage
          }
          return clamped;
        }
        return prev;
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return; // Hanya tangani klik primer/sentuhan
    setIsPointerDown(true);

    startRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
      hasMoved: false,
    };

    const target = e.target as HTMLElement;
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Abaikan jika tidak didukung oleh browser/lingkungan
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isPointerDown) return;

    const deltaX = e.clientX - startRef.current.startX;
    const deltaY = e.clientY - startRef.current.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > DRAG_THRESHOLD) {
      startRef.current.hasMoved = true;
      const nextX = startRef.current.initX + deltaX;
      const nextY = startRef.current.initY + deltaY;
      setPos(clampPosition(nextX, nextY));
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isPointerDown) return;
    setIsPointerDown(false);

    const target = e.target as HTMLElement;
    if (typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // Abaikan jika pointer capture telah terlepas otomatis
      }
    }

    if (!startRef.current.hasMoved) {
      // Gestur berupa tap/klik singkat: buka sidebar
      onOpen();
    } else {
      // Gestur berupa seret/drag: simpan posisi terakhir ke penyimpanan lokal
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        // Abaikan
      }
    }
  }

  function handlePointerCancel() {
    setIsPointerDown(false);
  }

  return (
    <button
      type="button"
      role="button"
      aria-label="Buka menu navigasi"
      title="Buka menu"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
      }}
      className={`fixed left-0 top-0 z-30 flex h-12 w-12 select-none touch-none items-center justify-center rounded-full border border-gray-200/90 bg-white text-perrific-graphite shadow-[0_6px_20px_rgba(0,0,0,0.14)] backdrop-blur transition-opacity duration-200 ease-out active:scale-95 lg:hidden ${
        isPointerDown ? 'cursor-grabbing scale-95 shadow-[0_8px_24px_rgba(0,0,0,0.2)]' : 'cursor-grab'
      } ${hidden ? 'pointer-events-none opacity-0 scale-90' : 'pointer-events-auto opacity-100'}`}
    >
      <Menu size={20} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
