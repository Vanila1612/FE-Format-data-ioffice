import { useAuth } from '../services/auth';

export function SettingsPage() {
  const { user } = useAuth();
  return <section className="panel settings">
    <h2>Settings</h2>
    <p>Người dùng hiện tại: {user?.displayName}</p>
    <p>Vai trò: {user?.role}</p>
  </section>;
}
