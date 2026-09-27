import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/store/auth';
import { SocketProvider } from '@/store/socket';
import { getGoogleClientId } from '@/lib/google';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import JoinPage from '@/pages/JoinPage';
import SettingsPage from '@/pages/SettingsPage';
import BoardPage from '@/pages/BoardPage';
import TaskDetailPage from '@/pages/TaskDetailPage';
import ProjectPage from '@/pages/ProjectPage';
import ProjectLayout from '@/components/layout/ProjectLayout';
import ProjectApprovalPage from '@/pages/ProjectApprovalPage';
import ProjectSettingsPage from '@/pages/ProjectSettingsPage';
import NotePage from '@/pages/NotePage';
import TeamPage from '@/pages/TeamPage';
import TeamProjectsPage from '@/pages/TeamProjectsPage';
import TeamSettingsPage from '@/pages/TeamSettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PrivatRedirect from '@/pages/PrivatRedirect';
import DailyInstancePage from '@/pages/DailyInstancePage';
import TablePage from '@/pages/TablePage';

export default function App() {
  const googleClientId = getGoogleClientId();
  const tree = (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/join/:code" element={<JoinPage />} />
              <Route element={<AppLayout />}>
                {/* /notes dan /daily polos = pintu depan, langsung antar
                    ke catatan "Selamat Datang" atau harian pertama milik user */}
                <Route path="/notes" element={<PrivatRedirect kind="NOTE" />} />
                <Route path="/dashboard" element={<PrivatRedirect kind="NOTE" />} />
                <Route path="/dashboard/:dashboardId" element={<PrivatRedirect kind="NOTE" />} />
                <Route path="/board/:projectId" element={<BoardPage />} />
                <Route path="/board/:projectId/task/:taskId" element={<TaskDetailPage />} />
                <Route path="/daily" element={<PrivatRedirect kind="DAILY" />} />
                <Route path="/daily/:dailyId" element={<DailyInstancePage />} />
                <Route path="/notes/:noteId" element={<NotePage />} />
                <Route path="/tables/:tableId" element={<TablePage />} />
                <Route path="/team/:teamId/projects" element={<TeamProjectsPage />} />
                <Route path="/team/:teamId/settings" element={<TeamSettingsPage />} />
                <Route path="/team/:teamId" element={<TeamPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="/projects/:projectId" element={<ProjectLayout />}>
                <Route index element={<ProjectPage />} />
                <Route path="kanban" element={<BoardPage />} />
                <Route path="kanban/:taskId" element={<TaskDetailPage />} />
                <Route path="persetujuan" element={<ProjectApprovalPage />} />
                <Route path="settings" element={<ProjectSettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );

  if (!googleClientId) return tree;
  return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}
