import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, downloadFile, unwrap } from '../services/api';
import type { ImportRecord, Summary } from '../types/api';
import { numberText } from '../utils/format';
import { exportResultBoardExcel } from '../utils/resultBoardExport';
import { filterResultBoardRows, totalsFromBoardRows, type UnitScope } from '../utils/unitScope';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { ResultBoardTable } from './ImportPage';
import { SignerBoardTable } from '../components/SignerBoardTable';

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [importId, setImportId] = useState('');
  // UI state (what the user has typed/picked)
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  // Applied state (what's actually used to query)
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [unitScope, setUnitScope] = useState<UnitScope>('ALL');

  const filters = { importId: importId || undefined, from: appliedFrom || undefined, to: appliedTo || undefined };
  const imports = useQuery({ queryKey: ['imports-for-report'], queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')) });
  const report = useQuery({ queryKey: ['summary', filters], queryFn: async () => unwrap<Summary>(await api.get('/reports/summary', { params: filters })) });
  const createSnapshot = useMutation({
    mutationFn: async () => unwrap(await api.post('/snapshots', { name: snapshotName.trim() || `Thống kê ${new Date().toLocaleDateString('vi-VN')}`, importId: importId || undefined, filters })),
    onSuccess: async () => { toast.success('Đã lưu kết quả thống kê'); setSnapshotName(''); await queryClient.invalidateQueries({ queryKey: ['snapshots'] }); },
    onError: (error) => toast.error(error.message)
  });

  function applyDateFilter() {
    if (fromInput && toInput && fromInput > toInput) {
      toast.error('Ngày bắt đầu phải trước ngày kết thúc');
      return;
    }
    setAppliedFrom(fromInput);
    setAppliedTo(toInput);
  }

  function clearAllFilters() {
    setImportId('');
    setFromInput('');
    setToInput('');
    setAppliedFrom('');
    setAppliedTo('');
  }

  function exportVisibleBoard() {
    if (!visibleBoardRows.length) {
      toast.error('Không có dữ liệu để xuất Excel');
      return;
    }
    exportResultBoardExcel(visibleBoardRows, visibleTotals, `ioffice-thong-ke-don-vi-${unitScope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (imports.isLoading || report.isLoading) return <LoadingState />;
  if (imports.isError || report.isError) return <ErrorState message={(imports.error || report.error)!.message} retry={() => { void imports.refetch(); void report.refetch(); }} />;
  const data = report.data!;
  const visibleBoardRows = filterResultBoardRows(data.boardRows, boardSearch, unitScope);
  const visibleTotals = totalsFromBoardRows(visibleBoardRows);
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)).map(([key, value]) => [key, String(value)])).toString();
  const hasPendingDateChange = fromInput !== appliedFrom || toInput !== appliedTo;

  return <section className="page-stack">
    <div className="panel report-filter">
      <div><h2>Phạm vi thống kê</h2><p>Chọn một lần nhập hoặc thống kê toàn bộ văn bản; có thể giới hạn theo ngày ban hành.</p></div>
      <div className="toolbar">
        <select value={importId} onChange={(event) => setImportId(event.target.value)}>
          <option value="">Tất cả lần nhập</option>
          {imports.data!.map((item) => <option key={item.id} value={item.id}>{item.originalFileName}</option>)}
        </select>
        <label>Từ ngày <input type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyDateFilter(); }} /></label>
        <label>Đến ngày <input type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyDateFilter(); }} /></label>
        <button onClick={applyDateFilter} disabled={!hasPendingDateChange}>Áp dụng</button>
        <button className="secondary" onClick={clearAllFilters}>Tất cả dữ liệu</button>
        <button className="secondary" onClick={() => void downloadFile(`/reports/export?${query}`).catch((error) => toast.error(error.message))}>Xuất Excel</button>
      </div>
    </div>
    <div className="kpi-grid"><Kpi label="Tổng văn bản" value={visibleTotals.total} /><Kpi label="Đã ký số" value={visibleTotals.signed} /><Kpi label="Chưa ký số" value={visibleTotals.unsigned} /><Kpi label="Tỷ lệ ký" value={`${visibleTotals.signRate}%`} /></div>
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>THỐNG KÊ VĂN BẢN ĐI THEO ĐƠN VỊ</h2>
          <p>{appliedFrom || appliedTo ? `Lọc ngày: ${appliedFrom || 'đầu kỳ'} – ${appliedTo || 'hiện tại'}` : 'Toàn bộ dữ liệu theo phạm vi đã chọn'}</p>
        </div>
        <div className="snapshot-create">
          <input placeholder="Tên kết quả lưu (không bắt buộc)" value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} />
          <button className="secondary" disabled={!visibleBoardRows.length} onClick={exportVisibleBoard}>Xuất bảng Excel</button>
          <button disabled={createSnapshot.isPending || !data.totals.total} onClick={() => createSnapshot.mutate()}>{createSnapshot.isPending ? 'Đang lưu…' : 'Lưu kết quả thống kê'}</button>
        </div>
      </div>
      {data.boardRows.length === 0 ? <EmptyState /> : <ResultBoardTable rows={data.boardRows} search={boardSearch} onSearchChange={setBoardSearch} scope={unitScope} onScopeChange={setUnitScope} />}
    </div>
    <div className="panel">
      <div className="panel-head"><div><h2>THỐNG KÊ VĂN BẢN ĐI THEO NGƯỜI KÝ CHÍNH</h2><p>{data.signerBoardRows?.length || 0} người ký chính trong phạm vi đã chọn.</p></div></div>
      <SignerBoardTable rows={data.signerBoardRows || []} />
    </div>
  </section>;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return <div className="kpi"><span>{label}</span><strong>{typeof value === 'number' ? numberText(value) : value}</strong></div>;
}
