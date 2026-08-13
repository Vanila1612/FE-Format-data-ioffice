import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, downloadUrl, unwrap } from '../services/api';
import type { ImportRecord, Snapshot } from '../types/api';
import { dateText, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function SnapshotsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', importId: '' });
  const snapshots = useQuery({ queryKey: ['snapshots'], queryFn: async () => unwrap<Snapshot[]>(await api.get('/snapshots')) });
  const imports = useQuery({ queryKey: ['imports'], queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')) });
  const create = useMutation({ mutationFn: async () => unwrap(await api.post('/snapshots', form)), onSuccess: async () => { toast.success('Snapshot đã tạo'); setForm({ name: '', description: '', importId: '' }); await queryClient.invalidateQueries({ queryKey: ['snapshots'] }); }, onError: (error) => toast.error(error.message) });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  if (snapshots.isLoading || imports.isLoading) return <LoadingState />;
  if (snapshots.isError) return <ErrorState message={snapshots.error.message} retry={() => snapshots.refetch()} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}><input placeholder="Snapshot name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><select value={form.importId} onChange={(event) => setForm({ ...form, importId: event.target.value })}><option value="">Chọn import</option>{imports.data!.map((item) => <option key={item.id} value={item.id}>{item.originalFileName}</option>)}</select><input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button>Create snapshot</button></form>
    <div className="panel">{snapshots.data!.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>Snapshot name</th><th>Import</th><th>Created by</th><th>Created at</th><th>Total documents</th><th>Rule version</th><th>Export</th></tr></thead><tbody>{snapshots.data!.map((snapshot) => <tr key={snapshot.id}><td>{snapshot.name}</td><td>{snapshot.import.originalFileName}</td><td>{snapshot.createdBy.displayName}</td><td>{dateText(snapshot.createdAt)}</td><td>{numberText(snapshot._count?.documents || 0)}</td><td>v{snapshot.ruleVersion.version}</td><td><a href={downloadUrl(`/snapshots/${snapshot.id}/export`)}>Excel</a></td></tr>)}</tbody></table></div>}</div>
  </section>;
}
