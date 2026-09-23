export interface User {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  hasPassword?: boolean;
  createdAt?: string;
}

export type NoteKind = 'NOTE' | 'DASHBOARD' | 'DAILY' | 'TABLE';

export interface Note {
  id: string;
  userId: string;
  kind: NoteKind;
  parentId: string | null;
  title: string;
  content: string;
  coverUrl: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type TableColumnType =
  | 'TEXT'
  | 'NUMBER'
  | 'SELECT'
  | 'DATE'
  | 'CHECKBOX'
  | 'STATUS'
  | 'PERSON'
  | 'FILES'
  | 'URL'
  | 'PHONE'
  | 'EMAIL'
  | 'CATEGORY'
  | 'START_TIME'
  | 'END_TIME';
export interface TableColumn { id: string; name: string; type: TableColumnType; icon?: string | null; options: string[]; order: number; }
export interface TableRow { id: string; noteId: string | null; values: Record<string, unknown>; order: number; }
export interface TableData { id: string; noteId: string; note: Note; columns: TableColumn[]; rows: TableRow[]; }

export type TeamRole = 'ADMIN' | 'MEMBER';

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  inviteCode?: string | null;
  inviteExpiresAt?: string | null;
  canManageInvite?: boolean;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  user?: User;
}

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JoinRequest {
  id: string;
  teamId: string;
  userId: string;
  status: JoinRequestStatus;
  createdAt: string;
  decidedAt?: string | null;
  decidedById?: string | null;
  user?: User;
  team?: Pick<Team, 'id' | 'name'>;
}

export type PendingTask = Task & {
  project: Pick<Project, 'id' | 'name'>;
};

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
}

export type PermissionKey =
  | 'task.create'
  | 'task.move'
  | 'task.delete'
  | 'task.approve'
  | 'member.approve'
  | 'column.manage'
  | 'invite.manage'
  | 'project.manage'
  | 'role.manage';

export const PERMISSION_META: { key: PermissionKey; label: string; desc: string }[] = [
  { key: 'task.create', label: 'Buat task', desc: 'Membuat task/usulan baru' },
  { key: 'task.move', label: 'Pindah task', desc: 'Menggeser card antar kolom' },
  { key: 'task.delete', label: 'Hapus task', desc: 'Menghapus task' },
  { key: 'task.approve', label: 'Setujui task', desc: 'Menyetujui/menolak usulan task' },
  { key: 'member.approve', label: 'Setujui anggota', desc: 'Menerima/menolak permintaan bergabung' },
  { key: 'column.manage', label: 'Kelola kolom', desc: 'Tambah/ubah/hapus kolom board' },
  { key: 'invite.manage', label: 'Kelola invite', desc: 'Atur link, expiry, kode baru' },
  { key: 'project.manage', label: 'Atur project', desc: 'Ubah nama, deskripsi, status, hapus' },
  { key: 'role.manage', label: 'Kelola role', desc: 'Atur role dan jabatan anggota' },
];

export interface ProjectRole {
  id: string;
  projectId: string;
  name: string;
  system: string | null;
  permissions: PermissionKey[];
  createdAt: string;
  _count?: { members: number };
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleId: string;
  createdAt: string;
  user: User;
  role: ProjectRole;
}

export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  column: Pick<BoardColumn, 'id' | 'name' | 'order'>;
  number: number;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  approval: ApprovalStatus;
  dueDate?: string | null;
  order: number;
  assignees: Pick<User, 'id' | 'name' | 'avatarUrl'>[];
  watchers?: Pick<User, 'id' | 'name' | 'avatarUrl'>[];
  createdById?: string | null;
  createdBy?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  comments?: Comment[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
}

export type ActivityType = 'TASK' | 'BREAKDOWN' | 'CUSTOM';
export type ActivityStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

export interface ChecklistItem {
  id: string;
  activityId: string;
  text: string;
  completed: boolean;
  order: number;
  createdAt: string;
}

export interface DailyActivity {
  id: string;
  userId: string;
  taskId?: string | null;
  title: string;
  description?: string | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  type: ActivityType;
  status: ActivityStatus;
  icon?: string | null;
  order: number;
  checklistItems: ChecklistItem[];
  task?: Pick<Task, 'id' | 'title' | 'priority'> | null;
  customValues?: Record<string, string | number | boolean> | null;
}

export type DailyColumnType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'CHECKBOX'
  | 'STATUS'
  | 'PERSON'
  | 'FILES'
  | 'URL'
  | 'PHONE'
  | 'EMAIL'
  | 'CATEGORY'
  | 'START_TIME'
  | 'END_TIME';

export interface DailyColumn {
  id: string;
  userId: string;
  name: string;
  type: DailyColumnType;
  icon?: string | null;
  options?: string[] | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'DEADLINE_APPROACHING'
  | 'TASK_OVERDUE'
  | 'ACTIVITY_REMINDER'
  | 'TEAM_INVITE'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  read: boolean;
  readonly relatedTaskId?: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface Attachment {
  id: string;
  taskId: string;
  filename: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  description?: string | null;
  createdAt: string;
}

export type TaskActivityKind = 'MOVED' | 'ASSIGNED' | 'UNASSIGNED' | 'ATTACHMENT_ADDED';

export interface TaskActivityMeta {
  filename?: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string;
  kind: TaskActivityKind;
  fromColumn?: string | null;
  toColumn?: string | null;
  targetUserId?: string | null;
  meta?: TaskActivityMeta | null;
  createdAt: string;
  actor?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  targetUser?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
}
