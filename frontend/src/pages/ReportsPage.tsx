import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, downloadFile, unwrap } from '../services/api';
import type { ImportRecord, Summary } from '../types/api';
import { getMonthDateRange, numberText } from '../utils/format';
import { exportResultBoardExcel } from '../utils/resultBoardExport';
import { filterResultBoardRows, isCentralOfficeUnit, totalsFromBoardRows, type UnitScope } from '../utils/unitScope';
import { EmptyState, ErrorState, LoadingState } from '../components/State';
import { ResultBoardTable } from './ImportPage';
import { SignerBoardTable } from '../components/SignerBoardTable';
import { useAuth } from '../services/auth';

type TimeFilterMode = 'month' | 'range';

export function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [importId, setImportId] = useState('');
  const [filterMode, setFilterMode] = useState<TimeFilterMode>('month');

  // Month filter state
  const [monthInput, setMonthInput] = useState('');
  const [appliedMonth, setAppliedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState<Array<{ key: string; label: string }>>([]);

  // Date range UI state (what the user has typed/picked)
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  // Applied state (what's actually used to query)
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [unitScope, setUnitScope] = useState<UnitScope>('CENTRAL');

  const filters = {
    importId: (isAdmin ? importId : undefined) || undefined,
    from: appliedFrom || undefined,
    to: appliedTo || undefined
  };

  const imports = useQuery({
    queryKey: ['imports-for-report'],
    queryFn: async () => unwrap<ImportRecord[]>(await api.get('/imports')),
    enabled: isAdmin
  });

  const report = useQuery({
    queryKey: ['summary', filters],
    queryFn: async () => unwrap<Summary>(await api.get('/reports/summary', { params: filters }))
  });

  const createSnapshot = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.post('/snapshots', {
          name: snapshotName.trim() || `Thống kê ${new Date().toLocaleDateString('vi-VN')}`,
          importId: (isAdmin ? importId : undefined) || undefined,
          filters
        })
      ),
    onSuccess: async () => {
      toast.success('Đã lưu kết quả thống kê');
      setSnapshotName('');
      await queryClient.invalidateQueries({ queryKey: ['snapshots'] });
    },
    onError: (error) => toast.error(error.message)
  });

  const data = report.data;

  // Collect all months seen in report data
  useEffect(() => {
    if (data?.byMonth && data.byMonth.length > 0) {
      setAvailableMonths((prev) => {
        const map = new Map(prev.map((m) => [m.key, m.label]));
        for (const m of data.byMonth!) {
          map.set(m.key, m.label);
        }
        return Array.from(map.entries())
          .map(([key, label]) => ({ key, label }))
          .sort((a, b) => b.key.localeCompare(a.key));
      });
    }
  }, [data?.byMonth]);

  function applyMonth(monthValue: string) {
    if (!monthValue) return;
    const { from, to } = getMonthDateRange(monthValue);
    setMonthInput(monthValue);
    setAppliedMonth(monthValue);
    setFromInput(from);
    setToInput(to);
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  function applyMonthFilter() {
    if (!monthInput) {
      toast.error('Vui lòng chọn tháng cần lọc');
      return;
    }
    applyMonth(monthInput);
  }

  function applyDateFilter() {
    if (fromInput && toInput && fromInput > toInput) {
      toast.error('Ngày bắt đầu phải trước ngày kết thúc');
      return;
    }
    setAppliedMonth('');
    setAppliedFrom(fromInput);
    setAppliedTo(toInput);
  }

  function clearAllFilters() {
    if (isAdmin) setImportId('');
    setFromInput('');
    setToInput('');
    setAppliedFrom('');
    setAppliedTo('');
    setMonthInput('');
    setAppliedMonth('');
  }

  const centralOfficeRows = useMemo(() => {
    return (data?.boardRows || []).filter((row) => isCentralOfficeUnit(row.unit));
  }, [data?.boardRows]);

  const effectiveBoardRows = isAdmin ? (data?.boardRows || []) : centralOfficeRows;
  const currentScope: UnitScope = isAdmin ? unitScope : 'CENTRAL';

  const visibleBoardRows = filterResultBoardRows(effectiveBoardRows, boardSearch, currentScope);
  const visibleTotals = totalsFromBoardRows(visibleBoardRows);

  const query = new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => [key, String(value)])
  ).toString();

  const hasPendingDateChange = fromInput !== appliedFrom || toInput !== appliedTo;

  function exportVisibleBoard() {
    if (!visibleBoardRows.length) {
      toast.error('Không có dữ liệu để xuất Excel');
      return;
    }
    exportResultBoardExcel(
      visibleBoardRows,
      visibleTotals,
      `ioffice-thong-ke-don-vi-${currentScope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  const periodDescription = useMemo(() => {
    if (appliedMonth) {
      const [year, month] = appliedMonth.split('-');
      return `Dữ liệu Tháng ${month}/${year} (${appliedFrom} – ${appliedTo})`;
    }
    if (appliedFrom || appliedTo) {
      return `Lọc ngày: ${appliedFrom || 'đầu kỳ'} – ${appliedTo || 'hiện tại'}`;
    }
    return 'Toàn bộ dữ liệu theo phạm vi đã chọn';
  }, [appliedMonth, appliedFrom, appliedTo]);

  if ((isAdmin && imports.isLoading) || report.isLoading) return <LoadingState />;
  if ((isAdmin && imports.isError) || report.isError) {
    return (
      <ErrorState
        message={(imports.error || report.error)!.message}
        retry={() => {
          if (isAdmin) void imports.refetch();
          void report.refetch();
        }}
      />
    );
  }

  return (
    <section className="page-stack">
      <div className="panel report-filter">
        <div>
          <h2>Phạm vi thống kê</h2>
          <p>
            {isAdmin
              ? 'Chọn một lần nhập hoặc thống kê toàn bộ văn bản; có thể giới hạn theo tháng hoặc ngày ban hành.'
              : 'Thống kê văn bản theo tháng hoặc khoảng ngày ban hành (Trụ sở chính).'}
          </p>
        </div>
        <div className="toolbar">
          {isAdmin && (
            <select
              value={importId}
              onChange={(event) => setImportId(event.target.value)}
              aria-label="Chọn lần nhập"
            >
              <option value="">Tất cả lần nhập</option>
              {imports.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.originalFileName}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value as TimeFilterMode)}
            aria-label="Kiểu lọc thời gian"
          >
            <option value="month">Xem theo tháng</option>
            <option value="range">Xem theo khoảng ngày</option>
          </select>

          {filterMode === 'month' ? (
            <>
              <label>
                Tháng{' '}
                <input
                  type="month"
                  value={monthInput}
                  onChange={(event) => setMonthInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyMonthFilter();
                  }}
                  aria-label="Chọn tháng"
                />
              </label>
              {availableMonths.length > 0 && (
                <select
                  value={availableMonths.some((m) => m.key === monthInput) ? monthInput : ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val) {
                      applyMonth(val);
                    } else {
                      setMonthInput('');
                    }
                  }}
                  aria-label="Chọn nhanh tháng"
                >
                  <option value="">-- Chọn nhanh tháng --</option>
                  {availableMonths.map((m) => (
                    <option key={m.key} value={m.key}>
                      Tháng {m.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={applyMonthFilter}
                disabled={!monthInput || monthInput === appliedMonth}
              >
                Áp dụng
              </button>
            </>
          ) : (
            <>
              <label>
                Từ ngày{' '}
                <input
                  type="date"
                  value={fromInput}
                  onChange={(event) => setFromInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyDateFilter();
                  }}
                />
              </label>
              <label>
                Đến ngày{' '}
                <input
                  type="date"
                  value={toInput}
                  onChange={(event) => setToInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyDateFilter();
                  }}
                />
              </label>
              <button onClick={applyDateFilter} disabled={!hasPendingDateChange}>
                Áp dụng
              </button>
            </>
          )}

          <button className="secondary" onClick={clearAllFilters}>
            Tất cả dữ liệu
          </button>
          <button
            className="secondary"
            onClick={() => void downloadFile(`/reports/export?${query}`).catch((error) => toast.error(error.message))}
          >
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Tổng văn bản" value={visibleTotals.total} />
        <Kpi label="Đã ký số" value={visibleTotals.signed} />
        <Kpi label="Chưa ký số" value={visibleTotals.unsigned} />
        <Kpi label="Tỷ lệ ký" value={`${visibleTotals.signRate}%`} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>THỐNG KÊ VĂN BẢN ĐI THEO ĐƠN VỊ</h2>
            <p>{periodDescription}</p>
          </div>
          <div className="snapshot-create">
            <button className="secondary" disabled={!visibleBoardRows.length} onClick={exportVisibleBoard}>
              Xuất bảng Excel
            </button>
            {isAdmin && (
              <>
                <input
                  placeholder="Tên kết quả lưu (không bắt buộc)"
                  value={snapshotName}
                  onChange={(event) => setSnapshotName(event.target.value)}
                />
                <button
                  disabled={createSnapshot.isPending || !data?.totals.total}
                  onClick={() => createSnapshot.mutate()}
                >
                  {createSnapshot.isPending ? 'Đang lưu…' : 'Lưu kết quả thống kê'}
                </button>
              </>
            )}
          </div>
        </div>
        {effectiveBoardRows.length === 0 ? (
          <EmptyState />
        ) : (
          <ResultBoardTable
            rows={effectiveBoardRows}
            search={boardSearch}
            onSearchChange={setBoardSearch}
            scope={currentScope}
            onScopeChange={isAdmin ? setUnitScope : undefined}
            canChangeScope={isAdmin}
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>THỐNG KÊ VĂN BẢN ĐI THEO NGƯỜI KÝ CHÍNH</h2>
            <p>{data?.signerBoardRows?.length || 0} người ký chính trong phạm vi đã chọn.</p>
          </div>
        </div>
        <SignerBoardTable rows={data?.signerBoardRows || []} />
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{typeof value === 'number' ? numberText(value) : value}</strong>
    </div>
  );
}
