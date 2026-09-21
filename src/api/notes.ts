import { api } from '@/lib/api';
import type { Note, TableData, TableColumn, TableRow } from '@/types';

export const noteApi = {
  listMine: () =>
    api.get<{ data: Note[] }>('/notes/me').then((r) => r.data.data),
  create: (body?: { title?: string; kind?: Note['kind']; parentId?: string | null }) =>
    api.post<{ data: Note }>('/notes', body ?? {}).then((r) => r.data.data),
  get: (noteId: string) =>
    api.get<{ data: Note }>(`/notes/${noteId}`).then((r) => r.data.data),
  update: (noteId: string, body: { title?: string; content?: string; coverUrl?: string | null }) =>
    api.patch<{ data: Note }>(`/notes/${noteId}`, body).then((r) => r.data.data),
  remove: (noteId: string) =>
    api.delete<{ data: { id: string } }>(`/notes/${noteId}`).then((r) => r.data.data),
  move: (noteId: string, body: { parentId: string | null; beforeId?: string | null }) =>
    api.patch<{ data: Note }>(`/notes/${noteId}/move`, body).then((r) => r.data.data),
};

export const tableApi = {
  get: (noteId: string) => api.get<{ data: TableData }>(`/tables/${noteId}`).then((r) => r.data.data),
  save: (noteId: string, body: { columns: TableColumn[]; rows: TableRow[] }) =>
    api.put<{ data: TableData }>(`/tables/${noteId}`, body).then((r) => r.data.data),
};
