import { api } from '@/lib/api';
import type { JoinRequest, JoinRequestStatus, PendingTask, Team, TeamMember, Project } from '@/types';

export const teamApi = {
  listMyTeams: () => api.get<{ data: Team[] }>('/teams').then((r) => r.data.data),
  createTeam: (body: { name: string; description?: string }) =>
    api.post<{ data: Team }>('/teams', body).then((r) => r.data.data),
  getTeam: (teamId: string) => api.get<{ data: Team }>(`/teams/${teamId}`).then((r) => r.data.data),
  update: (teamId: string, body: { name?: string; description?: string | null }) =>
    api.patch<{ data: Team }>(`/teams/${teamId}`, body).then((r) => r.data.data),
  remove: (teamId: string) =>
    api.delete<{ data: { id: string } }>(`/teams/${teamId}`).then((r) => r.data.data),
  addMember: (teamId: string, body: { email: string; role?: 'ADMIN' | 'MEMBER' }) =>
    api.post<{ data: TeamMember }>(`/teams/${teamId}/members`, body).then((r) => r.data.data),
  removeMember: (teamId: string, userId: string) =>
    api.delete<{ data: { userId: string } }>(`/teams/${teamId}/members/${userId}`).then((r) => r.data.data),
  joinTeam: (code: string) =>
    api.post<{ data: JoinRequest }>(`/teams/join`, { code }).then((r) => r.data.data),
  listJoinRequests: (teamId: string, status: JoinRequestStatus = 'PENDING') =>
    api.get<{ data: JoinRequest[] }>(`/teams/${teamId}/join-requests?status=${status}`).then((r) => r.data.data),
  approveJoinRequest: (teamId: string, requestId: string) =>
    api.post<{ data: JoinRequest }>(`/teams/${teamId}/join-requests/${requestId}/approve`).then((r) => r.data.data),
  rejectJoinRequest: (teamId: string, requestId: string) =>
    api.post<{ data: JoinRequest }>(`/teams/${teamId}/join-requests/${requestId}/reject`).then((r) => r.data.data),
  listPendingTasks: (teamId: string) =>
    api.get<{ data: PendingTask[] }>(`/teams/${teamId}/pending-tasks`).then((r) => r.data.data),
  updateInvite: (teamId: string, body: { expiresInHours: number | null; regenerate?: boolean }) =>
    api.patch<{ data: Team }>(`/teams/${teamId}/invite`, body).then((r) => r.data.data),
  listProjects: (teamId: string) =>
    api.get<{ data: Project[] }>(`/teams/${teamId}/projects`).then((r) => r.data.data),
  createProject: (teamId: string, body: { name: string; description?: string }) =>
    api.post<{ data: Project }>(`/teams/${teamId}/projects`, body).then((r) => r.data.data),
};
