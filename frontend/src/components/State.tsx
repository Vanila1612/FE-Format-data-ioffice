export function LoadingState() {
  return <div className="state"><div className="spinner" /><span>Đang tải dữ liệu</span></div>;
}

export function EmptyState({ title = 'Không có dữ liệu' }: { title?: string }) {
  return <div className="state empty-state"><strong>{title}</strong></div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="state error-state"><strong>Không thể tải dữ liệu</strong><span>{message}</span>{retry && <button onClick={retry}>Thử lại</button>}</div>;
}
