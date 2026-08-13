import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, downloadUrl, unwrap } from '../services/api';
import type { DocumentRecord, Paged } from '../types/api';
import { dateText, groupLabels, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const documents = useQuery({
    queryKey: ['documents', search, page],
    queryFn: async () => unwrap<Paged<DocumentRecord>>(await api.get('/documents', { params: { search, page, pageSize: 20 } }))
  });

  if (documents.isLoading) return <LoadingState />;
  if (documents.isError) return <ErrorState message={documents.error.message} retry={() => documents.refetch()} />;
  const data = documents.data!;

  return <section className="page-stack">
    <div className="toolbar"><input placeholder="Tìm trích yếu, số ký hiệu, đơn vị" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><a className="button secondary" href={downloadUrl('/reports/export')}>Export</a></div>
    <div className="panel">
      {data.items.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>STT</th><th>Trích yếu</th><th>Số ký hiệu</th><th>Văn bản ký số</th><th>Ngày ban hành</th><th>Đơn vị ban hành</th><th>Đơn vị chuẩn hóa</th><th>Nhóm</th></tr></thead><tbody>{data.items.map((document, index) => <tr key={document.id}><td>{(data.page - 1) * data.pageSize + index + 1}</td><td>{document.summary}</td><td>{document.referenceNumber}</td><td>{document.signedDocument}</td><td>{dateText(document.issueDate)}</td><td>{document.issuingUnit}</td><td>{document.normalizedUnit}</td><td><span className="pill">{groupLabels[document.documentGroup]}</span></td></tr>)}</tbody></table></div>}
      <div className="pager"><span>{numberText(data.total)} bản ghi</span><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Sau</button></div>
    </div>
  </section>;
}
