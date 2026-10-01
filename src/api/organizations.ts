import { api } from '@/lib/api';
import type { Organization, OrganizationMember, OrganizationTeam, ProjectProposal, Task } from '@/types';

export const organizationApi = {
  listMine: () => api.get<{ data: Organization[] }>('/organizations').then((r) => r.data.data),
  create: (body: { name: string; description?: string; teamIds?: string[] }) =>
    api.post<{ data: Organization }>('/organizations', body).then((r) => r.data.data),
  get: (id: string) => api.get<{ data: Organization }>(`/organizations/${id}`).then((r) => r.data.data),
  update: (id: string, body: { name?: string; description?: string }) =>
    api.patch<{ data: Organization }>(`/organizations/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => api.delete<{ message: string }>(`/organizations/${id}`).then((r) => r.data),
  connectTeam: (id: string, teamId: string) =>
    api.post<{ data: OrganizationTeam }>(`/organizations/${id}/teams`, { teamId }).then((r) => r.data.data),
  disconnectTeam: (id: string, teamId: string) =>
    api.delete<{ message: string }>(`/organizations/${id}/teams/${teamId}`).then((r) => r.data),
  addMember: (id: string, email: string) =>
    api.post<{ data: OrganizationMember }>(`/organizations/${id}/members`, { email }).then((r) => r.data.data),
  removeMember: (id: string, userId: string) =>
    api.delete<{ message: string }>(`/organizations/${id}/members/${userId}`).then((r) => r.data),
  proposeProject: (id: string, body: { teamId: string; name: string; description?: string }) =>
    api.post<{ data: ProjectProposal }>(`/organizations/${id}/propose-project`, body).then((r) => r.data.data),
  sendTask: (
    id: string,
    body: {
      projectId: string;
      title: string;
      description?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: string;
    },
  ) => api.post<{ data: Task }>(`/organizations/${id}/send-task`, body).then((r) => r.data.data),
};
