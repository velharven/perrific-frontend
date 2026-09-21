// Blok catatan bersarang ala Notion: tiap blok bisa punya anak tanpa batas.
// Disimpan sebagai JSON di Note.content (tanpa tabel/API baru).
// Semua operasi murni: terima pohon, kembalikan pohon baru (clone struktural,
// pohon kecil jadi ini termurah dan anti-bug aliasing).

export type NoteBlockType = 'text' | 'todo' | 'toggle' | 'page' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'divider';

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text: string;
  checked?: boolean;
  collapsed?: boolean;
  /** Pointer subhalaman (hanya type 'page'): id note anak. Judul live dari anak, text = snapshot. */
  pageId?: string;
  children: NoteBlock[];
}

export interface BlockFocus {
  id: string;
  offset: number;
}

// ponytail: id acak lokal, tabrakan praktis mustahil per-catatan
export function newBlockId(): string {
  return Math.random().toString(36).slice(2);
}

export function makeBlock(type: NoteBlockType = 'text', text = ''): NoteBlock {
  return { id: newBlockId(), type, text, children: [] };
}

const KNOWN_TYPES: NoteBlockType[] = ['text', 'todo', 'toggle', 'page', 'h1', 'h2', 'h3', 'bullet', 'number', 'divider'];
const MAX_BLOCKS = 2000;
const MAX_DEPTH = 20;

function cleanBlock(raw: unknown, depth: number, budget: { n: number }): NoteBlock | null {
  if (budget.n >= MAX_BLOCKS || depth > MAX_DEPTH) return null;
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const type: NoteBlockType = KNOWN_TYPES.includes(b.type as NoteBlockType)
    ? (b.type as NoteBlockType)
    : 'text';
  const children: NoteBlock[] = [];
  if (Array.isArray(b.children)) {
    for (const c of b.children) {
      const cleaned = cleanBlock(c, depth + 1, budget);
      if (cleaned) children.push(cleaned);
    }
  }
  // Pointer tanpa pageId tak bisa dibuka → buang (bukan teks).
  if (type === 'page' && (typeof b.pageId !== 'string' || !b.pageId)) return null;
  budget.n += 1;
  return {
    id: typeof b.id === 'string' && b.id ? b.id : newBlockId(),
    type,
    text: typeof b.text === 'string' ? b.text : '',
    ...(b.checked === true ? { checked: true } : {}),
    ...(b.collapsed === true ? { collapsed: true } : {}),
    ...(type === 'page' ? { pageId: b.pageId as string } : {}),
    children,
  };
}

// Teks lama (bukan JSON v2) dibungkus per baris agar tidak ada yang hilang.
// Kosong/rusak → daftar kosong (bukan error).
export function parseNoteBlocks(content: string | null | undefined): NoteBlock[] {
  if (content) {
    try {
      const raw = JSON.parse(content) as { version?: unknown; blocks?: unknown };
      if (raw && raw.version === 2 && Array.isArray(raw.blocks)) {
        const budget = { n: 0 };
        const out: NoteBlock[] = [];
        for (const b of raw.blocks) {
          const cleaned = cleanBlock(b, 0, budget);
          if (cleaned) out.push(cleaned);
        }
        return out;
      }
    } catch {
      // bukan JSON → jatuh ke teks lama di bawah
    }
    if (content.trim() !== '' || content.includes('\n')) {
      return content
        .replace(/\r/g, '')
        .split('\n')
        .filter((line, i, arr) => line !== '' || i !== arr.length - 1)
        .map((line) => makeBlock('text', line));
    }
  }
  return [];
}

export function serializeNoteBlocks(blocks: NoteBlock[]): string {
  return JSON.stringify({ version: 2, blocks });
}

export function countBlockWords(blocks: NoteBlock[]): number {
  let n = 0;
  const walk = (list: NoteBlock[]) => {
    for (const b of list) {
      if (b.text.trim()) n += b.text.trim().split(/\s+/).length;
      if (b.children.length > 0) walk(b.children);
    }
  };
  walk(blocks);
  return n;
}

interface BlockLoc {
  parent: NoteBlock[];
  index: number;
  block: NoteBlock;
}

function findIn(list: NoteBlock[], id: string): BlockLoc | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { parent: list, index: i, block: list[i] };
    const found = findIn(list[i].children, id);
    if (found) return found;
  }
  return null;
}

// Blok sebelumnya dalam urutan tampak (lewati anak yang dilipat).
export function findPrevVisible(blocks: NoteBlock[], id: string): NoteBlock | null {
  const flat: NoteBlock[] = [];
  const walk = (list: NoteBlock[]) => {
    for (const b of list) {
      flat.push(b);
      if (!b.collapsed) walk(b.children);
    }
  };
  walk(blocks);
  const i = flat.findIndex((b) => b.id === id);
  return i > 0 ? flat[i - 1] : null;
}

function clone(blocks: NoteBlock[]): NoteBlock[] {
  return structuredClone(blocks);
}

// Baca saja (referensi ke pohon asli, jangan dimutasi).
export function getBlock(blocks: NoteBlock[], id: string): NoteBlock | null {
  return findIn(blocks, id)?.block ?? null;
}

// Urutan blok yang bisa menerima kursor (depth-first, terlihat saja):
// lewati anak toggle yang collapsed dan baris `page` ber-pageId
// (dirender sebagai link, tanpa textarea).
export function visibleBlockOrder(blocks: NoteBlock[]): string[] {
  const out: string[] = [];
  const walk = (list: NoteBlock[]) => {
    for (const b of list) {
      if (!(b.type === 'page' && b.pageId)) out.push(b.id);
      if (b.type === 'toggle' && b.collapsed) continue;
      if (b.children.length > 0) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

// Daftar heading untuk outline navigator (depth-first, terlihat saja):
// anak toggle yang collapsed ikut disembunyikan.
export interface HeadingItem {
  id: string;
  type: 'h1' | 'h2' | 'h3';
  text: string;
}

export function headingOutline(blocks: NoteBlock[]): HeadingItem[] {
  const out: HeadingItem[] = [];
  const walk = (list: NoteBlock[]) => {
    for (const b of list) {
      if (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') {
        out.push({ id: b.id, type: b.type, text: b.text });
      }
      if (b.type === 'toggle' && b.collapsed) continue;
      if (b.children.length > 0) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

export interface DropHint {
  /** Id baris target. */
  id: string;
  /** 'before'/'after' = garis selip; 'nest' = masuk jadi anak (oranye penuh). */
  pos: 'before' | 'after' | 'nest';
}

// Batas zona sarang (tengah baris toggle): 50% tengah cukup lega diraih,
// 25% tepi atas-bawah tetap untuk garis selip.
const NEST_MIN = 0.25;
const NEST_MAX = 0.75;

// Cermin aturan drop NotePage: tengah baris toggle = masuk, tepi = selip.
// frac = posisi pointer 0–1 dalam tinggi baris target; null = tak diketahui
// (keyboard) → garis ikut urutan seperti dulu. Kembalikan null bila tak ada
// yang ditandai (id salah, diri sendiri, siklus).
export function getDropHint(
  blocks: NoteBlock[],
  activeId: string,
  overId: string,
  frac: number | null,
): DropHint | null {
  if (activeId === overId) return null;
  const a = findIn(blocks, activeId);
  const o = findIn(blocks, overId);
  if (!a || !o) return null;
  // Target di dalam turunan yang diseret (termasuk diri) = drop pasti
  // ditolak → tanpa tanda, di semua cabang.
  const sub = new Set<string>();
  const walk = (b: NoteBlock) => {
    sub.add(b.id);
    for (const c of b.children) walk(c);
  };
  walk(a.block);
  if (sub.has(o.block.id)) return null;
  if (o.block.type === 'toggle' && frac !== null && frac >= NEST_MIN && frac <= NEST_MAX) {
    return { id: o.block.id, pos: 'nest' };
  }
  if (a.parent === o.parent) {
    if (frac !== null) return { id: o.block.id, pos: frac <= 0.5 ? 'before' : 'after' };
    return { id: o.block.id, pos: a.index < o.index ? 'after' : 'before' };
  }
  if (frac !== null) return { id: o.block.id, pos: frac <= 0.5 ? 'before' : 'after' };
  return { id: o.block.id, pos: 'before' };
}

// Id induk: null = akar, undefined = tak ketemu.
export function getParentId(blocks: NoteBlock[], id: string): string | null | undefined {
  const loc = findIn(blocks, id);
  if (!loc) return undefined;
  return findParent(blocks, id)?.block.id ?? null;
}

export function updateBlockText(blocks: NoteBlock[], id: string, text: string): NoteBlock[] {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (loc) loc.block.text = text;
  return next;
}

export function setBlockType(blocks: NoteBlock[], id: string, type: NoteBlockType): NoteBlock[] {
  // 'page' hanya via setBlockPage (butuh pageId) — cegah pointer rusak.
  if (type === 'page') return blocks;
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (loc) {
    loc.block.type = type;
    if (type !== 'todo') delete loc.block.checked;
  }
  return next;
}

// Ubah blok pemicu '/' jadi pointer subhalaman. Anak blok dipertahankan.
export function setBlockPage(blocks: NoteBlock[], id: string, pageId: string, snapshotTitle = ''): NoteBlock[] {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc) return blocks;
  loc.block.type = 'page';
  loc.block.pageId = pageId;
  loc.block.text = snapshotTitle;
  delete loc.block.checked;
  return next;
}

export function toggleBlockChecked(blocks: NoteBlock[], id: string): NoteBlock[] {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (loc && loc.block.type === 'todo') loc.block.checked = !loc.block.checked;
  return next;
}

export function toggleBlockCollapsed(blocks: NoteBlock[], id: string): NoteBlock[] {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (loc) loc.block.collapsed = !loc.block.collapsed;
  return next;
}

export type NoteBlockList = NoteBlock[];

// Enter: belah teks di offset kursor, paruh kanan jadi blok baru di bawah.
// Anak ikut blok atas. Kursor pindah ke awal blok baru.
export function splitBlock(
  blocks: NoteBlock[],
  id: string,
  offset: number,
): { blocks: NoteBlockList; focus: BlockFocus } | null {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc) return null;
  const at = Math.max(0, Math.min(offset, loc.block.text.length));
  // Baris pointer/divider tak bisa dibelah (tanpa textarea) → Enter menambah teks di bawah.
  const rightType = loc.block.type === 'page' || loc.block.type === 'divider' ? 'text' : loc.block.type;
  const right = makeBlock(rightType, loc.block.type === 'page' ? '' : loc.block.text.slice(at));
  if (loc.block.type === 'todo') right.checked = false;
  loc.block.text = loc.block.text.slice(0, at);
  loc.parent.splice(loc.index + 1, 0, right);
  return { blocks: next, focus: { id: right.id, offset: 0 } };
}

// Tab: jadikan anak dari kakak sebelumnya (tidak bisa bila sudah paling atas).
export function indentBlock(
  blocks: NoteBlock[],
  id: string,
  offset: number,
): { blocks: NoteBlockList; focus: BlockFocus } | null {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc || loc.index === 0) return null;
  const [moved] = loc.parent.splice(loc.index, 1);
  const prev = loc.parent[loc.index - 1];
  prev.children.push(moved);
  delete prev.collapsed;
  return { blocks: next, focus: { id, offset } };
}

// Shift+Tab: keluarkan dari induk, taruh tepat setelah induk.
export function outdentBlock(
  blocks: NoteBlock[],
  id: string,
  offset: number,
): { blocks: NoteBlockList; focus: BlockFocus } | null {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc) return null;
  const parentLoc = findParent(next, id);
  if (!parentLoc) return null; // sudah di akar
  const [moved] = loc.parent.splice(loc.index, 1);
  parentLoc.parent.splice(parentLoc.index + 1, 0, moved);
  return { blocks: next, focus: { id, offset } };
}

function findParent(blocks: NoteBlock[], id: string): BlockLoc | null {
  const loc = findIn(blocks, id);
  if (!loc) return null;
  // loc.parent adalah array anak; cari siapa pemilik array itu (di pohon yang sama)
  return findOwner(blocks, loc.parent);
}

function findOwner(list: NoteBlock[], children: NoteBlock[]): BlockLoc | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].children === children) return { parent: list, index: i, block: list[i] };
    const found = findOwner(list[i].children, children);
    if (found) return found;
  }
  return null;
}

// Cabut satu blok (anak naik menggantikan). Dipakai tombol × pointer dan
// blok kosong via deleteEmptyBlock. Fokus ikut seperti penghapusan biasa.
export function removeBlock(
  blocks: NoteBlock[],
  id: string,
): { blocks: NoteBlockList; focus: BlockFocus | null } | null {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc) return null;
  const prev = findPrevVisible(next, id);
  const kids = loc.block.children;
  loc.parent.splice(loc.index, 1, ...kids);
  if (prev) {
    const stillThere = findIn(next, prev.id);
    const target = stillThere ? stillThere.block : null;
    return {
      blocks: next,
      focus: target ? { id: target.id, offset: target.text.length } : null,
    };
  }
  const flat: NoteBlock[] = [];
  const walk = (list: NoteBlock[]) => {
    for (const b of list) {
      flat.push(b);
      if (!b.collapsed) walk(b.children);
    }
  };
  walk(next);
  return { blocks: next, focus: flat.length > 0 ? { id: flat[0].id, offset: 0 } : null };
}

// Backspace di offset 0 pada blok kosong: hapus, anak naik menggantikan.
export function deleteEmptyBlock(
  blocks: NoteBlock[],
  id: string,
): { blocks: NoteBlockList; focus: BlockFocus | null } | null {
  const b = getBlock(blocks, id);
  if (!b || b.text !== '' || b.type === 'page') return null;
  return removeBlock(blocks, id);
}

// Kumpulkan semua pageId pointer dalam pohon.
export function collectPageIds(blocks: NoteBlock[]): Set<string> {
  const out = new Set<string>();
  const walk = (list: NoteBlock[]) => {
    for (const b of list) {
      if (b.type === 'page' && b.pageId) out.add(b.pageId);
      if (b.children.length > 0) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

// Migrasi sekali jalan: anak DB yang belum punya pointer ditambatkan di akhir.
// Berhenti sendiri (jalankan lagi = tidak berubah). Id Sampah dilewati agar
// pointer yang dibuang tak dibuatkan lagi (ghost "Halaman tidak tersedia").
export function ensurePagePointers(
  blocks: NoteBlock[],
  childIds: string[],
  skipIds?: Set<string>,
): { blocks: NoteBlockList; changed: boolean } {
  const have = collectPageIds(blocks);
  const missing = childIds.filter((id) => !have.has(id) && !skipIds?.has(id));
  if (missing.length === 0) return { blocks, changed: false };
  const next = clone(blocks);
  for (const pageId of missing) {
    next.push({ id: newBlockId(), type: 'page', text: '', pageId, children: [] });
  }
  return { blocks: next, changed: true };
}

interface PagePtrLoc {
  parent: NoteBlock[];
  index: number;
  block: NoteBlock;
  depth: number;
}

function collectPtrLocs(list: NoteBlock[], depth: number, out: PagePtrLoc[]) {
  list.forEach((b, i) => {
    if (b.type === 'page' && b.pageId) out.push({ parent: list, index: i, block: b, depth });
    if (b.children.length > 0) collectPtrLocs(b.children, depth + 1, out);
  });
}

// Cabut SEMUA pointer ke id-id berikut (terdalam + index besar dulu agar
// splice tak menggeser yang lain). Anak blok yang tercabut naik seperti
// removeBlock. Kembalikan cacah yang dicabut.
export function prunePagePointers(blocks: NoteBlock[], ids: Set<string>): { blocks: NoteBlockList; removed: number } {
  const next = clone(blocks);
  const locs: PagePtrLoc[] = [];
  collectPtrLocs(next, 0, locs);
  const hit = locs.filter((l) => l.block.pageId !== undefined && ids.has(l.block.pageId));
  hit.sort((a, b) => b.depth - a.depth || b.index - a.index);
  for (const l of hit) {
    l.parent.splice(l.index, 1, ...l.block.children);
  }
  return { blocks: next, removed: hit.length };
}

// Buang pointer duplikat (kemunculan ke-2 dst. per pageId). Menutup lubang
// ghost ganda warisan migrasi lama.
export function dedupePagePointers(blocks: NoteBlock[]): { blocks: NoteBlockList; changed: boolean } {
  const next = clone(blocks);
  const locs: PagePtrLoc[] = [];
  collectPtrLocs(next, 0, locs);
  const seen = new Set<string>();
  const dup = locs.filter((l) => {
    const id = l.block.pageId as string;
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  dup.sort((a, b) => b.depth - a.depth || b.index - a.index);
  for (const l of dup) {
    l.parent.splice(l.index, 1, ...l.block.children);
  }
  return { blocks: next, changed: dup.length > 0 };
}

// Backspace di offset 0 pada blok berisi: gabung ke blok tampak sebelumnya.
// Anak blok yang dihapus menempel di ujung anak blok tujuan.
export function mergeUp(
  blocks: NoteBlock[],
  id: string,
): { blocks: NoteBlockList; focus: BlockFocus } | null {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc) return null;
  const prev = findPrevVisible(next, id);
  if (!prev) return null;
  const prevLoc = findIn(next, prev.id);
  if (!prevLoc) return null;
  const at = prevLoc.block.text.length;
  prevLoc.block.text = prevLoc.block.text + loc.block.text;
  prevLoc.block.children.push(...loc.block.children);
  loc.parent.splice(loc.index, 1);
  return { blocks: next, focus: { id: prevLoc.block.id, offset: at } };
}

// Eksekutor tunggal drop: persis menunaikan janji getDropHint sehingga
// indikator dan hasil tak akan pernah beda. Kembalikan ref asal bila tolak.
export function applyDrop(
  blocks: NoteBlock[],
  activeId: string,
  overId: string,
  frac: number | null,
): NoteBlockList {
  const hint = getDropHint(blocks, activeId, overId, frac);
  if (!hint) return blocks;
  if (hint.pos === 'nest') return moveBlockCross(blocks, activeId, hint.id);
  const next = clone(blocks);
  const a = findIn(next, activeId);
  const o = findIn(next, hint.id);
  if (!a || !o) return blocks;
  const [moved] = a.parent.splice(a.index, 1);
  let to = o.parent.indexOf(o.block);
  if (to < 0) return blocks;
  if (hint.pos === 'after') to += 1;
  o.parent.splice(to, 0, moved);
  return next;
}

// Seret dalam satu level (antar-level pakai Tab). Beda induk → tolak.
// Blok pindah ke slot over: tangkap indeks SEBELUM splice, karena splice
// menggeser posisi (itulah bug gerak-ke-bawah sebelumnya).
export function moveBlock(blocks: NoteBlock[], activeId: string, overId: string): NoteBlock[] {
  if (activeId === overId) return blocks;
  const next = clone(blocks);
  const a = findIn(next, activeId);
  const o = findIn(next, overId);
  if (!a || !o || a.parent !== o.parent) return blocks;
  const from = a.index;
  const to = o.index;
  const [moved] = a.parent.splice(from, 1);
  o.parent.splice(to, 0, moved);
  return next;
}

export function appendBlock(blocks: NoteBlock[], type: NoteBlockType = 'text'): {
  blocks: NoteBlockList;
  focus: BlockFocus;
} {
  const b = makeBlock(type);
  return { blocks: [...clone(blocks), b], focus: { id: b.id, offset: 0 } };
}

// Sisip blok baru tepat di bawah blok acuan (satu induk). Untuk menu "+".
export function insertAfter(
  blocks: NoteBlock[],
  id: string,
  type: NoteBlockType = 'text',
): { blocks: NoteBlockList; focus: BlockFocus } | null {
  const next = clone(blocks);
  const loc = findIn(next, id);
  if (!loc) return null;
  const b = makeBlock(type);
  loc.parent.splice(loc.index + 1, 0, b);
  return { blocks: next, focus: { id: b.id, offset: 0 } };
}

// Anak pertama di dalam toggle kosong (baris "Tombol kosong...").
// Induk dibuka paksa: anak yang baru dilipat = sia-sia.
export function appendChild(
  blocks: NoteBlock[],
  parentId: string,
  type: NoteBlockType = 'text',
): { blocks: NoteBlockList; focus: BlockFocus } | null {
  const next = clone(blocks);
  const loc = findIn(next, parentId);
  if (!loc) return null;
  const b = makeBlock(type);
  loc.block.children.push(b);
  delete loc.block.collapsed;
  return { blocks: next, focus: { id: b.id, offset: 0 } };
}

// Pindahkan blok ke induk lain (seret-letak antar level) atau ke akar
// (newParentId null). Sisip sebelum beforeId bila cocok se-induk,
// selebihnya tempel di akhir. Induk tujuan dibuka paksa.
// Tolak diam-diam: id salah, induk tak ada, atau induk di dalam
// turunan blok yang dipindah (siklus).
export function moveBlockCross(
  blocks: NoteBlock[],
  activeId: string,
  newParentId: string | null,
  beforeId?: string | null,
): NoteBlockList {
  const probe = findIn(blocks, activeId);
  if (!probe) return blocks;
  const sub = new Set<string>();
  const walk = (b: NoteBlock) => {
    sub.add(b.id);
    for (const c of b.children) walk(c);
  };
  walk(probe.block);
  if (newParentId !== null && sub.has(newParentId)) return blocks;
  const next = clone(blocks);
  const a = findIn(next, activeId);
  if (!a) return blocks;
  const [moved] = a.parent.splice(a.index, 1);
  const kids = newParentId === null ? next : (findIn(next, newParentId)?.block.children ?? null);
  if (!kids) {
    // Induk hilang antara probe dan eksekusi → kembalikan utuh.
    a.parent.splice(a.index, 0, moved);
    return blocks;
  }
  const at = beforeId ? kids.findIndex((b) => b.id === beforeId) : -1;
  // beforeId milik induk lain / tak ada → tempel di akhir (prediktabel).
  kids.splice(at >= 0 ? at : kids.length, 0, moved);
  if (newParentId !== null) {
    const p = findIn(next, newParentId);
    if (p) delete p.block.collapsed;
  }
  return next;
}
