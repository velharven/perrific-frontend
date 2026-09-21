import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

export interface UndoEntry {
  id: number;
  label: string;
  undo: () => void;
}

interface UndoStackValue {
  push: (label: string, undo: () => void) => number;
  undoLast: () => boolean;
  undoEntry: (id: number) => boolean;
  clear: () => void;
}

const UndoStackContext = createContext<UndoStackValue | null>(null);

// Batas agar snapshot (baris/blok) tak menumpuk tanpa batas.
const MAX_ENTRIES = 30;
let nextId = 1;

export function isUndoEditableTarget(el: HTMLElement | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// Satu stack undo per halaman: Ctrl/Cmd+Z mengembalikan hapusan satu per
// satu (LIFO), bukan cuma yang terakhir. Unmount = hangus.
export function UndoStackProvider({ children }: { children: ReactNode }) {
  const stack = useRef<UndoEntry[]>([]);

  const push = useCallback((label: string, undo: () => void) => {
    const id = nextId++;
    stack.current.push({ id, label, undo });
    if (stack.current.length > MAX_ENTRIES) {
      stack.current.splice(0, stack.current.length - MAX_ENTRIES);
    }
    return id;
  }, []);

  const undoLast = useCallback(() => {
    const entry = stack.current.pop();
    if (!entry) return false;
    entry.undo();
    return true;
  }, []);

  const undoEntry = useCallback((id: number) => {
    const index = stack.current.findIndex((e) => e.id === id);
    if (index < 0) return false;
    const [entry] = stack.current.splice(index, 1);
    entry.undo();
    return true;
  }, []);

  const clear = useCallback(() => {
    stack.current = [];
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      if (e.key !== 'z' && e.key !== 'Z') return;
      if (isUndoEditableTarget(e.target as HTMLElement | null)) return;
      if (stack.current.length === 0) return;
      e.preventDefault();
      undoLast();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoLast]);

  const value = useMemo(() => ({ push, undoLast, undoEntry, clear }), [push, undoLast, undoEntry, clear]);
  return <UndoStackContext.Provider value={value}>{children}</UndoStackContext.Provider>;
}

// Null bila di luar provider (dipakai useTableData sebagai fallback lokal).
export function useUndoStack(): UndoStackValue | null {
  return useContext(UndoStackContext);
}

export function useUndo(): UndoStackValue {
  const ctx = useContext(UndoStackContext);
  if (!ctx) throw new Error('useUndo harus dipakai di dalam UndoStackProvider');
  return ctx;
}
