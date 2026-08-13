import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const rows = [
  { 'Trích yếu': 'Báo cáo hoạt động', 'Số ký hiệu': '01/BC-ALCO', 'Văn bản ký số': 'Đã ký số', 'Ngày ban hành': '01/08/2026', 'Đơn vị ban hành': 'ALCO' },
  { 'Trích yếu': 'Tờ trình phê duyệt', 'Số ký hiệu': '02/TTr-BAN', 'Văn bản ký số': 'Đã ký số', 'Ngày ban hành': '02/08/2026', 'Đơn vị ban hành': 'Ban Khách hàng doanh nghiệp' },
  { 'Trích yếu': 'Công văn chỉ đạo', 'Số ký hiệu': '03/CV-CN', 'Văn bản ký số': '', 'Ngày ban hành': '03/08/2026', 'Đơn vị ban hành': 'Chi nhánh mẫu' },
  { 'Trích yếu': 'Ủy quyền nội bộ', 'Số ký hiệu': '04/UQ-CN', 'Văn bản ký số': 'Đã ký số', 'Ngày ban hành': '04/08/2026', 'Đơn vị ban hành': 'Chi nhánh mẫu' },
  { 'Trích yếu': 'Thư công tác', 'Số ký hiệu': '05/TB-VP', 'Văn bản ký số': '', 'Ngày ban hành': '05/08/2026', 'Đơn vị ban hành': 'Văn phòng Trụ sở chính' },
  { 'Trích yếu': 'NHNo special case', 'Số ký hiệu': '12969/NHNo-ALCO', 'Văn bản ký số': 'Đã ký số', 'Ngày ban hành': '06/08/2026', 'Đơn vị ban hành': 'NHNo' },
  { 'Trích yếu': 'Agribank special case', 'Số ký hiệu': '07/BC-TSC', 'Văn bản ký số': 'Đã ký số', 'Ngày ban hành': '07/08/2026', 'Đơn vị ban hành': 'Agribank' }
];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Sample');
const target = path.resolve('fixtures/sample-ioffice.xlsx');
fs.mkdirSync(path.dirname(target), { recursive: true });
XLSX.writeFile(workbook, target);
console.log(`Created ${target}`);
