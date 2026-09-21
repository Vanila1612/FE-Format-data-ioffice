import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../services/api';
import type { Summary, ImportRecord, MonthlyBucket } from '../types/api';
import { groupLabels, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

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
      <div className="panel"><h2>Phân loại</h2>{data.byGroup.map((row) => <MiniBar key={row.key} label={row.label} value={row.total} max={Math.max(data.totals.total, 1)} />)}</div>
      <div className="panel"><h2>Đơn vị nhiều văn bản</h2>{data.byUnit.length ? data.byUnit.slice(0, 8).map((row) => <MiniBar key={row.unit} label={row.unit} value={row.total} max={data.byUnit[0].total} />) : <EmptyState />}</div>
    </div>
    <div className="panel"><h2>Tỷ lệ ký số theo tháng</h2><MonthlySignChart months={data.byMonth ?? []} /></div>
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

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="bar-row"><span>{label}</span><div><i style={{ width: `${Math.max(4, value / max * 100)}%` }} /></div><b>{numberText(value)}</b></div>;
}

function MonthlySignChart({ months }: { months: MonthlyBucket[] }) {
  if (!months.length) return <EmptyState />;
  const data = months.map((m) => ({ label: m.label, total: m.total, signed: m.signed, unsigned: m.total - m.signed, signRate: m.signRate }));
  return (
    <div className="monthly-chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 4 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke="#eef3f4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#526069', fontSize: 12 }} axisLine={{ stroke: '#dfe5e8' }} tickLine={false} />
          <YAxis tick={{ fill: '#66737b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(15,107,91,0.06)' }}
            contentStyle={{ borderRadius: 8, border: '1px solid #dfe5e8', fontSize: 12 }}
            formatter={(value, name) => [numberText(Number(value)), name]}
            labelFormatter={(label) => `Tháng ${String(label)}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#17201c' }} iconType="circle" />
          <Bar dataKey="total" name="Tổng văn bản" fill="#7d8a86" radius={[6, 6, 0, 0]} />
          <Bar dataKey="signed" name="Đã ký số" fill="#0f6b5b" radius={[6, 6, 0, 0]}>
            <LabelList
              dataKey={(entry: { signRate: number }) => `${entry.signRate}%`}
              position="top"
              style={{ fill: '#0b4d43', fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
