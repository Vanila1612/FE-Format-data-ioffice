import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../services/api';
import type { Summary, ImportRecord } from '../types/api';
import { groupLabels, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: async () => unwrap<Summary>(await api.get('/reports/summary'))
  });
  const imports = useQuery({
    queryKey: ['imports'],
    queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports'))
  });

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) return <ErrorState message={summary.error.message} retry={() => summary.refetch()} />;
  const data = summary.data!;

  return <section className="page-stack">
    <KpiGrid total={data.totals.total} signed={data.totals.signed} unsigned={data.totals.unsigned} signRate={data.totals.signRate} />
    <div className="grid-two">
      <div className="panel"><h2>Phân loại</h2>{data.byGroup.map((row) => <Bar key={row.key} label={row.label} value={row.total} max={Math.max(data.totals.total, 1)} />)}</div>
      <div className="panel"><h2>Đơn vị nhiều văn bản</h2>{data.byUnit.length ? data.byUnit.slice(0, 8).map((row) => <Bar key={row.unit} label={row.unit} value={row.total} max={data.byUnit[0].total} />) : <EmptyState />}</div>
    </div>
    <div className="panel"><h2>Lần nhập gần đây</h2>{imports.data?.length ? <table><tbody>{imports.data.slice(0, 5).map((item) => <tr key={item.id}><td>{item.originalFileName}</td><td>{item.status}</td><td>{numberText(item.successRows)} dòng</td></tr>)}</tbody></table> : <EmptyState />}</div>
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
