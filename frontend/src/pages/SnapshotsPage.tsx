import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, downloadFile, unwrap } from '../services/api';
import type { Snapshot, Summary } from '../types/api';
import { dateText, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { ResultBoardTable } from './ImportPage';
import { useAuth } from '../services/auth';
import { toast } from 'sonner';

export function SnapshotsPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState('');
  const snapshots = useQuery({ queryKey: ['snapshots'], queryFn: async () => unwrap<Snapshot[]>(await api.get('/snapshots')) });
  const report = useQuery({ queryKey: ['snapshot-report', selectedId], queryFn: async () => unwrap<Summary>(await api.get(`/snapshots/${selectedId}/report`)), enabled: Boolean(selectedId) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap(await api.delete(`/snapshots/${id}`)), onSuccess: async () => { toast.success('Đã xóa kết quả đã lưu'); setSelectedId(''); await snapshots.refetch(); }, onError: (error) => toast.error(error.message) });
  if (snapshots.isLoading) return <LoadingState />;
  if (snapshots.isError) return <ErrorState message={snapshots.error.message} retry={() => snapshots.refetch()} />;
  const selectedSnapshot = snapshots.data!.find((snapshot) => snapshot.id === selectedId);
  return <section className="page-stack">
    <div className="panel"><div className="panel-head"><div><h2>Kết quả thống kê đã lưu</h2><p>Mỗi kết quả lưu cả bảng thống kê và bản sao văn bản theo đúng bộ lọc tại thời điểm lưu.</p></div></div>{snapshots.data!.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>Tên kết quả</th><th>Nguồn dữ liệu</th><th>Khoảng thống kê</th><th>Người tạo</th><th>Ngày tạo</th><th>Số văn bản</th><th>Phiên bản quy tắc</th><th>Kết quả</th><th>Xuất file</th><th>Xóa</th></tr></thead><tbody>{snapshots.data!.map((snapshot) => <tr key={snapshot.id}><td>{snapshot.name}</td><td>{snapshot.import?.originalFileName || 'Nhiều lần import'}</td><td>{reportPeriod(snapshot)}</td><td>{snapshot.createdBy.displayName}</td><td>{dateText(snapshot.createdAt)}</td><td>{numberText(snapshot._count?.documents || 0)}</td><td>v{snapshot.ruleVersion.version}</td><td><button className="secondary" onClick={() => setSelectedId(snapshot.id)}>Xem thống kê</button></td><td><button className="secondary" onClick={() => void downloadFile(`/snapshots/${snapshot.id}/export`).catch((error) => toast.error(error.message))}>Excel</button></td><td>{(user?.role === 'ADMIN' || user?.id === snapshot.createdBy.id) && <button className="danger" disabled={remove.isPending} onClick={() => confirm(`Xóa kết quả “${snapshot.name}”?`) && remove.mutate(snapshot.id)}>Xóa</button>}</td></tr>)}</tbody></table></div>}</div>
    {selectedId && <div className="panel"><div className="panel-head"><div><h2>Kết quả đã chốt</h2><p>{reportPeriod(selectedSnapshot)} · Dữ liệu đã lưu, không bị thay đổi khi văn bản hoặc quy tắc hiện tại thay đổi.</p></div></div>{report.isLoading ? <LoadingState /> : report.isError ? <ErrorState message={report.error.message} retry={() => report.refetch()} /> : <><div className="kpi-grid"><Kpi label="Tổng văn bản" value={report.data!.totals.total} /><Kpi label="Đã ký số" value={report.data!.totals.signed} /><Kpi label="Chưa ký số" value={report.data!.totals.unsigned} /><Kpi label="Tỷ lệ ký" value={`${report.data!.totals.signRate}%`} /></div><ResultBoardTable rows={report.data!.boardRows} /></>}</div>}
  </section>;
}

function Kpi({ label, value }: { label: string; value: number | string }) { return <div className="kpi"><span>{label}</span><strong>{typeof value === 'number' ? numberText(value) : value}</strong></div>; }

function reportPeriod(snapshot?: Snapshot) {
  const from = snapshot?.filtersJson?.from;
  const to = snapshot?.filtersJson?.to;
  if (from && to) return `Thống kê từ ${dateText(from)} đến ${dateText(to)}`;
  if (from) return `Thống kê từ ${dateText(from)}`;
  if (to) return `Thống kê đến ${dateText(to)}`;
  return 'Thống kê toàn bộ thời gian';
}
