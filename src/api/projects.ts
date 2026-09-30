import { api } from '@/lib/api';
import type { Attachment, BoardColumn, Comment, Project, ProjectMember, ProjectRole, Task, TaskActivity } from '@/types';

export const projectApi = {
  getMyPersonalProject: () =>
    api.get<{ data: Project & { columns: BoardColumn[] } }>('/projects/personal/me').then((r) => r.data.data),
  setActivePersonalProject: (projectId: string) =>
    api
      .patch<{ data: { projectId: string } }>('/projects/personal/active', { projectId })
      .then((r) => r.data.data),
  getProject: (projectId: string) =>
    api.get<{ data: Project }>(`/projects/${projectId}`).then((r) => r.data.data),
  listTasks: (projectId: string) =>
    api.get<{ data: Task[] }>(`/projects/${projectId}/tasks`).then((r) => r.data.data),
  listAttachments: (projectId: string) =>
    api.get<{ data: Attachment[] }>(`/projects/${projectId}/attachments`).then((r) => r.data.data),
  listAllComments: (projectId: string) =>
    api
      .get<{ data: (Comment & { task: Pick<Task, 'id' | 'title'> })[] }>(`/projects/${projectId}/comments`)
      .then((r) => r.data.data),
  listAllActivities: (projectId: string) =>
    api
      .get<{ data: (TaskActivity & { task: Pick<Task, 'id' | 'title'> })[] }>(`/projects/${projectId}/activities`)
      .then((r) => r.data.data),
  reorderTasks: (projectId: string, columnId: string, orderedIds: string[]) =>
    api
      .patch<{ data: { orderedIds: string[] } }>(`/projects/${projectId}/tasks/reorder`, { columnId, orderedIds })
      .then((r) => r.data.data),
  createTask: (
    projectId: string,
    body: { title: string; description?: string; assigneeIds?: string[]; priority?: Task['priority']; columnId?: string; dueDate?: string },
  ) => api.post<{ data: Task }>(`/projects/${projectId}/tasks`, body).then((r) => r.data.data),
  listColumns: (projectId: string) =>
    api.get<{ data: BoardColumn[] }>(`/projects/${projectId}/columns`).then((r) => r.data.data),
  createColumn: (projectId: string, body: { name: string }) =>
    api.post<{ data: BoardColumn }>(`/projects/${projectId}/columns`, body).then((r) => r.data.data),
  updateColumn: (projectId: string, columnId: string, body: { name?: string; color?: string }) =>
    api.patch<{ data: BoardColumn }>(`/projects/${projectId}/columns/${columnId}`, body).then((r) => r.data.data),
  reorderColumns: (projectId: string, orderedIds: string[]) =>
    api
      .patch<{ data: { orderedIds: string[] } }>(`/projects/${projectId}/columns/reorder`, { orderedIds })
      .then((r) => r.data.data),
  deleteColumn: (projectId: string, columnId: string, targetColumnId?: string) =>
    api
      .delete<{ data: { id: string; movedCount: number } }>(`/projects/${projectId}/columns/${columnId}`, {
        data: targetColumnId ? { targetColumnId } : {},
      })
      .then((r) => r.data.data),
  listRoles: (projectId: string) =>
    api.get<{ data: ProjectRole[] }>(`/projects/${projectId}/roles`).then((r) => r.data.data),
  createRole: (projectId: string, body: { name: string; permissions?: string[] }) =>
    api.post<{ data: ProjectRole }>(`/projects/${projectId}/roles`, body).then((r) => r.data.data),
  updateRole: (projectId: string, roleId: string, body: { name?: string; permissions?: string[] }) =>
    api.patch<{ data: ProjectRole }>(`/projects/${projectId}/roles/${roleId}`, body).then((r) => r.data.data),
  deleteRole: (projectId: string, roleId: string, targetRoleId?: string) =>
    api
      .delete<{ data: { id: string; movedCount: number } }>(`/projects/${projectId}/roles/${roleId}`, {
        data: targetRoleId ? { targetRoleId } : {},
      })
      .then((r) => r.data.data),
  listProjectMembers: (projectId: string) =>
    api.get<{ data: ProjectMember[] }>(`/projects/${projectId}/members`).then((r) => r.data.data),
  setMemberRole: (projectId: string, userId: string, roleId: string) =>
    api
      .patch<{ data: ProjectMember }>(`/projects/${projectId}/members/${userId}`, { roleId })
      .then((r) => r.data.data),
  updateProject: (projectId: string, body: Partial<Pick<Project, 'name' | 'description' | 'avatarUrl' | 'status'>>) =>
    api.patch<{ data: Project }>(`/projects/${projectId}`, body).then((r) => r.data.data),
  removeProject: (projectId: string) =>
    api.delete<{ data: { id: string } }>(`/projects/${projectId}`).then((r) => r.data.data),
};
