import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { UnitMapping } from '../types/api';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function UnitMappingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ sourceName: '', normalizedName: '' });
  const mappings = useQuery({ queryKey: ['unit-mappings'], queryFn: async () => unwrap<UnitMapping[]>(await api.get('/unit-mappings')) });
  const create = useMutation({ mutationFn: async () => unwrap(await api.post('/unit-mappings', { ...form, enabled: true })), onSuccess: async () => { toast.success('Đã tạo mapping'); setForm({ sourceName: '', normalizedName: '' }); await queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }); }, onError: (error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: async (mapping: UnitMapping) => unwrap(await api.put(`/unit-mappings/${mapping.id}`, mapping)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/unit-mappings/${id}`)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }) });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (mappings.isLoading) return <LoadingState />;
  if (mappings.isError) return <ErrorState message={mappings.error.message} retry={() => mappings.refetch()} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}><input placeholder="Source name" value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} /><input placeholder="Normalized name" value={form.normalizedName} onChange={(event) => setForm({ ...form, normalizedName: event.target.value })} /><button>Create</button></form>
    <div className="panel">{mappings.data!.length === 0 ? <EmptyState /> : <table><thead><tr><th>Source name</th><th>Normalized name</th><th>Status</th><th>Actions</th></tr></thead><tbody>{mappings.data!.map((mapping) => <tr key={mapping.id}><td>{mapping.sourceName}</td><td>{mapping.normalizedName}</td><td>{mapping.enabled ? 'Enabled' : 'Disabled'}</td><td><button onClick={() => update.mutate({ ...mapping, enabled: !mapping.enabled })}>{mapping.enabled ? 'Disable' : 'Enable'}</button><button className="danger" onClick={() => confirm('Delete mapping?') && remove.mutate(mapping.id)}>Delete</button></td></tr>)}</tbody></table>}</div>
  </section>;
}
