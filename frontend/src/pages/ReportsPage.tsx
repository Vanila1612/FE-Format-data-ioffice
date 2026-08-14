import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, downloadFile, unwrap } from '../services/api';
import type { ImportRecord, Summary } from '../types/api';
import { numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { ResultBoardTable } from './ImportPage';

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [importId, setImportId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const filters = { importId: importId || undefined, from: from || undefined, to: to || undefined };
  const imports = useQuery({ queryKey: ['imports-for-report'], queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')) });
  const report = useQuery({ queryKey: ['summary', filters], queryFn: async () => unwrap<Summary>(await api.get('/reports/summary', { params: filters })) });
  const createSnapshot = useMutation({
    mutationFn: async () => unwrap(await api.post('/snapshots', { name: snapshotName.trim() || `Thống kê ${new Date().toLocaleDateString('vi-VN')}`, importId: importId || undefined, filters })),
    onSuccess: async () => { toast.success('Đã lưu kết quả thống kê'); setSnapshotName(''); await queryClient.invalidateQueries({ queryKey: ['snapshots'] }); },
    onError: (error) => toast.error(error.message)
  });

  if (imports.isLoading || report.isLoading) return <LoadingState />;
  if (imports.isError || report.isError) return <ErrorState message={(imports.error || report.error)!.message} retry={() => { void imports.refetch(); void report.refetch(); }} />;
  const data = report.data!;
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)).map(([key, value]) => [key, String(value)])).toString();

  return <section className="page-stack">
    <div className="panel report-filter">
      <div><h2>Phạm vi thống kê</h2><p>Chọn một lần nhập hoặc thống kê toàn bộ văn bản; có thể giới hạn theo ngày ban hành.</p></div>
      <div className="toolbar"><select value={importId} onChange={(event) => setImportId(event.target.value)}><option value="">Tất cả lần nhập</option>{imports.data!.map((item) => <option key={item.id} value={item.id}>{item.originalFileName}</option>)}</select><label>Từ ngày <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Đến ngày <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="secondary" onClick={() => { setImportId(''); setFrom(''); setTo(''); }}>Tất cả dữ liệu</button><button className="secondary" onClick={() => void downloadFile(`/reports/export?${query}`).catch((error) => toast.error(error.message))}>Xuất Excel</button></div>
    </div>
    <div className="kpi-grid"><Kpi label="Tổng văn bản" value={data.totals.total} /><Kpi label="Đã ký số" value={data.totals.signed} /><Kpi label="Chưa ký số" value={data.totals.unsigned} /><Kpi label="Tỷ lệ ký" value={`${data.totals.signRate}%`} /></div>
    <div className="panel">
      <div className="panel-head"><div><h2>THỐNG KÊ VĂN BẢN ĐI THEO ĐƠN VỊ</h2><p>{from || to ? `Lọc ngày: ${from || 'đầu kỳ'} – ${to || 'hiện tại'}` : 'Toàn bộ dữ liệu theo phạm vi đã chọn'}</p></div><div className="snapshot-create"><input placeholder="Tên kết quả lưu (không bắt buộc)" value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} /><button disabled={createSnapshot.isPending || !data.totals.total} onClick={() => createSnapshot.mutate()}>{createSnapshot.isPending ? 'Đang lưu…' : 'Lưu kết quả thống kê'}</button></div></div>
      {data.boardRows.length === 0 ? <EmptyState /> : <ResultBoardTable rows={data.boardRows} />}
    </div>
  </section>;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return <div className="kpi"><span>{label}</span><strong>{typeof value === 'number' ? numberText(value) : value}</strong></div>;
}
