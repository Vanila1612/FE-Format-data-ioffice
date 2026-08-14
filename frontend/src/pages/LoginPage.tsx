import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../services/auth';

export function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123456');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Đăng nhập thành công');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return <div className="login-screen">
    <form className="login-card" onSubmit={submit}>
      <p>iOffice</p>
      <h1>Rà soát văn bản đi</h1>
      <label>Tài khoản<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
      <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button disabled={loading}>{loading ? 'Đang đăng nhập' : 'Đăng nhập'}</button>
    </form>
  </div>;
}
