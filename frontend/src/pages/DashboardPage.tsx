import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../services/api';
import { useAuth } from '../services/auth';
import type { Summary, ImportRecord } from '../types/api';
import { dateText, groupLabels, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { loadLocalImport, localDocumentsByGroup, localDocumentsByUnit } from '../utils/localImport';
import { ResultBoardTable } from './ImportPage';

export function DashboardPage() {
  const { user } = useAuth();
  const isLocalMode = user?.id === 'local';
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: async () => unwrap<Summary>(await api.get('/reports/summary')),
    enabled: !isLocalMode
  });
  const imports = useQuery({
    queryKey: ['imports'],
    queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')),
    enabled: !isLocalMode
  });

  if (isLocalMode) return <LocalDashboard />;
  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) return <ErrorState message={summary.error.message} retry={() => summary.refetch()} />;
  const data = summary.data!;

  return <section className="page-stack">
    <KpiGrid total={data.totals.total} signed={data.totals.signed} unsigned={data.totals.unsigned} signRate={data.totals.signRate} />
    <div className="grid-two">
      <div className="panel"><h2>Phân loại</h2>{data.byGroup.map((row) => <Bar key={row.key} label={row.label} value={row.total} max={Math.max(data.totals.total, 1)} />)}</div>
      <div className="panel"><h2>Đơn vị nhiều văn bản</h2>{data.byUnit.length ? data.byUnit.slice(0, 8).map((row) => <Bar key={row.unit} label={row.unit} value={row.total} max={data.byUnit[0].total} />) : <EmptyState />}</div>
    </div>
    <div className="panel"><h2>Import gần đây</h2>{imports.data?.length ? <table><tbody>{imports.data.slice(0, 5).map((item) => <tr key={item.id}><td>{item.originalFileName}</td><td>{item.status}</td><td>{numberText(item.successRows)} dòng</td></tr>)}</tbody></table> : <EmptyState />}</div>
  </section>;
}

function LocalDashboard() {
  const stored = loadLocalImport();
  if (!stored || stored.documents.length === 0) {
    return <section className="panel local-empty">
      <h2>Chưa có dữ liệu local</h2>
      <p>Hãy vào Import và chọn file Excel. Kết quả chuẩn hóa sẽ được hiển thị ở Dashboard mà không cần backend/database.</p>
      <Link className="button" to="/import">Import Excel</Link>
    </section>;
  }

  const byUnit = localDocumentsByUnit(stored.documents);
  const byGroup = localDocumentsByGroup(stored.documents);

  return <section className="page-stack">
    <KpiGrid total={stored.totals.total} signed={stored.totals.signed} unsigned={stored.totals.unsigned} signRate={stored.totals.signRate} />
    <div className="grid-two">
      <div className="panel">
        <h2>Phân loại</h2>
        {Object.entries(byGroup).map(([key, value]) => <Bar key={key} label={groupLabels[key as keyof typeof groupLabels]} value={value} max={Math.max(stored.totals.total, 1)} />)}
      </div>
      <div className="panel">
        <h2>Đơn vị nhiều văn bản</h2>
        {byUnit.length ? byUnit.slice(0, 8).map((row) => <Bar key={row.unit} label={row.unit} value={row.total} max={byUnit[0].total} />) : <EmptyState />}
      </div>
    </div>
    <div className="panel">
      <h2>Import local gần đây</h2>
      <table><tbody><tr><td>{stored.fileName}</td><td>LOCAL</td><td>{dateText(stored.importedAt)}</td><td>{numberText(stored.documents.length)} dòng</td></tr></tbody></table>
    </div>
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>THỐNG KÊ VĂN BẢN ĐI THEO ĐƠN VỊ</h2>
          <p>Khoảng thời gian: {stored.period.from || '-'} - {stored.period.to || '-'}</p>
        </div>
      </div>
      <ResultBoardTable rows={stored.boardRows} />
    </div>
  </section>;
}

function KpiGrid({ total, signed, unsigned, signRate }: { total: number; signed: number; unsigned: number; signRate: number }) {
  return <div className="kpi-grid">
    <Kpi label="Tổng văn bản" value={total} />
    <Kpi label="Đã ký số" value={signed} />
    <Kpi label="Chưa ký số" value={unsigned} />
    <Kpi label="Tỷ lệ ký" value={`${signRate}%`} />
  </div>;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return <div className="kpi"><span>{label}</span><strong>{typeof value === 'number' ? numberText(value) : value}</strong></div>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="bar-row"><span>{label}</span><div><i style={{ width: `${Math.max(4, value / max * 100)}%` }} /></div><b>{numberText(value)}</b></div>;
}
