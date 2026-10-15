import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { useAuth } from '../services/auth';
import { AssistantPage } from '../pages/AssistantPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { ImportPage } from '../pages/ImportPage';
import { ImportsPage } from '../pages/ImportsPage';
import { LoginPage } from '../pages/LoginPage';
import { ReportsPage } from '../pages/ReportsPage';
import { RulesPage } from '../pages/RulesPage';
import { UsersPage } from '../pages/UsersPage';
import { SignersPage } from '../pages/SignersPage';
import { SnapshotsPage } from '../pages/SnapshotsPage';
import { UnitMappingsPage } from '../pages/UnitMappingsPage';
import { LoadingState } from '../components/State';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user?.role !== 'ADMIN') return <Navigate to="/reports" replace />;
  return <>{children}</>;
}

function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user?.role !== 'ADMIN') return <Navigate to="/reports" replace />;
  return <DashboardPage />;
}

function CatchAllRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Navigate to={user?.role === 'ADMIN' ? '/' : '/reports'} replace />;
}

export function AppRouter() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route path="/" element={<IndexRoute />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/documents" element={<AdminRoute><DocumentsPage /></AdminRoute>} />
      <Route path="/import" element={<AdminRoute><ImportPage /></AdminRoute>} />
      <Route path="/assistant" element={<AdminRoute><AssistantPage /></AdminRoute>} />
      <Route path="/rules" element={<AdminRoute><RulesPage /></AdminRoute>} />
      <Route path="/unit-mappings" element={<AdminRoute><UnitMappingsPage /></AdminRoute>} />
      <Route path="/signers" element={<AdminRoute><SignersPage /></AdminRoute>} />
      <Route path="/imports" element={<AdminRoute><ImportsPage /></AdminRoute>} />
      <Route path="/snapshots" element={<AdminRoute><SnapshotsPage /></AdminRoute>} />
      <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
      <Route path="*" element={<CatchAllRoute />} />
    </Route>
  </Routes>;
}
