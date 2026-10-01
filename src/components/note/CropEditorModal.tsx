import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { cropDataUrl } from './cover';

// Editor potong sampul: kotak aspek banner, gambar digeser (pan) +
// slider/tombol ± (zoom). Keluar JPEG 1200x400 siap simpan.
export default function CropEditorModal({
  src,
  onDone,
  onClose,
}: {
  src: string;
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Kotak tampil mengikuti lebar kartu popup (aspek 3:1 ala banner).
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(320);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth || 320);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setError('Gagal memuat gambar.');
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const boxH = Math.round(boxW / 3);
  const base = size ? Math.max(boxW / size.w, boxH / size.h) : 1;
  const zoomMax = 4;
  const rw = size ? size.w * base * zoom : 0;
  const rh = size ? size.h * base * zoom : 0;
  const clampX = Math.max(0, (rw - boxW) / 2);
  const clampY = Math.max(0, (rh - boxH) / 2);
  const cx = Math.max(-clampX, Math.min(clampX, off.x));
  const cy = Math.max(-clampY, Math.min(clampY, off.y));

  function setZoomKeep(z: number) {
    setZoom(Math.max(1, Math.min(zoomMax, z)));
  }

  async function handleSave() {
    if (!size || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Kotak tampil → koordinat natural.
      const k = rw / size.w;
      const rect = {
        x: (rw / 2 - boxW / 2 - cx) / k,
        y: (rh / 2 - boxH / 2 - cy) / k,
        w: boxW / k,
        h: boxH / k,
      };
      onDone(await cropDataUrl(src, rect));
    } catch {
      setError('Gagal memotong gambar. Coba lagi.');
      setBusy(false);
    }
  }

  return (
    <ModalShell label="Atur sampul" onClose={onClose}>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="font-givonic text-sm font-bold text-perrific-graphite">Atur sampul</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite cursor-pointer"
        >
          <X size={14} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
      <div ref={boxRef}>
        <div
          className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-gray-100"
          style={{ height: boxH }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: cx, oy: cy };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setOff({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {!size ? (
            <p className="flex h-full items-center justify-center font-givonic text-xs text-gray-400">Memuat…</p>
          ) : (
            <img
              src={src}
              alt="Pratinjau sampul"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: rw,
                height: rh,
                transform: `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`,
              }}
            />
          )}
        </div>
      </div>
      <p className="px-1 pt-1.5 font-givonic text-[11px] text-perrific-graphite/50">
        Seret untuk menggeser.
      </p>
      <div className="mt-1 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setZoomKeep(zoom - 0.25)}
          disabled={zoom <= 1}
          aria-label="Perkecil"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-base text-gray-600 transition hover:border-perrific-violet hover:text-perrific-violet disabled:opacity-40"
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={zoomMax}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoomKeep(Number(e.target.value))}
          aria-label="Perbesar sampul"
          className="min-w-0 flex-1 accent-[#6D5BFF]"
        />
        <button
          type="button"
          onClick={() => setZoomKeep(zoom + 0.25)}
          disabled={zoom >= zoomMax}
          aria-label="Perbesar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-base text-gray-600 transition hover:border-perrific-violet hover:text-perrific-violet disabled:opacity-40"
        >
          +
        </button>
      </div>
      {error && (
        <p role="alert" className="px-1 pt-1 font-givonic text-xs text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={!size || busy}
        className="mt-3 w-full rounded-xl bg-perrific-violet px-3 py-2.5 font-givonic text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? 'Menyimpan…' : 'Pakai sampul ini'}
      </button>
    </ModalShell>
  );
}
