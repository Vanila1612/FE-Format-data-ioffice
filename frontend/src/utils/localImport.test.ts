import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseLocalExcel } from './localImport';

describe('localImport parseLocalExcel', () => {
  it('giữ nguyên và đếm đủ tất cả các dòng văn bản, bao gồm văn bản NHNo không có hậu tố hoặc hậu tố lạ', async () => {
    const rows = [
      ['STT', 'Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành', 'Người ký chính'],
      ['1', 'Công văn 1', '12969/NHNo-ALCO', 'Đã ký số', '2026-08-01', 'NHNo', 'Nguyễn Văn A'],
      ['2', 'Công văn 2', '1073/NHNo', '', '2026-08-02', 'NHNo', 'Trần Văn B'],
      ['3', 'Công văn 3', '555/NHNo-SUFFIX_CHUA_CO', 'Đã ký số', '2026-08-03', 'NHNo', 'Lê Văn C'],
      ['4', 'Báo cáo 4', '12/BC-BKS', '', '2026-08-04', 'Ban Kiểm soát', 'Phạm Thị D']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseLocalExcel(file);

    expect(result.documents.length).toBe(4);
    expect(result.totals.total).toBe(4);
    expect(result.totals.signed).toBe(2);
    expect(result.totals.unsigned).toBe(2);

    const totalInBoard = result.boardRows.reduce((sum, r) => sum + r.totalDocuments, 0);
    expect(totalInBoard).toBe(4);

    // Văn bản NHNo không có hậu tố hoặc hậu tố lạ phải được map về 'Văn phòng TSC'
    const doc2 = result.documents.find((d) => d.referenceNumber === '1073/NHNo');
    expect(doc2?.normalizedUnit).toBe('Văn phòng TSC');

    const doc3 = result.documents.find((d) => d.referenceNumber === '555/NHNo-SUFFIX_CHUA_CO');
    expect(doc3?.normalizedUnit).toBe('Văn phòng TSC');
  });

  it('áp dụng đúng bảng chuẩn hóa đơn vị tại thời điểm upload file', async () => {
    const rows = [
      ['STT', 'Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành', 'Người ký chính'],
      ['1', 'Công văn 1', '100/CV-CG', '', '2026-08-01', 'Agribank Chi nhanh Can Gio', 'Nguyễn Văn A'],
      ['2', 'Công văn 2', '101/CV-CG', 'Đã ký số', '2026-08-02', 'Agribank Chi nhánh Cần Giờ', 'Trần Văn B'],
      ['3', 'Công văn 3', '102/CV-BKS', '', '2026-08-03', 'BAN KIỂM SOÁT', 'Lê Văn C']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const file = new File([buffer], 'test-mapping.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseLocalExcel(file, {
      unitMappings: [
        { sourceName: 'Agribank Chi nhanh Can Gio', normalizedName: 'Agribank Chi nhánh Cần Giờ nè', enabled: true },
        { sourceName: 'BAN KIỂM SOÁT', normalizedName: 'Ban Kiểm soát Tùy Biến', enabled: true }
      ]
    });

    expect(result.documents.length).toBe(3);

    // Cả 2 dòng "Agribank Chi nhanh Can Gio" và "Agribank Chi nhánh Cần Giờ" đều được chuẩn hóa thành "Agribank Chi nhánh Cần Giờ nè"
    const doc1 = result.documents[0];
    const doc2 = result.documents[1];
    expect(doc1.normalizedUnit).toBe('Agribank Chi nhánh Cần Giờ nè');
    expect(doc2.normalizedUnit).toBe('Agribank Chi nhánh Cần Giờ nè');

    // BAN KIỂM SOÁT được ưu tiên theo mapping tùy biến thay vì built-in default
    const doc3 = result.documents[2];
    expect(doc3.normalizedUnit).toBe('Ban Kiểm soát Tùy Biến');

    // Trong bảng thống kê theo đơn vị (boardRows), nhóm theo tên chuẩn hóa mới
    const canGioRow = result.boardRows.find((r) => r.unit === 'Agribank Chi nhánh Cần Giờ nè');
    expect(canGioRow).toBeDefined();
    expect(canGioRow?.totalDocuments).toBe(2);
    expect(canGioRow?.totalSigned).toBe(1);

    // Không còn dòng có tên cũ chưa chuẩn hóa
    const oldRow = result.boardRows.find((r) => r.unit === 'Agribank Chi nhanh Can Gio');
    expect(oldRow).toBeUndefined();
  });
});
