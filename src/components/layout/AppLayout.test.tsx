import { describe, it, expect } from 'vitest';

describe('Sidebar tab reordering and drag-and-drop logic', () => {
  interface NoteItem {
    id: string;
    title: string;
    parentId: string | null;
    order: number;
  }

  const initialNotes: NoteItem[] = [
    { id: 'note-0', title: 'Catatan 0', parentId: null, order: 0 },
    { id: 'note-1', title: 'Catatan 1', parentId: null, order: 1 },
    { id: 'note-2', title: 'Catatan 2', parentId: null, order: 2 },
    { id: 'note-3', title: 'Catatan 3', parentId: null, order: 3 },
  ];

  function calculateDropBeforeIdAndOptimisticOrder(
    notes: NoteItem[],
    movingId: string,
    targetId: string,
  ) {
    const parent = null;
    const sibs = notes
      .filter((n) => (n.parentId ?? null) === parent)
      .sort((a, b) => a.order - b.order);
    const from = sibs.findIndex((n) => n.id === movingId);
    const to = sibs.findIndex((n) => n.id === targetId);

    if (from === -1 || to === -1 || from === to) {
      return { beforeId: undefined, newNotes: notes, nextSibs: sibs };
    }

    const remaining = sibs.filter((n) => n.id !== movingId);
    const beforeId = remaining[to]?.id ?? null;

    const nextSibs = [...sibs];
    const [movedItem] = nextSibs.splice(from, 1);
    nextSibs.splice(to, 0, movedItem);

    const orderMap = new Map<string, number>();
    nextSibs.forEach((item, idx) => orderMap.set(item.id, idx));

    const newNotes = notes.map((n) =>
      orderMap.has(n.id) ? { ...n, order: orderMap.get(n.id)! } : n,
    );

    return { beforeId, newNotes, nextSibs };
  }

  function calculateMoveMenuBeforeIdAndOptimisticOrder(
    notes: NoteItem[],
    noteId: string,
    dir: -1 | 1,
  ) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return null;
    const parent = note.parentId ?? null;
    const sibs = notes
      .filter((n) => (n.parentId ?? null) === parent)
      .sort((a, b) => a.order - b.order);
    const idx = sibs.findIndex((n) => n.id === note.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sibs.length) return null;

    const beforeId = dir === -1 ? sibs[j].id : (sibs[j + 1]?.id ?? null);

    const nextSibs = [...sibs];
    const [moved] = nextSibs.splice(idx, 1);
    nextSibs.splice(j, 0, moved);

    const orderMap = new Map<string, number>();
    nextSibs.forEach((item, o) => orderMap.set(item.id, o));

    const newNotes = notes.map((n) =>
      orderMap.has(n.id) ? { ...n, order: orderMap.get(n.id)! } : n,
    );

    return { beforeId, newNotes, nextSibs };
  }

  describe('Drag and drop to bottom and top', () => {
    it('accurately drops top item to bottom (beforeId is null)', () => {
      const result = calculateDropBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-0',
        'note-3',
      );

      // In backend, beforeId = null appends item at the end of siblings
      expect(result.beforeId).toBeNull();
      expect(result.nextSibs.map((n) => n.id)).toEqual([
        'note-1',
        'note-2',
        'note-3',
        'note-0',
      ]);
      expect(result.newNotes.find((n) => n.id === 'note-0')?.order).toBe(3);
    });

    it('accurately drops bottom item to top (beforeId is first item)', () => {
      const result = calculateDropBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-3',
        'note-0',
      );

      expect(result.beforeId).toBe('note-0');
      expect(result.nextSibs.map((n) => n.id)).toEqual([
        'note-3',
        'note-0',
        'note-1',
        'note-2',
      ]);
      expect(result.newNotes.find((n) => n.id === 'note-3')?.order).toBe(0);
    });

    it('accurately drops item downwards into middle', () => {
      // Move note-0 to position of note-2
      const result = calculateDropBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-0',
        'note-2',
      );

      // In remaining: [note-1, note-2, note-3], remaining[2] is note-3
      // inserting before note-3 places note-0 at index 2 (after note-2)
      expect(result.beforeId).toBe('note-3');
      expect(result.nextSibs.map((n) => n.id)).toEqual([
        'note-1',
        'note-2',
        'note-0',
        'note-3',
      ]);
    });

    it('accurately drops item upwards into middle', () => {
      // Move note-3 to position of note-1
      const result = calculateDropBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-3',
        'note-1',
      );

      // In remaining: [note-0, note-1, note-2], remaining[1] is note-1
      // inserting before note-1 places note-3 at index 1
      expect(result.beforeId).toBe('note-1');
      expect(result.nextSibs.map((n) => n.id)).toEqual([
        'note-0',
        'note-3',
        'note-1',
        'note-2',
      ]);
    });
  });

  describe('Context menu Naik / Turun', () => {
    it('moves note down correctly', () => {
      const result = calculateMoveMenuBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-1',
        1,
      );

      expect(result?.beforeId).toBe('note-3'); // sibs[j+1] where j=2
      expect(result?.nextSibs.map((n) => n.id)).toEqual([
        'note-0',
        'note-2',
        'note-1',
        'note-3',
      ]);
    });

    it('moves note to the very bottom via Turun with beforeId null', () => {
      const result = calculateMoveMenuBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-2',
        1,
      );

      expect(result?.beforeId).toBeNull(); // j=3, sibs[4] is undefined -> null
      expect(result?.nextSibs.map((n) => n.id)).toEqual([
        'note-0',
        'note-1',
        'note-3',
        'note-2',
      ]);
    });

    it('moves note up correctly', () => {
      const result = calculateMoveMenuBeforeIdAndOptimisticOrder(
        initialNotes,
        'note-2',
        -1,
      );

      expect(result?.beforeId).toBe('note-1'); // sibs[j] where j=1
      expect(result?.nextSibs.map((n) => n.id)).toEqual([
        'note-0',
        'note-2',
        'note-1',
        'note-3',
      ]);
    });
  });

  describe('Organization tab reordering', () => {
    it('reorders organizations list correctly', () => {
      const orgKeys = ['org-1', 'org-2', 'org-3'];
      const from = orgKeys.indexOf('org-1');
      const to = orgKeys.indexOf('org-3');
      const next = [...orgKeys];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      expect(next).toEqual(['org-2', 'org-3', 'org-1']);
    });
  });
});
