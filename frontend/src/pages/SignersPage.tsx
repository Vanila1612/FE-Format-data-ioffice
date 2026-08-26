import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { Signer } from '../types/api';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { SignerCell } from '../components/SignerCell';

const emptyForm = { username: '', fullName: '', position: 'Phó Tổng Giám đốc' };

export function SignersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Signer | null>(null);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');

  const signers = useQuery({
    queryKey: ['signers'],
    queryFn: async () => unwrap<Signer[]>(await api.get('/signers'))
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['signers'] });
  const create = useMutation({ mutationFn: async () => unwrap(await api.post('/signers', form)), onSuccess: async () => { toast.success('Đã thêm người ký'); setForm(emptyForm); await invalidate(); }, onError: (error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: async (signer: Signer) => unwrap(await api.put(`/signers/${signer.id}`, { username: signer.username, fullName: signer.fullName, position: signer.position })), onSuccess: async () => { toast.success('Đã cập nhật người ký'); setEditing(null); await invalidate(); }, onError: (error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/signers/${id}`)), onSuccess: invalidate, onError: (error) => toast.error(error.message) });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (signers.isLoading) return <LoadingState />;
  if (signers.isError) return <ErrorState message={signers.error.message} retry={() => signers.refetch()} />;

  const all = signers.data!;
  const positions = [...new Set(all.map((signer) => signer.position))].sort((a, b) => a.localeCompare(b, 'vi'));
  const needle = search.trim().toLowerCase();
  const rows = all.filter((signer) =>
    (!position || signer.position === position) &&
    (!needle || `${signer.username} ${signer.fullName} ${signer.position}`.toLowerCase().includes(needle)));

  return <section className="page-stack">
    <div className="panel">
      <form className="form-grid" onSubmit={submit}>
        <input required placeholder="Tên đăng nhập (vd: phamtoanvuong)" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        <input required placeholder="Họ và tên" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        <input required placeholder="Chức danh" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
        <button disabled={create.isPending}>Thêm người ký</button>
      </form>
    </div>

    {editing && <div className="panel">
      <p className="form-note">Đang sửa người ký “{editing.username}”.</p>
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); update.mutate(editing); }}>
        <input required placeholder="Tên đăng nhập" value={editing.username} onChange={(event) => setEditing({ ...editing, username: event.target.value })} />
        <input required placeholder="Họ và tên" value={editing.fullName} onChange={(event) => setEditing({ ...editing, fullName: event.target.value })} />
        <input required placeholder="Chức danh" value={editing.position} onChange={(event) => setEditing({ ...editing, position: event.target.value })} />
        <div className="button-row"><button disabled={update.isPending}>Lưu thay đổi</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Hủy</button></div>
      </form>
    </div>}

    <div className="panel panel-stack">
      <div className="toolbar">
        <input type="search" placeholder="Tìm theo tên đăng nhập, họ tên, chức danh" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm người ký" />
        <select value={position} onChange={(event) => setPosition(event.target.value)} aria-label="Lọc theo chức danh">
          <option value="">Tất cả chức danh</option>
          {positions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <span className="muted">{rows.length}/{all.length} người ký</span>
      </div>
      {rows.length === 0 ? <EmptyState /> : <div className="table-scroll"><table>
        <thead><tr><th>Tên đăng nhập</th><th>Họ và tên</th><th>Chức danh</th><th>Thao tác</th></tr></thead>
        <tbody>{rows.map((signer) => <tr key={signer.id}>
          <td><SignerCell name={signer.username} /></td>
          <td>{signer.fullName}</td>
          <td>{signer.position}</td>
          <td><button onClick={() => setEditing(signer)}>Sửa</button><button className="danger" onClick={() => confirm(`Xóa người ký “${signer.username}”?`) && remove.mutate(signer.id)}>Xóa</button></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
  </section>;
}
