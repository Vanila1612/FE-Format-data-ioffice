import { useQuery } from '@tanstack/react-query';
import { api, downloadUrl, unwrap } from '../services/api';
import type { ImportRecord } from '../types/api';
import { dateText, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function ImportsPage() {
  const imports = useQuery({ queryKey: ['imports'], queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')) });
  if (imports.isLoading) return <LoadingState />;
  if (imports.isError) return <ErrorState message={imports.error.message} retry={() => imports.refetch()} />;
  return <section className="panel">
    {imports.data!.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>File name</th><th>Uploaded by</th><th>Upload time</th><th>Status</th><th>Total</th><th>Success</th><th>Failed</th><th>Export</th></tr></thead><tbody>{imports.data!.map((item) => <tr key={item.id}><td>{item.originalFileName}</td><td>{item.uploadedBy?.displayName}</td><td>{dateText(item.createdAt)}</td><td><span className="pill">{item.status}</span></td><td>{numberText(item.totalRows)}</td><td>{numberText(item.successRows)}</td><td>{numberText(item.failedRows)}</td><td><a href={downloadUrl(`/imports/${item.id}/export`)}>Excel</a></td></tr>)}</tbody></table></div>}
  </section>;
}
