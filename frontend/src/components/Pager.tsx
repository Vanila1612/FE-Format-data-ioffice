import { numberText } from '../utils/format';

export type PagerProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
};

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function pageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

export function Pager({
  page,
  pageSize,
  total,
  totalPages: explicitTotalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS
}: PagerProps) {
  const totalPages = explicitTotalPages !== undefined
    ? Math.max(1, explicitTotalPages)
    : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  if (total <= 0) return null;

  return (
    <div className="pager">
      <span>{`${numberText(total)} bản ghi · Trang ${safePage}/${totalPages}`}</span>
      {onPageSizeChange && (
        <label>
          Hiển thị
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Số dòng mỗi trang"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={() => onPageChange(safePage - 1)}
        disabled={safePage <= 1}
      >
        Trước
      </button>
      {pageNumbers(safePage, totalPages).map((value, index) =>
        value === '…' ? (
          <span key={`ellipsis-${index}`}>…</span>
        ) : (
          <button
            key={value}
            type="button"
            className={value === safePage ? 'current-page' : ''}
            onClick={() => onPageChange(value)}
          >
            {value}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onPageChange(safePage + 1)}
        disabled={safePage >= totalPages}
      >
        Sau
      </button>
    </div>
  );
}
