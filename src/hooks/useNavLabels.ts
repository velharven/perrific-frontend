import { useCallback, useEffect, useState } from 'react';

const NAV_EVENT = 'purrific:navlabels-changed';

function keyFor(userId?: string) {
  return `purrific:navLabels:${userId ?? 'anon'}`;
}

function read(userId?: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Label rename-able untuk tab sidebar PRIVAT, disimpan per-user di localStorage.
 * Antar-instance sidebar (desktop + drawer mobile) disinkronkan via event.
 */
export function useNavLabels(userId?: string) {
  const [labels, setLabels] = useState<Record<string, string>>(() => read(userId));

  useEffect(() => {
    setLabels(read(userId));
    const onChange = () => setLabels(read(userId));
    window.addEventListener(NAV_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(NAV_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId]);

  const setLabel = useCallback(
    (to: string, label: string) => {
      try {
        const next = { ...read(userId) };
        const trimmed = label.trim();
        if (!trimmed) delete next[to];
        else next[to] = trimmed.slice(0, 120);
        localStorage.setItem(keyFor(userId), JSON.stringify(next));
      } catch {
        // abaikan — penyimpanan lokal tidak tersedia
      }
      setLabels(read(userId));
      window.dispatchEvent(new Event(NAV_EVENT));
    },
    [userId],
  );

  return { labels, setLabel };
}

export const TEAMS_CHANGED_EVENT = 'purrific:teams-changed';

export function notifyTeamsChanged() {
  try {
    localStorage.setItem(TEAMS_CHANGED_EVENT, String(Date.now()));
  } catch {
    // abaikan — penyimpanan lokal tidak tersedia
  }
  window.dispatchEvent(new Event(TEAMS_CHANGED_EVENT));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // abaikan — penyimpanan lokal tidak tersedia
  }
  window.dispatchEvent(new Event(`${key}:changed`));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Map string generik yang tersinkron antar-instance (ikon nav, ikon tim).
 */
export function useSyncedMap(baseKey: string, userId?: string) {
  const key = `${baseKey}:${userId ?? 'anon'}`;
  const [map, setMap] = useState<Record<string, string>>(() => readJson(key, {}));

  useEffect(() => {
    setMap(readJson(key, {}));
    const onChange = () => setMap(readJson(key, {}));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const setEntry = useCallback(
    (entryKey: string, value: string | null) => {
      const next = { ...readJson<Record<string, string>>(key, {}) };
      if (value === null) delete next[entryKey];
      else next[entryKey] = value;
      writeJson(key, next);
      setMap(next);
    },
    [key],
  );

  return { map, setEntry };
}

/**
 * Daftar route nav yang disembunyikan user (hapus tab PRIVAT = sembunyikan,
 * karena route-nya sendiri tidak bisa dihapus).
 */
export function useHiddenNav(userId?: string) {
  const key = `purrific:navHidden:${userId ?? 'anon'}`;
  const [hidden, setHidden] = useState<string[]>(() => readJson(key, []));

  useEffect(() => {
    setHidden(readJson(key, []));
    const onChange = () => setHidden(readJson(key, []));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const hide = useCallback(
    (to: string) => {
      const next = Array.from(new Set([...readJson<string[]>(key, []), to]));
      writeJson(key, next);
      setHidden(next);
    },
    [key],
  );

  const show = useCallback(
    (to: string) => {
      const next = readJson<string[]>(key, []).filter((v) => v !== to);
      writeJson(key, next);
      setHidden(next);
    },
    [key],
  );

  const showAll = useCallback(() => {
    writeJson(key, []);
    setHidden([]);
  }, [key]);

  return { hidden, hide, show, showAll };
}

/**
 * Daftar id tim yang diarsipkan user secara personal (sembunyikan dari
 * sidebar saja, data server utuh, per-user di localStorage).
 * Pola sama persis dengan useHiddenNav agar konsisten antar-instance.
 */
export function useHiddenTeams(userId?: string) {
  const key = `purrific:teamHidden:${userId ?? 'anon'}`;
  const [hidden, setHidden] = useState<string[]>(() => readJson(key, []));

  useEffect(() => {
    setHidden(readJson(key, []));
    const onChange = () => setHidden(readJson(key, []));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const hide = useCallback(
    (teamId: string) => {
      const next = Array.from(new Set([...readJson<string[]>(key, []), teamId]));
      writeJson(key, next);
      setHidden(next);
    },
    [key],
  );

  const show = useCallback(
    (teamId: string) => {
      const next = readJson<string[]>(key, []).filter((v) => v !== teamId);
      writeJson(key, next);
      setHidden(next);
    },
    [key],
  );

  const showAll = useCallback(() => {
    writeJson(key, []);
    setHidden([]);
  }, [key]);

  return { hidden, hide, show, showAll };
}

/**
 * Urutan tab sidebar per section (privat-nav, privat-notes, teams),
 * per-user di localStorage. Key yang belum pernah diatur menempel di akhir
 * sesuai urutan bawaan; disinkronkan antar-instance via event.
 */
export function useTabOrder(userId?: string) {
  const key = `purrific:tabOrder:${userId ?? 'anon'}`;
  const [orders, setOrders] = useState<Record<string, string[]>>(() => readJson(key, {}));

  useEffect(() => {
    setOrders(readJson(key, {}));
    const onChange = () => setOrders(readJson(key, {}));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const orderKeys = useCallback(
    (section: string, keys: string[]): string[] => {
      const rank = new Map((orders[section] ?? []).map((k, i) => [k, i]));
      return [...keys].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
    },
    [orders],
  );

  const sortItems = useCallback(
    <T,>(section: string, items: T[], getKey: (item: T) => string): T[] => {
      const orderedKeys = orderKeys(section, items.map(getKey));
      const byKey = new Map<string, T>();
      for (const item of items) byKey.set(getKey(item), item);
      const out: T[] = [];
      for (const k of orderedKeys) {
        const item = byKey.get(k);
        if (item !== undefined) out.push(item);
      }
      return out;
    },
    [orderKeys],
  );

  const move = useCallback(
    (section: string, visibleKeys: string[], keyToMove: string, dir: -1 | 1) => {
      const idx = visibleKeys.indexOf(keyToMove);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= visibleKeys.length) return;
      const next = [...visibleKeys];
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      // Key tersimpan lain yang sedang tak terlihat (mis. tab hidden) tetap di belakang.
      const stored = readJson<Record<string, string[]>>(key, {})[section] ?? [];
      const rest = stored.filter((k) => !next.includes(k));
      const all = { ...readJson<Record<string, string[]>>(key, {}), [section]: [...next, ...rest] };
      writeJson(key, all);
      setOrders(all);
    },
    [key],
  );

  // Pindahkan key aktif ke posisi key target (untuk drag-and-drop).
  // Berbagi format simpan yang sama dengan move(), jadi tombol Naik/Turun tetap kompatibel.
  const reorder = useCallback(
    (section: string, visibleKeys: string[], activeKey: string, overKey: string) => {
      const from = visibleKeys.indexOf(activeKey);
      const to = visibleKeys.indexOf(overKey);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...visibleKeys];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Key tersimpan lain yang sedang tak terlihat (mis. tab hidden) tetap di belakang.
      const stored = readJson<Record<string, string[]>>(key, {})[section] ?? [];
      const rest = stored.filter((k) => !next.includes(k));
      const all = { ...readJson<Record<string, string[]>>(key, {}), [section]: [...next, ...rest] };
      writeJson(key, all);
      setOrders(all);
    },
    [key],
  );

  return { sortItems, move, reorder };
}

/**
 * Migrasi satu kali: gabung urutan lama beberapa section ke satu section baru.
 * Tidak menimpa target yang sudah ada; key duplikat dibuang.
 */
export function migrateTabOrder(userId: string | undefined, target: string, sources: string[]) {
  const key = `purrific:tabOrder:${userId ?? 'anon'}`;
  const all = readJson<Record<string, string[]>>(key, {});
  if (all[target] !== undefined) return;
  const merged: string[] = [];
  for (const src of sources) {
    for (const k of all[src] ?? []) {
      if (!merged.includes(k)) merged.push(k);
    }
  }
  if (merged.length === 0) return;
  writeJson(key, { ...all, [target]: merged });
}

/**
 * Status buka/tutup section sidebar (privat, teams), per-user di localStorage.
 * Default terbuka (key absen = true); disinkronkan antar-instance via event.
 */
export function useCollapsedSections(userId?: string) {
  const key = `purrific:sections:${userId ?? 'anon'}`;
  const [open, setOpen] = useState<Record<string, boolean>>(() => readJson(key, {}));

  useEffect(() => {
    setOpen(readJson(key, {}));
    const onChange = () => setOpen(readJson(key, {}));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const isOpen = useCallback((section: string) => open[section] !== false, [open]);

  const toggle = useCallback(
    (section: string) => {
      const next = { ...readJson<Record<string, boolean>>(key, {}) };
      next[section] = !(next[section] !== false);
      writeJson(key, next);
      setOpen(next);
    },
    [key],
  );

  return { isOpen, toggle };
}

export type PresetSection = 'privat' | 'teams' | 'organisasi' | 'favorit' | 'shortcut';

export type SidebarSection = 'privat' | 'teams' | 'organisasi' | PresetSection;

// Section yang langsung aktif untuk pengguna baru. Favorit/shortcut tetap opt-in.
const DEFAULT_PRESETS: PresetSection[] = ['privat', 'teams', 'organisasi'];

function isPresetSection(s: string): s is PresetSection {
  return s === 'privat' || s === 'teams' || s === 'organisasi' || s === 'favorit' || s === 'shortcut';
}

function presetKeyFor(userId?: string) {
  return `purrific:presetSections:${userId ?? 'anon'}`;
}

function presetKeyV2For(userId?: string) {
  return `purrific:presetSections:v2:${userId ?? 'anon'}`;
}

function readActivePresets(userId?: string): PresetSection[] {
  const v2 = readJson<string[] | null>(presetKeyV2For(userId), null);
  if (v2 !== null) {
    return v2.filter(isPresetSection);
  }
  // Migrasi sekali jalan: preset lama (favorit/shortcut) digabung default,
  // agar user lama tidak kehilangan section. 'sampah' era lama terbuang.
  const next = [...DEFAULT_PRESETS];
  const v1 = readJson<string[] | null>(presetKeyFor(userId), null);
  if (v1) {
    for (const s of v1) {
      if ((s === 'favorit' || s === 'shortcut') && !next.includes(s)) next.push(s);
    }
  }
  return next;
}

function normalizeSections(stored: string[] | null, active: PresetSection[] = []): SidebarSection[] {
  // Belum pernah atur → default. Sudah atur (walau kosong) → hormati persis,
  // tanpa tempel otomatis agar section yang dihapus tetap hilang.
  if (stored === null) return [...DEFAULT_PRESETS];
  const ok = new Set<string>(active);
  return stored.filter((s): s is SidebarSection => ok.has(s));
}

/**
 * Urutan blok section sidebar (subset preset aktif), per-user di localStorage.
 * Default ['privat', 'teams']; disinkronkan antar-instance via event.
 * ID tak dikenal (mis. sisa fitur lama) otomatis dibuang dan ditulis bersih.
 */
export function useSectionOrder(userId?: string) {
  const key = `purrific:sectionOrder:${userId ?? 'anon'}`;
  const [order, setOrder] = useState<SidebarSection[]>(() =>
    normalizeSections(readJson<string[] | null>(key, null), readActivePresets(userId)),
  );

  useEffect(() => {
    const stored = readJson<string[] | null>(key, null);
    const cleaned = normalizeSections(stored, readActivePresets(userId));
    setOrder(cleaned);
    if (stored && (stored.length !== cleaned.length || stored.some((s, i) => s !== cleaned[i]))) {
      writeJson(key, cleaned);
    }
    const onChange = () =>
      setOrder(normalizeSections(readJson<string[] | null>(key, null), readActivePresets(userId)));
    const presetKey = presetKeyV2For(userId);
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener(`${presetKey}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener(`${presetKey}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key, userId]);

  const reorder = useCallback(
    (activeId: SidebarSection, overId: SidebarSection) => {
      const current = normalizeSections(readJson<string[] | null>(key, null), readActivePresets(userId));
      const from = current.indexOf(activeId);
      const to = current.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      writeJson(key, next);
      setOrder(next);
    },
    [key, userId],
  );

  return { order, reorder };
}

/**
 * Preset section yang aktif (privat/teams/favorit/shortcut), per-user di localStorage.
 * 'sampah' versi lama otomatis terbuang oleh filter isPresetSection.
 * Masing-masing maksimal satu.
 */
export function usePresetSections(userId?: string) {
  const key = presetKeyV2For(userId);
  const [active, setActive] = useState<PresetSection[]>(() => readActivePresets(userId));

  useEffect(() => {
    setActive(readActivePresets(userId));
    const onChange = () => setActive(readActivePresets(userId));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key, userId]);

  const add = useCallback(
    (s: PresetSection) => {
      const cur = readActivePresets(userId);
      const next = cur.includes(s) ? cur : [...cur, s];
      if (next !== cur) {
        writeJson(key, next);
        setActive(next);
      }
      // Daftarkan ke urutan section (tambah di akhir bila belum ada).
      const orderKey = `purrific:sectionOrder:${userId ?? 'anon'}`;
      const base = normalizeSections(readJson<string[] | null>(orderKey, null), next);
      if (!base.includes(s)) writeJson(orderKey, [...base, s]);
    },
    [key, userId],
  );

  const remove = useCallback(
    (s: PresetSection) => {
      const next = readActivePresets(userId).filter((v) => v !== s);
      writeJson(key, next);
      setActive(next);
      const orderKey = `purrific:sectionOrder:${userId ?? 'anon'}`;
      writeJson(orderKey, normalizeSections(readJson<string[] | null>(orderKey, null), next));
    },
    [key, userId],
  );

  return { active, add, remove };
}

/**
 * Tab berbintang (kunci tab privat/tim), per-user di localStorage.
 * Tampil di section Favorit bila sectionnya aktif.
 */
export function useFavorites(userId?: string) {
  const key = `purrific:favorites:${userId ?? 'anon'}`;
  const [starred, setStarred] = useState<string[]>(() => readJson(key, []));

  useEffect(() => {
    setStarred(readJson<string[]>(key, []));
    const onChange = () => setStarred(readJson<string[]>(key, []));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const toggle = useCallback(
    (tabKey: string) => {
      const cur = readJson<string[]>(key, []);
      const next = cur.includes(tabKey) ? cur.filter((k) => k !== tabKey) : [...cur, tabKey];
      writeJson(key, next);
      setStarred(next);
    },
    [key],
  );

  return { starred, toggle };
}

export type TrashedItem = {
  kind: 'note' | 'team';
  id: string;
  title: string;
  trashedAt: number;
};

// Isi sampah kedaluwarsa N hari setelah dibuang (ala Notion), lalu dihapus
// permanen otomatis saat app dibuka. Lihat efek kedaluwarsa di AppLayout.
export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function trashDaysLeft(item: TrashedItem, now: number = Date.now()): number {
  const ageDays = Math.floor((now - item.trashedAt) / DAY_MS);
  return Math.min(TRASH_RETENTION_DAYS, Math.max(0, TRASH_RETENTION_DAYS - ageDays));
}

export function isTrashExpired(item: TrashedItem, now: number = Date.now()): boolean {
  return now - item.trashedAt > TRASH_RETENTION_DAYS * DAY_MS;
}

/**
 * Sampah: tab/tim yang dihapus disembunyikan dulu (soft-delete lokal),
 * bisa dikembalikan atau dihapus permanen. API remove BARU dipanggil
 * saat hapus permanen/kosongkan, karena restore tim beserta proyek dan
 * tugasnya tidak mungkin tanpa dukungan backend.
 */
export function useTrash(userId?: string) {
  const key = `purrific:trash:${userId ?? 'anon'}`;
  const [items, setItems] = useState<TrashedItem[]>(() => readJson(key, []));

  useEffect(() => {
    setItems(readJson<TrashedItem[]>(key, []));
    const onChange = () => setItems(readJson<TrashedItem[]>(key, []));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const trash = useCallback(
    (item: Omit<TrashedItem, 'trashedAt'>) => {
      const cur = readJson<TrashedItem[]>(key, []);
      if (cur.some((t) => t.kind === item.kind && t.id === item.id)) return;
      const next = [...cur, { ...item, trashedAt: Date.now() }];
      writeJson(key, next);
      setItems(next);
    },
    [key],
  );

  const restore = useCallback(
    (kind: TrashedItem['kind'], id: string) => {
      const next = readJson<TrashedItem[]>(key, []).filter((t) => !(t.kind === kind && t.id === id));
      writeJson(key, next);
      setItems(next);
    },
    [key],
  );

  return { items, trash, restore };
}

// Baca sinkron langsung dari localStorage (selalu mutakhir, bebas race
// state hook). Dipakai migrasi/repair agar pointer ke isi Sampah tak
// dibuatkan lagi.
export function readTrashIds(userId?: string): Set<string> {
  const key = `purrific:trash:${userId ?? 'anon'}`;
  const items = readJson<TrashedItem[]>(key, []);
  return new Set(items.filter((t) => t.kind === 'note').map((t) => t.id));
}

export type Shortcut = {
  id: string;
  kind: 'route' | 'team' | 'note';
  ref: string;
};

/**
 * Pintas ke halaman app / tim / catatan, per-user di localStorage.
 * Label selalu live dari target; target yang hilang tampil "Tidak tersedia".
 */
export function useShortcuts(userId?: string) {
  const key = `purrific:shortcuts:${userId ?? 'anon'}`;
  const [items, setItems] = useState<Shortcut[]>(() => readJson(key, []));

  useEffect(() => {
    setItems(readJson<Shortcut[]>(key, []));
    const onChange = () => setItems(readJson<Shortcut[]>(key, []));
    window.addEventListener(`${key}:changed`, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(`${key}:changed`, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key]);

  const add = useCallback(
    (s: Omit<Shortcut, 'id'>) => {
      const cur = readJson<Shortcut[]>(key, []);
      if (cur.some((v) => v.kind === s.kind && v.ref === s.ref)) return;
      // ponytail: id acak lokal, tabrakan praktis mustahil per-user; ganti UUID bila butuh sinkron server
      const next = [...cur, { ...s, id: Math.random().toString(36).slice(2) }];
      writeJson(key, next);
      setItems(next);
    },
    [key],
  );

  const remove = useCallback(
    (id: string) => {
      const next = readJson<Shortcut[]>(key, []).filter((v) => v.id !== id);
      writeJson(key, next);
      setItems(next);
    },
    [key],
  );

  return { items, add, remove };
}

export const ORGANIZATIONS_CHANGED_EVENT = 'organizations-changed';

export function notifyOrganizationsChanged() {
  window.dispatchEvent(new Event(ORGANIZATIONS_CHANGED_EVENT));
}

