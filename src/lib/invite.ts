// Helper invite tim: dipakai di semua tempat tampil kode (settings tim,
// settings project, tab Team) agar teks + link konsisten.
export function buildJoinLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export function formatExpiryText(iso: string | null | undefined): string {
  if (!iso) return 'Tanpa batas waktu';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Tanpa batas waktu';
  if (t <= Date.now()) return 'Sudah kedaluwarsa';
  return `Berlaku sampai ${new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export const INVITE_PRESETS: { label: string; hours: number | null }[] = [
  { label: '1 jam', hours: 1 },
  { label: '24 jam', hours: 24 },
  { label: '7 hari', hours: 24 * 7 },
  { label: 'Tanpa batas', hours: null },
];

// Samakan preset aktif dari expiry kini (toleransi 1 menit).
export function matchPreset(iso: string | null | undefined): number | null | undefined {
  if (!iso) return null;
  const left = new Date(iso).getTime() - Date.now();
  for (const p of INVITE_PRESETS) {
    if (p.hours === null) continue;
    if (Math.abs(left - p.hours * 3600_000) < 60_000) return p.hours;
  }
  return undefined;
}
