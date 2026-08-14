import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../services/auth';
import { api, downloadFile, unwrap } from '../services/api';
import type { ImportRecord } from '../types/api';
import { dateText, numberText } from '../utils/format';
import { EmptyState, ErrorState, LoadingState } from '../components/State';

export function ImportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const imports = useQuery({ queryKey: ['imports'], queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')) });
  const reprocess = useMutation({ mutationFn: async (id: string) => unwrap<ImportRecord>(await api.post(`/imports/${id}/reprocess`)), onSuccess: async (result) => { toast.success(`Đã khôi phục ${numberText(result._count?.documents || result.successRows)} bản ghi từ file gốc`); await queryClient.invalidateQueries({ queryKey: ['imports'] }); await queryClient.invalidateQueries({ queryKey: ['documents'] }); }, onError: (error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: async (id: string) => unwrap<{ deletedSnapshots: number }>(await api.delete(`/imports/${id}`)), onSuccess: async (result) => { toast.success(`Đã xóa lần nhập${result.deletedSnapshots ? ` và ${result.deletedSnapshots} kết quả đã lưu liên quan` : ''}`); await queryClient.invalidateQueries({ queryKey: ['imports'] }); await queryClient.invalidateQueries({ queryKey: ['documents'] }); await queryClient.invalidateQueries({ queryKey: ['summary'] }); await queryClient.invalidateQueries({ queryKey: ['snapshots'] }); }, onError: (error) => toast.error(error.message) });
  if (imports.isLoading) return <LoadingState />;
  if (imports.isError) return <ErrorState message={imports.error.message} retry={() => imports.refetch()} />;
  return <section className="panel">
    {imports.data!.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>Tên file</th><th>Người nhập</th><th>Thời gian</th><th>Trạng thái</th><th>Tổng</th><th>Thành công</th><th>Lỗi</th><th>Dữ liệu</th><th>Xuất file</th>{user?.role === 'ADMIN' && <><th>Khôi phục</th><th>Xóa</th></>}</tr></thead><tbody>{imports.data!.map((item) => <tr key={item.id}><td>{item.originalFileName}</td><td>{item.uploadedBy?.displayName}</td><td>{dateText(item.createdAt)}</td><td><span className="pill">{item.status}</span></td><td>{numberText(item.totalRows)}</td><td>{numberText(item.successRows)}</td><td>{numberText(item.failedRows)}</td><td><Link to={`/documents?importId=${item.id}`}>Xem dữ liệu</Link></td><td><button className="secondary" onClick={() => void downloadFile(`/imports/${item.id}/export`).catch((error) => toast.error(error.message))}>Excel</button></td>{user?.role === 'ADMIN' && <><td><button className="secondary" disabled={reprocess.isPending} onClick={() => reprocess.mutate(item.id)}>Đọc lại file gốc</button></td><td><button className="danger" disabled={remove.isPending} onClick={() => confirm(`Xóa toàn bộ dữ liệu của file “${item.originalFileName}”? Thao tác này không thể hoàn tác.`) && remove.mutate(item.id)}>Xóa</button></td></>}</tr>)}</tbody></table></div>}
  </section>;
}
