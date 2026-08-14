import { ChangeEvent, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../services/api';
import { groupLabels, numberText } from '../utils/format';
import { parseLocalExcel, type LocalImportResult, type ResultBoardRow } from '../utils/localImport';

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
  return <>
    <div className="kpi-grid">
      <div className="kpi"><span>Tổng văn bản</span><strong>{numberText(result.totals.total)}</strong></div>
      <div className="kpi"><span>Đã ký số</span><strong>{numberText(result.totals.signed)}</strong></div>
      <div className="kpi"><span>Chưa ký số</span><strong>{numberText(result.totals.unsigned)}</strong></div>
      <div className="kpi"><span>Tỷ lệ ký</span><strong>{result.totals.signRate}%</strong></div>
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
      <ResultBoardTable rows={rows} />
    </div>
  </>;
}

export function ResultBoardTable({ rows }: { rows: ResultBoardRow[] }) {
  return <div className="table-scroll result-board">
    <table>
      <thead>
        <tr>
          <th rowSpan={2}>STT</th>
          <th rowSpan={2}>Đơn vị</th>
          <th colSpan={3}>1.1 Báo cáo/Tờ trình</th>
          <th colSpan={3}>1.4 Công văn / Ủy quyền</th>
          <th colSpan={3}>1.3 Thư công tác</th>
          <th colSpan={3}>Tổng văn bản</th>
        </tr>
        <tr>
          <th>Đã ký</th>
          <th>Tổng</th>
          <th>Tỷ lệ</th>
          <th>Đã ký</th>
          <th>Tổng</th>
          <th>Tỷ lệ</th>
          <th>Đã ký</th>
          <th>Tổng</th>
          <th>Tỷ lệ</th>
          <th>Đã ký</th>
          <th>Tổng</th>
          <th>Tỷ lệ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <tr key={row.unit}>
          <td>{row.stt}</td>
          <td>{row.unit}</td>
          <MetricCells signed={row.reportSigned} total={row.reportTotal} rate={row.reportRate} />
          <MetricCells signed={row.letterSigned} total={row.letterTotal} rate={row.letterRate} />
          <MetricCells signed={row.workSigned} total={row.workTotal} rate={row.workRate} />
          <MetricCells signed={row.totalSigned} total={row.totalDocuments} rate={row.totalRate} />
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function MetricCells({ signed, total, rate }: { signed: number; total: number; rate: number }) {
  return <>
    <td>{numberText(signed)}</td>
    <td>{numberText(total)}</td>
    <td>{rate}%</td>
  </>;
}
