import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, downloadUrl, unwrap } from '../services/api';
import { useAuth } from '../services/auth';
import type { Summary } from '../types/api';
import { numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { loadLocalImport } from '../utils/localImport';
import { ResultBoardTable } from './ImportPage';

export function ReportsPage() {
  const { user } = useAuth();
  const isLocalMode = user?.id === 'local';
  const report = useQuery({
    queryKey: ['summary'],
    queryFn: async () => unwrap<Summary>(await api.get('/reports/summary')),
    enabled: !isLocalMode
  });

  if (isLocalMode) return <LocalReport />;
  if (report.isLoading) return <LoadingState />;
  if (report.isError) return <ErrorState message={report.error.message} retry={() => report.refetch()} />;
  const data = report.data!;

  return <section className="page-stack">
    <div className="toolbar"><a className="button" href={downloadUrl('/reports/export')}>Export Excel</a></div>
    <div className="panel">
      <h2>Báo cáo theo đơn vị</h2>
      {data.byUnit.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>Đơn vị</th><th>Tổng số</th><th>Đã ký số</th><th>Chưa ký số</th><th>Tỷ lệ ký</th></tr></thead><tbody>{data.byUnit.map((row) => <tr key={row.unit}><td>{row.unit}</td><td>{numberText(row.total)}</td><td>{numberText(row.signed)}</td><td>{numberText(row.unsigned)}</td><td>{row.signRate}%</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}

function LocalReport() {
  const stored = loadLocalImport();
  if (!stored || stored.boardRows.length === 0) {
    return <section className="panel local-empty">
      <h2>Chưa có dữ liệu local</h2>
      <p>Hãy import file `Bang_VanBanDi_iOffice_TSC.xlsx` trước để xem bảng kết quả theo mẫu 0308.</p>
      <Link className="button" to="/import">Import Excel</Link>
    </section>;
  }

  return <section className="panel">
    <div className="panel-head">
      <div>
        <h2>THỐNG KÊ VĂN BẢN ĐI THEO ĐƠN VỊ</h2>
        <p>Khoảng thời gian: {stored.period.from || '-'} - {stored.period.to || '-'}</p>
      </div>
    </div>
    <ResultBoardTable rows={stored.boardRows} />
  </section>;
}
