// Nilai sampul Note.coverUrl: kosong | CSS gradien preset | JSON upload.
// Gradien lama (string CSS polos) tetap kebaca → kompatibel mundur.
export type CoverPos = '0% 50%' | '50% 50%' | '100% 50%';

export const COVER_ALIGN: { pos: CoverPos; label: string }[] = [
  { pos: '0% 50%', label: 'Rata kiri' },
  { pos: '50% 50%', label: 'Rata tengah' },
  { pos: '100% 50%', label: 'Rata kanan' },
];

export type ParsedCover =
  | { kind: 'none' }
  | { kind: 'gradient'; css: string }
  | { kind: 'image'; src: string; pos: CoverPos };

export function parseCover(value: string | null | undefined): ParsedCover {
  if (!value) return { kind: 'none' };
  try {
    const raw = JSON.parse(value) as { src?: unknown; pos?: unknown };
    if (raw && typeof raw.src === 'string' && raw.src.startsWith('data:image/')) {
      const pos: CoverPos =
        raw.pos === '0% 50%' || raw.pos === '100% 50%' ? raw.pos : '50% 50%';
      return { kind: 'image', src: raw.src, pos };
    }
  } catch {
    // bukan JSON → anggap CSS gradien di bawah
  }
  return { kind: 'gradient', css: value };
}

export function makeImageCover(src: string, pos: CoverPos = '50% 50%'): string {
  return JSON.stringify({ src, pos });
}

// Ganti perataan upload tanpa menyentuh gambarnya. Non-upload → utuh.
export function withCoverPos(value: string | null, pos: CoverPos): string | null {
  const parsed = parseCover(value);
  if (parsed.kind !== 'image') return value;
  return makeImageCover(parsed.src, pos);
}

export const COVER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: 'violet', label: 'Violet', css: 'linear-gradient(135deg, #6D5BFF 0%, #B3A6FF 100%)' },
  { id: 'amber', label: 'Amber', css: 'linear-gradient(135deg, #F5A524 0%, #FFD58A 100%)' },
  { id: 'mint', label: 'Mint', css: 'linear-gradient(135deg, #2ECC9C 0%, #A8EBCF 100%)' },
  { id: 'rose', label: 'Rose', css: 'linear-gradient(135deg, #E84B3C 0%, #FF9D94 100%)' },
  { id: 'sky', label: 'Langit', css: 'linear-gradient(135deg, #3B82F6 0%, #A5C8FF 100%)' },
  { id: 'wood', label: 'Kayu', css: 'linear-gradient(135deg, #8B6F47 0%, #D9BE96 100%)' },
  { id: 'graphite', label: 'Grafit', css: 'linear-gradient(135deg, #1A1A1E 0%, #5A5A63 100%)' },
  { id: 'peach', label: 'Persik', css: 'linear-gradient(135deg, #FF9A8B 0%, #FFD3A5 100%)' },
  { id: 'lilac', label: 'Lilac', css: 'linear-gradient(135deg, #A78BFA 0%, #F0ABFC 100%)' },
];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('gagal memuat gambar'));
    img.src = src;
  });
}

// Kecilkan gambar ke batas sisi terpanjang (hemat memori + DB).
export async function fileToDownscaledDataUrl(file: File, maxDim = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File harus gambar.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Ukuran maksimal 5MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas tidak didukung.');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Potong dataURL sesuai kotak dalam koordinat natural, keluar JPEG.
export async function cropDataUrl(
  src: string,
  rect: { x: number; y: number; w: number; h: number },
  outW = 1200,
  outH = 400,
): Promise<string> {
  const img = await loadImage(src);
  const sx = Math.max(0, Math.min(img.naturalWidth - 1, rect.x));
  const sy = Math.max(0, Math.min(img.naturalHeight - 1, rect.y));
  const sw = Math.max(1, Math.min(img.naturalWidth - sx, rect.w));
  const sh = Math.max(1, Math.min(img.naturalHeight - sy, rect.h));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kanvas tidak didukung.');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.85);
}
