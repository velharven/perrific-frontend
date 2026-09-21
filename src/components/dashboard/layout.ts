// Denah blok dashboard per kamar, disimpan sebagai JSON di Note.content.
// Tanpa tabel baru: 1 dashboard = 1 Note (kind DASHBOARD).

export type DashboardBlockType = 'greeting' | 'focus' | 'progress' | 'today' | 'teams';

export interface DashboardBlockDef {
  id: string;
  type: DashboardBlockType;
  hidden?: boolean;
}

export const BLOCK_ORDER: DashboardBlockType[] = ['greeting', 'focus', 'progress', 'today', 'teams'];

export const BLOCK_LABELS: Record<DashboardBlockType, string> = {
  greeting: 'Sapaan',
  focus: 'Fokus berikutnya',
  progress: 'Progres hari ini',
  today: 'To-do hari ini',
  teams: 'Tim saya',
};

export const BLOCK_DESCS: Record<DashboardBlockType, string> = {
  greeting: 'Sapaan + tanggal + ringkasan harian',
  focus: 'Satu aktivitas terpenting berikutnya',
  progress: 'Bar progres + angka total/selesai/tersisa',
  today: 'Daftar centang aktivitas hari ini',
  teams: 'Daftar tim + buat tim baru',
};

function isBlockType(t: unknown): t is DashboardBlockType {
  return typeof t === 'string' && (BLOCK_ORDER as string[]).includes(t);
}

// ponytail: id acak lokal, tabrakan praktis mustahil per-dashboard
export function newBlockId(): string {
  return Math.random().toString(36).slice(2);
}

export function defaultLayout(): DashboardBlockDef[] {
  return BLOCK_ORDER.map((type) => ({ id: newBlockId(), type }));
}

// Isi rusak/kosong/teks lama → susunan bawaan, halaman tidak pernah pecah.
export function parseLayout(content: string | null | undefined): DashboardBlockDef[] {
  if (!content) return defaultLayout();
  try {
    const raw = JSON.parse(content) as { version?: number; blocks?: unknown };
    if (!raw || !Array.isArray(raw.blocks)) return defaultLayout();
    const seen = new Set<string>();
    const blocks: DashboardBlockDef[] = [];
    for (const b of raw.blocks) {
      if (typeof b !== 'object' || b === null) continue;
      const { id, type, hidden } = b as { id?: unknown; type?: unknown; hidden?: unknown };
      if (typeof id !== 'string' || !id || seen.has(id)) continue;
      if (!isBlockType(type)) continue;
      seen.add(id);
      blocks.push({ id, type, ...(hidden === true ? { hidden: true } : {}) });
    }
    return blocks.length > 0 ? blocks : defaultLayout();
  } catch {
    return defaultLayout();
  }
}

export function serializeLayout(blocks: DashboardBlockDef[]): string {
  return JSON.stringify({ version: 1, blocks });
}

export interface DashboardPreset {
  id: string;
  label: string;
  desc: string;
  types: DashboardBlockType[];
}

export const PRESETS: DashboardPreset[] = [
  { id: 'pagi', label: 'Fokus Pagi', desc: 'Sapaan, fokus, to-do', types: ['greeting', 'focus', 'today'] },
  { id: 'sore', label: 'Review Sore', desc: 'Progres, to-do, tim', types: ['progress', 'today', 'teams'] },
  {
    id: 'sidang',
    label: 'Mode Sidang',
    desc: 'Sapaan, progres, to-do, tim',
    types: ['greeting', 'progress', 'today', 'teams'],
  },
];

export function layoutFromTypes(types: DashboardBlockType[]): DashboardBlockDef[] {
  return types.map((type) => ({ id: newBlockId(), type }));
}
