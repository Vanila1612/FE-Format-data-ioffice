import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api, downloadFile, unwrap } from '../services/api';
import type { DocumentRecord, ImportRecord, Paged } from '../types/api';
import { dateText, groupLabels, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { useAuth } from '../services/auth';
import { toast } from 'sonner';

export function DocumentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const importId = searchParams.get('importId') || '';
  const imports = useQuery({ queryKey: ['imports-for-filter'], queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')) });
  const filters = { search, page, pageSize, importId: importId || undefined, from: from || undefined, to: to || undefined };
  const documents = useQuery({
    queryKey: ['documents', filters],
    queryFn: async () => unwrap<Paged<DocumentRecord>>(await api.get('/documents', { params: filters }))
  });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/documents/${id}`)), onSuccess: async () => { toast.success('Đã xóa văn bản'); await documents.refetch(); }, onError: (error) => toast.error(error.message) });

  if (documents.isLoading) return <LoadingState />;
  if (documents.isError) return <ErrorState message={documents.error.message} retry={() => documents.refetch()} />;
  const data = documents.data!;

  return <section className="page-stack">
    <div className="toolbar">
      <input placeholder="Tìm trích yếu, số ký hiệu, đơn vị" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <select value={importId} onChange={(event) => { const next = new URLSearchParams(searchParams); event.target.value ? next.set('importId', event.target.value) : next.delete('importId'); setSearchParams(next); setPage(1); }}>
        <option value="">Tất cả lần import</option>
        {imports.data?.map((item) => <option key={item.id} value={item.id}>{item.originalFileName} — {dateText(item.createdAt)}</option>)}
      </select>
      <label>Từ ngày <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
      <label>Đến ngày <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
      <button className="secondary" onClick={() => { setSearchParams({}); setSearch(''); setFrom(''); setTo(''); setPage(1); }}>Xóa lọc</button>
      <button className="secondary" onClick={() => void downloadFile(`/reports/export?${new URLSearchParams(Object.entries(filters).filter(([key, value]) => value !== undefined && !['page', 'pageSize'].includes(key)).map(([key, value]) => [key, String(value)])).toString()}`).catch((error) => toast.error(error.message))}>Xuất Excel</button>
    </div>
    <div className="panel">
      {data.items.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>STT</th><th>Trích yếu</th><th>Số ký hiệu</th><th>Văn bản ký số</th><th>Ngày ban hành</th><th>Đơn vị ban hành</th><th>Đơn vị chuẩn hóa</th><th>Nhóm</th>{user?.role === 'ADMIN' && <th>Xóa</th>}</tr></thead><tbody>{data.items.map((document, index) => <tr key={document.id}><td>{(data.page - 1) * data.pageSize + index + 1}</td><td>{document.summary}</td><td>{document.referenceNumber}</td><td>{document.signedDocument}</td><td>{dateText(document.issueDate)}</td><td>{document.issuingUnit}</td><td>{document.normalizedUnit}</td><td><span className="pill">{groupLabels[document.documentGroup]}</span></td>{user?.role === 'ADMIN' && <td><button className="danger" onClick={() => confirm(`Xóa văn bản “${document.referenceNumber}”?`) && remove.mutate(document.id)}>Xóa</button></td>}</tr>)}</tbody></table></div>}
      <div className="pager"><span>{numberText(data.total)} bản ghi · Trang {data.page}/{data.totalPages || 1}</span><label>Hiển thị <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>{pageNumbers(data.page, data.totalPages).map((value, index) => value === '…' ? <span key={`ellipsis-${index}`}>…</span> : <button key={value} className={value === page ? 'current-page' : ''} onClick={() => setPage(value)}>{value}</button>)}<button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Sau</button></div>
    </div>
  </section>;
}

function pageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}
