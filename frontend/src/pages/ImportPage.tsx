import { ChangeEvent, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../services/api';
import { groupLabels, numberText } from '../utils/format';
import { parseLocalExcel, type LocalImportResult, type ResultBoardRow } from '../utils/localImport';
import { filterResultBoardRows, totalsFromBoardRows, type UnitScope } from '../utils/unitScope';
import { SignerBoardTable } from '../components/SignerBoardTable';
import { SortHeader, type SortDir } from '../components/SortHeader';

export function ImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<LocalImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('ALL');

  const rows = useMemo(() => {
    const boardRows = result?.boardRows || [];
    return boardRows.filter((row) => {
      const search = query.trim().toLowerCase();
      const matchSearch = !search || row.unit.toLowerCase().includes(search);
      const matchGroup = group === 'ALL' ||
        (group === 'REPORT_PROPOSAL' && row.reportTotal > 0) ||
        (group === 'LETTER_AUTHORIZATION' && row.letterTotal > 0) ||
        (group === 'WORK_LETTER' && row.workTotal > 0);
      return matchSearch && matchGroup;
    });
  }, [result, query, group]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setResult(null);
    if (!nextFile) return;

    setLoading(true);
    try {
      const parsed = await parseLocalExcel(nextFile);
      setResult(parsed);
      if (parsed.missingColumns.length) {
        toast.error(`Thiếu cột bắt buộc: ${parsed.missingColumns.join(', ')}`);
      } else {
        toast.success(`Đã chuẩn hóa ${parsed.documents.length} dòng`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đọc file Excel');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setQuery('');
    setGroup('ALL');
  }

  async function saveToDatabase() {
    if (!file || !result || result.missingColumns.length) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const saved = await unwrap<{ import: { id: string }; documentsImported: number; replacedRows: number }>(await api.post('/imports', form));
      toast.success(`Đã lưu ${saved.documentsImported} dòng văn bản`);
      navigate(`/documents?importId=${saved.import.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu dữ liệu vào cơ sở dữ liệu');
    } finally {
      setSaving(false);
    }
  }

  return <section className="page-stack">
    <label className="dropzone">
      <input type="file" accept=".xlsx,.xls" onChange={selectFile} />
      <FileUp size={34} />
      <strong>{file ? file.name : 'Chọn hoặc kéo thả file Excel'}</strong>
      <span>Đọc file, chuẩn hóa và kiểm tra trước khi lưu vào hệ thống.</span>
    </label>

    {file && <div className="panel file-info">
      <CheckCircle2 size={18} />
      <span>{file.name}</span>
      <b>{Math.round(file.size / 1024)} KB</b>
      <button className="secondary" onClick={reset} aria-label="Làm mới dữ liệu nhập"><RotateCcw size={16} /> Làm mới</button>
    </div>}

    {loading && <div className="panel">Đang đọc và chuẩn hóa file Excel</div>}

    {result?.missingColumns.length ? <div className="panel error-state">
      <strong>File thiếu cột bắt buộc</strong>
      <span>{result.missingColumns.join(', ')}</span>
    </div> : null}

    {result && !result.missingColumns.length && <><div className="toolbar"><button disabled={saving} onClick={saveToDatabase}>{saving ? 'Đang lưu dữ liệu…' : 'Lưu vào hệ thống'}</button><span>Mỗi dòng văn bản được lưu nguyên vẹn, kể cả khi có cùng số ký hiệu.</span></div><LocalResult result={result} rows={rows} query={query} setQuery={setQuery} group={group} setGroup={setGroup} /></>}
  </section>;
}

function LocalResult({ result, rows, query, setQuery, group, setGroup }: {
  result: LocalImportResult;
  rows: ResultBoardRow[];
  query: string;
  setQuery: (value: string) => void;
  group: string;
  setGroup: (value: string) => void;
}) {
  const [boardSearch, setBoardSearch] = useState('');
  const [unitScope, setUnitScope] = useState<UnitScope>('ALL');
  const visibleRows = useMemo(() => filterResultBoardRows(rows, boardSearch, unitScope), [rows, boardSearch, unitScope]);
  const totals = useMemo(() => totalsFromBoardRows(visibleRows), [visibleRows]);

  return <>
    <div className="kpi-grid">
      <div className="kpi"><span>Tổng văn bản</span><strong>{numberText(totals.total)}</strong></div>
      <div className="kpi"><span>Đã ký số</span><strong>{numberText(totals.signed)}</strong></div>
      <div className="kpi"><span>Chưa ký số</span><strong>{numberText(totals.unsigned)}</strong></div>
      <div className="kpi"><span>Tỷ lệ ký</span><strong>{totals.signRate}%</strong></div>
    </div>

    <div className="toolbar">
      <input placeholder="Tìm đơn vị" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select value={group} onChange={(event) => setGroup(event.target.value)}>
        <option value="ALL">Tất cả nhóm</option>
        {Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <span>{numberText(rows.length)} đơn vị</span>
    </div>

    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>THỐNG KÊ VĂN BẢN ĐI THEO ĐƠN VỊ</h2>
          <p>Khoảng thời gian: {result.period.from || '-'} - {result.period.to || '-'}</p>
        </div>
      </div>
      <ResultBoardTable rows={rows} search={boardSearch} onSearchChange={setBoardSearch} scope={unitScope} onScopeChange={setUnitScope} />
    </div>

    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>THỐNG KÊ VĂN BẢN ĐI THEO NGƯỜI KÝ CHÍNH</h2>
          <p>{result.signerBoardRows.length} người ký chính trong file vừa đọc.</p>
        </div>
      </div>
      <SignerBoardTable rows={result.signerBoardRows} />
    </div>
  </>;
}

type ResultSortKey =
  | 'stt' | 'unit'
  | 'reportSigned' | 'reportTotal' | 'reportRate'
  | 'letterSigned' | 'letterTotal' | 'letterRate'
  | 'workSigned' | 'workTotal' | 'workRate'
  | 'totalSigned' | 'totalDocuments' | 'totalRate';
type ResultSortState = { key: ResultSortKey; dir: SortDir };

const RESULT_FIELDS: Record<ResultSortKey, (row: ResultBoardRow) => string | number> = {
  stt: (row) => row.stt,
  unit: (row) => row.unit,
  reportSigned: (row) => row.reportSigned, reportTotal: (row) => row.reportTotal, reportRate: (row) => row.reportRate,
  letterSigned: (row) => row.letterSigned, letterTotal: (row) => row.letterTotal, letterRate: (row) => row.letterRate,
  workSigned: (row) => row.workSigned, workTotal: (row) => row.workTotal, workRate: (row) => row.workRate,
  totalSigned: (row) => row.totalSigned, totalDocuments: (row) => row.totalDocuments, totalRate: (row) => row.totalRate
};

const RESULT_IS_TEXT: Record<ResultSortKey, boolean> = {
  stt: false, unit: true,
  reportSigned: false, reportTotal: false, reportRate: false,
  letterSigned: false, letterTotal: false, letterRate: false,
  workSigned: false, workTotal: false, workRate: false,
  totalSigned: false, totalDocuments: false, totalRate: false
};

export function ResultBoardTable({ rows, search: controlledSearch, onSearchChange, scope: controlledScope, onScopeChange }: {
  rows: ResultBoardRow[];
  search?: string;
  onSearchChange?: (value: string) => void;
  scope?: UnitScope;
  onScopeChange?: (value: UnitScope) => void;
}) {
  const [sort, setSort] = useState<ResultSortState>({ key: 'stt', dir: 'asc' });
  const [internalSearch, setInternalSearch] = useState('');
  const [internalScope, setInternalScope] = useState<UnitScope>('ALL');
  const search = controlledSearch ?? internalSearch;
  const scope = controlledScope ?? internalScope;
  const setSearch = onSearchChange ?? setInternalSearch;
  const setScope = onScopeChange ?? setInternalScope;

  const filtered = useMemo(() => filterResultBoardRows(rows, search, scope), [rows, search, scope]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const field = RESULT_FIELDS[sort.key];
    const av = field(a);
    const bv = field(b);
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv, 'vi') * (sort.dir === 'asc' ? 1 : -1);
    return (Number(av) - Number(bv)) * (sort.dir === 'asc' ? 1 : -1);
  }), [filtered, sort]);

  function toggle(key: ResultSortKey) {
    setSort((current) => {
      if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: RESULT_IS_TEXT[key] ? 'asc' : 'desc' };
    });
  }

  const h = (label: string, key: ResultSortKey, align: 'left' | 'center' = 'center') => (
    <SortHeader label={label} active={sort.key === key} dir={sort.dir} onClick={() => toggle(key)} align={align} />
  );

  return <div className="panel-stack">
    <div className="toolbar signer-search">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        placeholder={`Tìm trong ${numberText(rows.length)} đơn vị`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Tìm đơn vị"
      />
      {search && <button type="button" className="secondary" onClick={() => setSearch('')}>Xóa</button>}
      <select value={scope} onChange={(event) => setScope(event.target.value as UnitScope)} aria-label="Lọc chi nhánh">
        <option value="ALL">Tất cả đơn vị</option>
        <option value="CENTRAL">Trụ sở chính</option>
        <option value="BRANCH">Chi nhánh</option>
      </select>
      <span className="muted">{numberText(sorted.length)}/{numberText(rows.length)} đơn vị</span>
    </div>

    {sorted.length === 0 ? (
      <div className="state empty-state"><strong>{search ? `Không tìm thấy đơn vị phù hợp với “${search}”` : 'Không có đơn vị nào khớp bộ lọc'}</strong></div>
    ) : (
      <div className="table-scroll result-board">
    <table>
      <thead>
        <tr>
          <th rowSpan={2}>{h('STT', 'stt')}</th>
          <th rowSpan={2}>{h('Đơn vị', 'unit', 'left')}</th>
          <th colSpan={3}>1.1 Báo cáo/Tờ trình</th>
          <th colSpan={3}>1.4 Công văn / Ủy quyền</th>
          <th colSpan={3}>1.3 Thư công tác</th>
          <th colSpan={3}>Tổng văn bản</th>
        </tr>
        <tr>
          <th>{h('Đã ký', 'reportSigned')}</th>
          <th>{h('Tổng', 'reportTotal')}</th>
          <th>{h('Tỷ lệ', 'reportRate')}</th>
          <th>{h('Đã ký', 'letterSigned')}</th>
          <th>{h('Tổng', 'letterTotal')}</th>
          <th>{h('Tỷ lệ', 'letterRate')}</th>
          <th>{h('Đã ký', 'workSigned')}</th>
          <th>{h('Tổng', 'workTotal')}</th>
          <th>{h('Tỷ lệ', 'workRate')}</th>
          <th>{h('Đã ký', 'totalSigned')}</th>
          <th>{h('Tổng', 'totalDocuments')}</th>
          <th>{h('Tỷ lệ', 'totalRate')}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, index) => <tr key={row.unit}>
          <td>{index + 1}</td>
          <td>{row.unit}</td>
          <MetricCells signed={row.reportSigned} total={row.reportTotal} rate={row.reportRate} />
          <MetricCells signed={row.letterSigned} total={row.letterTotal} rate={row.letterRate} />
          <MetricCells signed={row.workSigned} total={row.workTotal} rate={row.workRate} />
          <MetricCells signed={row.totalSigned} total={row.totalDocuments} rate={row.totalRate} />
        </tr>)}
      </tbody>
    </table></div>
    )}
  </div>;
}

function MetricCells({ signed, total, rate }: { signed: number; total: number; rate: number }) {
  return <>
    <td>{numberText(signed)}</td>
    <td>{numberText(total)}</td>
    <td>{rate}%</td>
  </>;
}
