import { describe, expect, it } from 'vitest';
import XLSX from 'xlsx';
import { parseWorkbook } from '../src/services/excelService.js';
import { AppError } from '../src/utils/appError.js';

function workbookBuffer(rows: Record<string, unknown>[], sheetName = 'Sheet1') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

describe('excelService', () => {
  it('parses a valid iOffice workbook and returns preview rows', () => {
    const parsed = parseWorkbook(workbookBuffer([
      {
        'Trích yếu': 'Báo cáo',
        'Số ký hiệu': '01/BC-ALCO',
        'Văn bản ký số': 'Đã ký số',
        'Ngày ban hành': '13/08/2026',
        'Đơn vị ban hành': 'ALCO'
      }
    ]));

    expect(parsed.sheetName).toBe('Sheet1');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.preview[0]['Số ký hiệu']).toBe('01/BC-ALCO');
  });

  it('excludes the numbered description row below an iOffice header', () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['STT', 'Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành'],
      ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)'],
      [1, 'Văn bản thứ nhất', '01/BC-ALCO', 'Đã ký số', '01/08/2026', 'ALCO'],
      [2, 'Văn bản thứ hai', '02/CV-ALCO', 'Không ký số', '02/08/2026', 'ALCO']
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'iOffice');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    expect(parseWorkbook(buffer).rows).toHaveLength(2);
  });

  it('returns a clear error when required columns are missing', () => {
    expect(() => parseWorkbook(workbookBuffer([{ 'Trích yếu': 'Missing columns' }])))
      .toThrowError(AppError);
    try {
      parseWorkbook(workbookBuffer([{ 'Trích yếu': 'Missing columns' }]));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('MISSING_REQUIRED_COLUMNS');
      expect((error as AppError).details).toContain('Số ký hiệu');
    }
  });

  it('rejects an empty workbook with required headers but no document rows', () => {
    expect(() => parseWorkbook(workbookBuffer([
      {
        'Trích yếu': '',
        'Số ký hiệu': '',
        'Văn bản ký số': '',
        'Ngày ban hành': '',
        'Đơn vị ban hành': ''
      }
    ]))).toThrowError(AppError);
  });
});
