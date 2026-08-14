import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { UnitMapping } from '../types/api';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function UnitMappingsPage() {
  const queryClient = useQueryClient();
  const emptyForm = { sourceName: '', normalizedName: '' };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<UnitMapping | null>(null);
  const mappings = useQuery({ queryKey: ['unit-mappings'], queryFn: async () => unwrap<UnitMapping[]>(await api.get('/unit-mappings')) });
  const create = useMutation({ mutationFn: async () => unwrap(await api.post('/unit-mappings', form)), onSuccess: async () => { toast.success('Đã tạo quy đổi đơn vị'); setForm(emptyForm); await queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }); }, onError: (error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: async (mapping: UnitMapping) => unwrap(await api.put(`/unit-mappings/${mapping.id}`, { sourceName: mapping.sourceName, normalizedName: mapping.normalizedName })), onSuccess: async () => { toast.success('Đã cập nhật quy đổi đơn vị'); setEditing(null); await queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }); }, onError: (error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/unit-mappings/${id}`)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }) });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (mappings.isLoading) return <LoadingState />;
  if (mappings.isError) return <ErrorState message={mappings.error.message} retry={() => mappings.refetch()} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}><input required placeholder="Tên đơn vị nguồn" value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} /><input required placeholder="Tên đơn vị chuẩn hóa" value={form.normalizedName} onChange={(event) => setForm({ ...form, normalizedName: event.target.value })} /><button disabled={create.isPending}>Tạo quy đổi</button></form>
    {editing && <div className="panel"><p className="form-note">Đang sửa quy đổi “{editing.sourceName}”.</p><form className="form-grid" onSubmit={(event) => { event.preventDefault(); update.mutate(editing); }}><input required placeholder="Tên đơn vị nguồn" value={editing.sourceName} onChange={(event) => setEditing({ ...editing, sourceName: event.target.value })} /><input required placeholder="Tên đơn vị chuẩn hóa" value={editing.normalizedName} onChange={(event) => setEditing({ ...editing, normalizedName: event.target.value })} /><div className="button-row"><button disabled={update.isPending}>Lưu thay đổi</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Hủy</button></div></form></div>}
    <div className="panel">{mappings.data!.length === 0 ? <EmptyState /> : <table><thead><tr><th>Đơn vị nguồn</th><th>Đơn vị chuẩn hóa</th><th>Thao tác</th></tr></thead><tbody>{mappings.data!.map((mapping) => <tr key={mapping.id}><td>{mapping.sourceName}</td><td>{mapping.normalizedName}</td><td><button onClick={() => setEditing(mapping)}>Sửa</button><button className="danger" onClick={() => confirm('Xóa quy đổi đơn vị này?') && remove.mutate(mapping.id)}>Xóa</button></td></tr>)}</tbody></table>}</div>
  </section>;
}
