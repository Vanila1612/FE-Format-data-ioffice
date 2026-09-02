import * as XLSX from 'xlsx';
import type { ResultBoardRow } from '../types/api';

type ResultBoardTotals = {
  total: number;
  signed: number;
  unsigned: number;
  signRate: number;
};

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(value: string) {
  return value.normalize('NFC').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

export function exportResultBoardExcel(rows: ResultBoardRow[], totals: ResultBoardTotals, filename = `ioffice-thong-ke-don-vi-${dateStamp()}.xlsx`) {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    { 'Chỉ tiêu': 'Tổng văn bản', 'Giá trị': totals.total },
    { 'Chỉ tiêu': 'Đã ký số', 'Giá trị': totals.signed },
    { 'Chỉ tiêu': 'Chưa ký số', 'Giá trị': totals.unsigned },
    { 'Chỉ tiêu': 'Tỷ lệ ký', 'Giá trị': `${totals.signRate}%` }
  ];
  const boardRows = rows.map((row, index) => ({
    STT: index + 1,
    'Đơn vị': row.unit,
    '1.1 Báo cáo/Tờ trình - Đã ký': row.reportSigned,
    '1.1 Báo cáo/Tờ trình - Tổng': row.reportTotal,
    '1.1 Báo cáo/Tờ trình - Tỷ lệ': `${row.reportRate}%`,
    '1.4 Công văn/Ủy quyền - Đã ký': row.letterSigned,
    '1.4 Công văn/Ủy quyền - Tổng': row.letterTotal,
    '1.4 Công văn/Ủy quyền - Tỷ lệ': `${row.letterRate}%`,
    '1.3 Thư công tác - Đã ký': row.workSigned,
    '1.3 Thư công tác - Tổng': row.workTotal,
    '1.3 Thư công tác - Tỷ lệ': `${row.workRate}%`,
    'Tổng văn bản - Đã ký': row.totalSigned,
    'Tổng văn bản - Tổng': row.totalDocuments,
    'Tổng văn bản - Tỷ lệ': `${row.totalRate}%`
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Tong quan');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(boardRows), 'Thong ke don vi');
  XLSX.writeFile(workbook, safeFileName(filename));
}
