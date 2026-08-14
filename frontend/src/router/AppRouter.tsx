import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { useAuth } from '../services/auth';
import { DashboardPage } from '../pages/DashboardPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { ImportPage } from '../pages/ImportPage';
import { ImportsPage } from '../pages/ImportsPage';
import { LoginPage } from '../pages/LoginPage';
import { ReportsPage } from '../pages/ReportsPage';
import { RulesPage } from '../pages/RulesPage';
import { UsersPage } from '../pages/UsersPage';
import { SnapshotsPage } from '../pages/SnapshotsPage';
import { UnitMappingsPage } from '../pages/UnitMappingsPage';
import { LoadingState } from '../components/State';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

export function AppRouter() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/unit-mappings" element={<UnitMappingsPage />} />
      <Route path="/imports" element={<ImportsPage />} />
      <Route path="/snapshots" element={<SnapshotsPage />} />
      <Route path="/users" element={<UsersPage />} />
    </Route>
  </Routes>;
}
