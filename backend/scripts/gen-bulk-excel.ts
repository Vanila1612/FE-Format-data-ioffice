import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const TOTAL = Number(process.argv[2] || 200_000);
const OUT = path.resolve(process.argv[3] || 'storage/tmp/bulk-sample.xlsx');

const headers = ['Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Người ký chính', 'Ngày ban hành', 'Đơn vị ban hành'];
const units = ['Ban ALCO', 'Ban QL Dự án DTXD khu vực', 'Ban Khách hàng Doanh nghiệp', 'Ban Tái chính Kế toán', 'Ban CNTT', 'Trung tâm Tài Trợ Thương mại', 'Ban Ngân hàng số', 'Ban KHCL'];
const prefixes = ['BC', 'TTr', 'CV', 'UQ'];
const signers = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E', 'Đỗ Thị F', 'Bùi Văn G', 'Võ Thị H'];

const rows: Record<string, unknown>[] = [];
for (let i = 0; i < TOTAL; i += 1) {
  const prefix = prefixes[i % prefixes.length];
  const unit = units[i % units.length];
  const date = new Date(2026, 0, 1 + (i % 365));
  const signed = i % 3 === 0 ? 'Đã ký số' : '';
  const signer = signed ? signers[i % signers.length] : '';
  rows.push({
    'Trích yếu': `Tài liệu số ${i + 1} - Báo cáo tiến độ ${unit}`,
    'Số ký hiệu': `${String(i + 1).padStart(5, '0')}/${prefix}-${unit.replace(/\s+/g, '').slice(0, 6).toUpperCase()}`,
    'Văn bản ký số': signed,
    'Người ký chính': signer,
    'Ngày ban hành': `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`,
    'Đơn vị ban hành': unit
  });
}

const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
XLSX.writeFile(workbook, OUT);
const stat = fs.statSync(OUT);
console.log(`Wrote ${OUT} | ${TOTAL.toLocaleString('en-US')} rows | ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
