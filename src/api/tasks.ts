import { api } from '@/lib/api';
import type { Task, Comment, Attachment, TaskActivity, User, AssignedTeamTask } from '@/types';

export type TaskWatcher = Pick<User, 'id' | 'name' | 'avatarUrl'>;

export const taskApi = {
  listMyAssigned: () =>
    api.get<{ data: AssignedTeamTask[] }>('/tasks/assigned/me').then((r) => r.data.data),
  get: (taskId: string) =>
    api.get<{ data: Task }>(`/tasks/${taskId}`).then((r) => r.data.data),
  update: (taskId: string, body: Partial<Task>) =>
    api.patch<{ data: Task }>(`/tasks/${taskId}`, body).then((r) => r.data.data),
  remove: (taskId: string) => api.delete<{ data: { id: string } }>(`/tasks/${taskId}`).then((r) => r.data.data),
  addComment: (taskId: string, content: string) =>
    api.post<{ data: Comment }>(`/tasks/${taskId}/comments`, { content }).then((r) => r.data.data),
  listComments: (taskId: string) =>
    api.get<{ data: Comment[] }>(`/tasks/${taskId}/comments`).then((r) => r.data.data),
  updateComment: (taskId: string, commentId: string, content: string) =>
    api.patch<{ data: Comment }>(`/tasks/${taskId}/comments/${commentId}`, { content }).then((r) => r.data.data),
  removeComment: (taskId: string, commentId: string) =>
    api.delete<{ data: { id: string } }>(`/tasks/${taskId}/comments/${commentId}`).then((r) => r.data.data),
  listActivities: (taskId: string) =>
    api.get<{ data: TaskActivity[] }>(`/tasks/${taskId}/activities`).then((r) => r.data.data),
  addAttachment: (taskId: string, body: { filename: string; mimeType: string; size: number; dataUrl: string }) =>
    api.post<{ data: Attachment }>(`/tasks/${taskId}/attachments`, body).then((r) => r.data.data),
  updateAttachment: (taskId: string, attachmentId: string, description: string | null) =>
    api
      .patch<{ data: Attachment }>(`/tasks/${taskId}/attachments/${attachmentId}`, { description })
      .then((r) => r.data.data),
  removeAttachment: (taskId: string, attachmentId: string) =>
    api
      .delete<{ data: { id: string } }>(`/tasks/${taskId}/attachments/${attachmentId}`)
      .then((r) => r.data.data),
  addWatcher: (taskId: string, userId?: string) =>
    api.post<{ data: TaskWatcher }>(`/tasks/${taskId}/watchers`, userId ? { userId } : {}).then((r) => r.data.data),
  removeWatcher: (taskId: string, userId: string) =>
    api
      .delete<{ data: { userId: string } }>(`/tasks/${taskId}/watchers/${userId}`)
      .then((r) => r.data.data),
  approve: (taskId: string, body?: { assigneeIds?: string[] }) =>
    api.patch<{ data: Task }>(`/tasks/${taskId}/approve`, body).then((r) => r.data.data),
  reject: (taskId: string) =>
    api.patch<{ data: Task }>(`/tasks/${taskId}/reject`).then((r) => r.data.data),
};
