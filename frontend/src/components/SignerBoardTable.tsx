import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, unwrap } from '../services/api';
import type { Signer, SignerBoardRow } from '../types/api';
import { numberText } from '../utils/format';
import { SignerCell } from './SignerCell';
import { SortHeader, type SortDir } from './SortHeader';

type SignerBoardTableProps = {
  rows: SignerBoardRow[];
  limit?: number;
};

type SortKey = 'stt' | 'signer' | 'signed' | 'totalDocuments' | 'signRate';
type SortState = { key: SortKey; dir: SortDir };

const DEFAULT_SORT: SortState = { key: 'stt', dir: 'asc' };

export function SignerBoardTable({ rows, limit }: SignerBoardTableProps) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');

  const signers = useQuery({
    queryKey: ['signers'],
    queryFn: async () => unwrap<Signer[]>(await api.get('/signers')),
    staleTime: 5 * 60_000
  });

  const positions = useMemo(
    () => [...new Set((signers.data || []).map((signer) => signer.position))].sort((a, b) => a.localeCompare(b, 'vi')),
    [signers.data]
  );

  const allowedSigners = useMemo(() => {
    if (!position) return null;
    return new Set((signers.data || []).filter((signer) => signer.position === position).map((signer) => signer.username.toLowerCase()));
  }, [signers.data, position]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && !row.signer.toLowerCase().includes(needle)) return false;
      if (allowedSigners && !allowedSigners.has(row.signer.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, search, allowedSigners]);

  const sortedRows = useMemo(() => {
    const direction = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: SignerBoardRow, b: SignerBoardRow) => {
      switch (sort.key) {
        case 'signer':
          return a.signer.localeCompare(b.signer, 'vi') * direction;
        case 'signed':
          return (a.signed - b.signed) * direction;
        case 'totalDocuments':
          return (a.totalDocuments - b.totalDocuments) * direction;
        case 'signRate':
          return (a.signRate - b.signRate) * direction;
        case 'stt':
        default:
          return (a.stt - b.stt) * direction;
      }
    };
    return [...filteredRows].sort(compare);
  }, [filteredRows, sort]);

  const visible = limit ? sortedRows.slice(0, limit) : sortedRows;

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
      }
      const isNumeric = key !== 'signer';
      return { key, dir: isNumeric ? 'desc' : 'asc' };
    });
  }

  if (rows.length === 0) {
    return <div className="state empty-state"><strong>Chưa có dữ liệu người ký chính trong phạm vi đã chọn</strong></div>;
  }

  return (
    <div className="panel-stack">
      <div className="toolbar signer-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder={`Tìm trong ${numberText(rows.length)} người ký`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Tìm người ký chính"
        />
        <select value={position} onChange={(event) => setPosition(event.target.value)} aria-label="Lọc theo chức danh người ký">
          <option value="">Tất cả người ký</option>
          {positions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {(search || position) && <button type="button" className="secondary" onClick={() => { setSearch(''); setPosition(''); }}>Xóa</button>}
        <span className="muted">{numberText(visible.length)}/{numberText(rows.length)} người ký</span>
      </div>

      {visible.length === 0 ? (
        <div className="state empty-state"><strong>Không tìm thấy người ký phù hợp với bộ lọc đang chọn</strong></div>
      ) : (
        <div className="table-scroll result-board">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}><SortHeader label="STT" active={sort.key === 'stt'} dir={sort.dir} onClick={() => toggleSort('stt')} align="center" /></th>
                <th rowSpan={2}><SortHeader label="Người ký chính" active={sort.key === 'signer'} dir={sort.dir} onClick={() => toggleSort('signer')} align="left" /></th>
                <th colSpan={3}>Văn bản</th>
              </tr>
              <tr>
                <th><SortHeader label="Đã ký số" active={sort.key === 'signed'} dir={sort.dir} onClick={() => toggleSort('signed')} align="center" /></th>
                <th><SortHeader label="Tổng" active={sort.key === 'totalDocuments'} dir={sort.dir} onClick={() => toggleSort('totalDocuments')} align="center" /></th>
                <th><SortHeader label="Tỷ lệ" active={sort.key === 'signRate'} dir={sort.dir} onClick={() => toggleSort('signRate')} align="center" /></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.signer}>
                  <td>{index + 1}</td>
                  <td className="signer-name-cell"><SignerCell name={row.signer} /></td>
                  <td>{numberText(row.signed)}</td>
                  <td>{numberText(row.totalDocuments)}</td>
                  <td>{row.signRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
