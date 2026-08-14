import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { ClassificationRule, DocumentGroup } from '../types/api';
import { groupLabels } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function RulesPage() {
  const queryClient = useQueryClient();
  const emptyForm = { keyword: '', documentGroup: 'REPORT_PROPOSAL' as DocumentGroup };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ClassificationRule | null>(null);
  const rules = useQuery({ queryKey: ['rules'], queryFn: async () => unwrap<ClassificationRule[]>(await api.get('/rules')) });
  const create = useMutation({ mutationFn: async () => unwrap(await api.post('/rules', form)), onSuccess: async () => { toast.success('Đã tạo quy tắc'); setForm(emptyForm); await queryClient.invalidateQueries({ queryKey: ['rules'] }); }, onError: (error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: async (rule: ClassificationRule) => unwrap(await api.put(`/rules/${rule.id}`, { keyword: rule.keyword, documentGroup: rule.documentGroup })), onSuccess: async () => { toast.success('Đã cập nhật quy tắc'); setEditing(null); await queryClient.invalidateQueries({ queryKey: ['rules'] }); }, onError: (error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/rules/${id}`)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }) });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (rules.isLoading) return <LoadingState />;
  if (rules.isError) return <ErrorState message={rules.error.message} retry={() => rules.refetch()} />;

  return <section className="page-stack">
    <div className="panel">
      <form className="form-grid" onSubmit={submit}><input required placeholder="Từ khóa (BC, TTr, CV...)" value={form.keyword} onChange={(event) => setForm({ ...form, keyword: event.target.value })} /><select value={form.documentGroup} onChange={(event) => setForm({ ...form, documentGroup: event.target.value as DocumentGroup })}>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button disabled={create.isPending}>Tạo quy tắc</button></form>
    </div>
    {editing && <div className="panel">
      <p className="form-note">Đang sửa quy tắc “{editing.keyword}”.</p>
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); update.mutate(editing); }}><input required placeholder="Từ khóa" value={editing.keyword} onChange={(event) => setEditing({ ...editing, keyword: event.target.value })} /><select value={editing.documentGroup} onChange={(event) => setEditing({ ...editing, documentGroup: event.target.value as DocumentGroup })}>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div className="button-row"><button disabled={update.isPending}>Lưu thay đổi</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Hủy</button></div></form>
    </div>}
    <div className="panel">{rules.data!.length === 0 ? <EmptyState /> : <table><thead><tr><th>Từ khóa</th><th>Nhóm</th><th>Thao tác</th></tr></thead><tbody>{rules.data!.map((rule) => <tr key={rule.id}><td>{rule.keyword}</td><td>{groupLabels[rule.documentGroup]}</td><td><button onClick={() => setEditing(rule)}>Sửa</button><button className="danger" onClick={() => confirm('Xóa quy tắc này?') && remove.mutate(rule.id)}>Xóa</button></td></tr>)}</tbody></table>}</div>
  </section>;
}
