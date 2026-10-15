import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../services/api';
import type { UnitMapping } from '../types/api';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { Pager } from '../components/Pager';

type ReprocessAllResult = {
  processed: number;
  results: Array<{ id: string; status: 'ok' | 'error'; count: number; error?: string }>;
};

export function UnitMappingsPage() {
  const queryClient = useQueryClient();
  const emptyForm = { sourceName: '', normalizedName: '' };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<UnitMapping | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const mappings = useQuery({ queryKey: ['unit-mappings'], queryFn: async () => unwrap<UnitMapping[]>(await api.get('/unit-mappings')) });
  const all = mappings.data || [];
  const sortedMappings = useMemo(() => {
    if (!mappings.data) return [];
    return [...mappings.data].sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }, [mappings.data]);
  const create = useMutation({
    mutationFn: async () => unwrap(await api.post('/unit-mappings', {
      sourceName: form.sourceName.trim(),
      normalizedName: form.normalizedName.trim()
    })),
    onSuccess: async () => {
      toast.success('Đã tạo quy đổi đơn vị');
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['unit-mappings'] });
    },
    onError: (error) => toast.error(error.message)
  });
  const update = useMutation({
    mutationFn: async (mapping: UnitMapping) =>
      unwrap(await api.put(`/unit-mappings/${mapping.id}`, {
        sourceName: mapping.sourceName.trim(),
        normalizedName: mapping.normalizedName.trim()
      })),
    onSuccess: async () => {
      toast.success('Đã cập nhật quy đổi đơn vị');
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['unit-mappings'] });
    },
    onError: (error) => toast.error(error.message)
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await api.delete(`/unit-mappings/${id}`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit-mappings'] }),
    onError: (error) => toast.error(error.message)
  });
  const reprocessAll = useMutation({
    mutationFn: async () => unwrap<ReprocessAllResult>(await api.post('/imports/reprocess-all')),
    onSuccess: async (data) => {
      const errors = data.results.filter((item) => item.status === 'error').length;
      if (errors) toast.error(`Đã áp dụng lại ${data.processed - errors}/${data.processed} import, ${errors} import bị lỗi`);
      else toast.success(`Đã áp dụng lại cho ${data.processed} import`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['imports'] }),
        queryClient.invalidateQueries({ queryKey: ['imports-for-report'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const sourceName = form.sourceName.trim();
    if (!sourceName) return;
    const exists = all.some((m) => m.sourceName.trim().toLowerCase() === sourceName.toLowerCase());
    if (exists) {
      toast.error('Tên đơn vị nguồn đã tồn tại');
      return;
    }
    create.mutate();
  }

  function handleUpdate(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const sourceName = editing.sourceName.trim();
    if (!sourceName) return;
    const exists = all.some(
      (m) => m.id !== editing.id && m.sourceName.trim().toLowerCase() === sourceName.toLowerCase()
    );
    if (exists) {
      toast.error('Tên đơn vị nguồn đã tồn tại');
      return;
    }
    update.mutate({ ...editing, sourceName, normalizedName: editing.normalizedName.trim() });
  }

  if (mappings.isLoading) return <LoadingState />;
  if (mappings.isError) return <ErrorState message={mappings.error.message} retry={() => mappings.refetch()} />;

  const totalPages = Math.max(1, Math.ceil(sortedMappings.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedMappings = sortedMappings.slice(pageStart, pageStart + pageSize);

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}>
      <input required placeholder="Tên đơn vị nguồn" value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} />
      <input required placeholder="Tên đơn vị chuẩn hóa" value={form.normalizedName} onChange={(event) => setForm({ ...form, normalizedName: event.target.value })} />
      <button disabled={create.isPending}>Tạo quy đổi</button>
    </form>
    {editing && <div className="panel">
      <p className="form-note">Đang sửa quy đổi “{editing.sourceName}”.</p>
      <form className="form-grid" onSubmit={handleUpdate}>
        <input required placeholder="Tên đơn vị nguồn" value={editing.sourceName} onChange={(event) => setEditing({ ...editing, sourceName: event.target.value })} />
        <input required placeholder="Tên đơn vị chuẩn hóa" value={editing.normalizedName} onChange={(event) => setEditing({ ...editing, normalizedName: event.target.value })} />
        <div className="button-row"><button disabled={update.isPending}>Lưu thay đổi</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Hủy</button></div>
      </form>
    </div>}
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Bảng chuẩn hóa đơn vị</h2>
          <p>Áp dụng lại sau khi sửa để các lần nhập cũ được thống kê theo tên chuẩn mới.</p>
        </div>
        <button disabled={reprocessAll.isPending} onClick={() => confirm('Áp dụng lại chuẩn hóa đơn vị cho tất cả import?') && reprocessAll.mutate()}>
          {reprocessAll.isPending ? 'Đang áp dụng…' : 'Áp dụng lại cho các import'}
        </button>
      </div>
      {sortedMappings.length === 0 ? <EmptyState /> : <>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Đơn vị nguồn</th><th>Đơn vị chuẩn hóa</th><th>Thao tác</th></tr></thead>
            <tbody>{pagedMappings.map((mapping) => <tr key={mapping.id}><td>{mapping.sourceName}</td><td>{mapping.normalizedName}</td><td><button onClick={() => setEditing(mapping)}>Sửa</button><button className="danger" onClick={() => confirm('Xóa quy đổi đơn vị này?') && remove.mutate(mapping.id)}>Xóa</button></td></tr>)}</tbody>
          </table>
        </div>
        <Pager
          page={safePage}
          pageSize={pageSize}
          total={sortedMappings.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </>}
    </div>
  </section>;
}
