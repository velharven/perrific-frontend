import type { Attachment } from '@/types';

export type PreviewKind = 'image' | 'pdf' | 'text';

export function previewKind(a: Pick<Attachment, 'mimeType' | 'filename'>): PreviewKind | null {
  if (a.mimeType.startsWith('image/')) return 'image';
  if (a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.filename)) return 'pdf';
  if (a.mimeType.startsWith('text/') || /\.(txt|md|markdown|csv|json|log)$/i.test(a.filename)) return 'text';
  // Format office (doc/docx/xls/...) tidak bisa dirender browser tanpa library khusus.
  return null;
}

export function fileExtLabel(filename: string): string {
  const ext = filename.split('.').pop()?.trim() ?? '';
  return (ext || 'FILE').toUpperCase().slice(0, 4);
}

export function decodeDataUrlText(dataUrl: string, max = 20000): string {
  const base64 = dataUrl.split(',')[1] ?? '';
  try {
    const bin = atob(base64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const text = new TextDecoder('utf-8').decode(bytes);
    return text.length > max ? `${text.slice(0, max)}\n…(dipotong, unduh untuk versi penuh)` : text;
  } catch {
    return '(tidak bisa dibaca sebagai teks)';
  }
}
