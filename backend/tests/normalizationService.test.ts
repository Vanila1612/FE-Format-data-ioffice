import { describe, expect, it } from 'vitest';
import { isSignedDocument, normalizeDocument, normalizeText, parseExcelDate } from '../src/services/normalizationService.js';

describe('normalizationService', () => {
  it('trims spaces and normalizes empty values', () => {
    expect(normalizeText('  ALCO  ')).toBe('ALCO');
    expect(normalizeText(null)).toBe('');
  });

  it('parses common date formats', () => {
    expect(parseExcelDate('13/08/2026')?.toISOString().slice(0, 10)).toBe('2026-08-13');
  });

  it('applies unit mapping', () => {
    const document = normalizeDocument({
      'Trích yếu': 'A',
      'Số ký hiệu': '1/CV-ALCO',
      'Văn bản ký số': 'Đã ký số',
      'Ngày ban hành': '13/08/2026',
      'Đơn vị ban hành': '  ALCO  '
    }, [{ sourceName: 'ALCO', normalizedName: 'Asset Liability Committee', enabled: true }]);
    expect(document.normalizedUnit).toBe('Asset Liability Committee');
  });

  it('detects signed documents', () => {
    expect(isSignedDocument('Đã ký số')).toBe(true);
    expect(isSignedDocument('')).toBe(false);
  });
});
