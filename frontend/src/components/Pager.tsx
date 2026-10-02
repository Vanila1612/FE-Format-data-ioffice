type PagerProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function Pager({ page, pageSize, total, onPageChange, onPageSizeChange }: PagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (total <= 0) return null;
  return (
    <div className="pager">
      {onPageSizeChange && (
        <label>
          Hiển thị
          <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label="Số dòng mỗi trang">
            {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          dòng
        </label>
      )}
      <button type="button" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}>Trước</button>
      <span>Trang {safePage}/{totalPages}</span>
      <button type="button" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages}>Sau</button>
    </div>
  );
}
