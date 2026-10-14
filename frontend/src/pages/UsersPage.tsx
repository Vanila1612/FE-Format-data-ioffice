import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { User } from '../types/api';
import { dateText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

function parseTimestamp(value?: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'USER' as User['role'] });
  const users = useQuery({ queryKey: ['users'], queryFn: async () => unwrap<User[]>(await api.get('/users')) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const create = useMutation({
    mutationFn: async () => unwrap<User>(await api.post('/users', form)),
    onSuccess: async () => {
      toast.success('Đã tạo tài khoản');
      setForm({ username: '', displayName: '', password: '', role: 'USER' });
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });
  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> & { password?: string } }) =>
      unwrap<User>(await api.put(`/users/${id}`, data)),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message)
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await api.delete(`/users/${id}`)),
    onSuccess: async () => {
      toast.success('Đã xóa tài khoản');
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });

  const sortedUsers = useMemo(() => {
    return [...(users.data || [])].sort((a, b) => {
      const timeA = parseTimestamp(a.updatedAt) || parseTimestamp(a.createdAt);
      const timeB = parseTimestamp(b.updatedAt) || parseTimestamp(b.createdAt);
      return timeB - timeA;
    });
  }, [users.data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (users.isLoading) return <LoadingState />;
  if (users.isError) return <ErrorState message={users.error.message} retry={() => users.refetch()} />;

  return (
    <section className="page-stack">
      <div className="panel">
        <h2>Tạo tài khoản</h2>
        <form className="form-grid" onSubmit={submit}>
          <input
            required
            placeholder="Tên đăng nhập"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
          <input
            required
            placeholder="Họ tên hiển thị"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Mật khẩu (ít nhất 8 ký tự)"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as User['role'] })}
          >
            <option value="USER">Người dùng</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>
          <button disabled={create.isPending}>
            {create.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Phân quyền tài khoản</h2>
        {sortedUsers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Quyền</th>
                  <th>Ngày tạo</th>
                  <th>Ngày cập nhật</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.displayName}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(event) =>
                          update.mutate({ id: user.id, data: { role: event.target.value as User['role'] } })
                        }
                      >
                        <option value="USER">Người dùng</option>
                        <option value="ADMIN">Quản trị viên</option>
                      </select>
                    </td>
                    <td>{user.createdAt ? dateText(user.createdAt) : '—'}</td>
                    <td>{user.updatedAt ? dateText(user.updatedAt) : '—'}</td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => {
                          const password = prompt(`Mật khẩu mới cho ${user.username} (ít nhất 8 ký tự):`);
                          if (password) update.mutate({ id: user.id, data: { password } });
                        }}
                      >
                        Đặt lại mật khẩu
                      </button>
                      <button
                        className="danger"
                        onClick={() => confirm(`Xóa tài khoản ${user.username}?`) && remove.mutate(user.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="help-text">
          Quản trị viên được quản lý tài khoản, dữ liệu, quy tắc và đơn vị chuẩn hóa. Người dùng được nhập, xem văn bản, tạo thống kê và lưu kết quả.
        </p>
      </div>
    </section>
  );
}
