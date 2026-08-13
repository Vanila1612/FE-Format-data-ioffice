import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { ClassificationRule, DocumentGroup } from '../types/api';
import { groupLabels } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function RulesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', keyword: '', documentGroup: 'REPORT_PROPOSAL' as DocumentGroup, priority: 50 });
  const rules = useQuery({ queryKey: ['rules'], queryFn: async () => unwrap<ClassificationRule[]>(await api.get('/rules')) });
  const create = useMutation({ mutationFn: async () => unwrap(await api.post('/rules', { ...form, enabled: true })), onSuccess: async () => { toast.success('Đã tạo rule'); setForm({ ...form, name: '', keyword: '' }); await queryClient.invalidateQueries({ queryKey: ['rules'] }); }, onError: (error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: async (rule: ClassificationRule) => unwrap(await api.put(`/rules/${rule.id}`, rule)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/rules/${id}`)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }) });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (rules.isLoading) return <LoadingState />;
  if (rules.isError) return <ErrorState message={rules.error.message} retry={() => rules.refetch()} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}><input placeholder="Tên rule" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input placeholder="Keyword" value={form.keyword} onChange={(event) => setForm({ ...form, keyword: event.target.value })} /><select value={form.documentGroup} onChange={(event) => setForm({ ...form, documentGroup: event.target.value as DocumentGroup })}>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /><button>Create</button></form>
    <div className="panel">{rules.data!.length === 0 ? <EmptyState /> : <table><thead><tr><th>Keyword</th><th>Group</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rules.data!.map((rule) => <tr key={rule.id}><td>{rule.keyword}</td><td>{groupLabels[rule.documentGroup]}</td><td>{rule.priority}</td><td>{rule.enabled ? 'Enabled' : 'Disabled'}</td><td><button onClick={() => update.mutate({ ...rule, enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button><button className="danger" onClick={() => confirm('Delete rule?') && remove.mutate(rule.id)}>Delete</button></td></tr>)}</tbody></table>}</div>
  </section>;
}
