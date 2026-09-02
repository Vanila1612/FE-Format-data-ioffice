import { describe, expect, it } from 'vitest';
import { documentDedupeKey, isSignedDocument, normalizeDocument, normalizeNhnoReferenceUnit, normalizeText, normalizeUnit, parseExcelDate } from '../src/services/normalizationService.js';

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
      'Người ký chính': 'Nguyễn Văn A',
      'Ngày ban hành': '13/08/2026',
      'Đơn vị ban hành': '  ALCO  '
    }, [{ sourceName: 'ALCO', normalizedName: 'Asset Liability Committee', enabled: true }]);
    expect(document.normalizedUnit).toBe('Asset Liability Committee');
    expect(document.signerName).toBe('Nguyễn Văn A');
  });

  it('reads the signer name from both legacy and new header spellings', () => {
    const legacyHeader = normalizeDocument({
      'Trích yếu': 'A',
      'Số ký hiệu': '1/CV-ALCO',
      'Văn bản ký số': '',
      'NGUOI_KY_CHINH': 'nguyenvana',
      'Ngày ban hành': '13/08/2026',
      'Đơn vị ban hành': 'ALCO'
    }, []);
    expect(legacyHeader.signerName).toBe('nguyenvana');

    const missingHeader = normalizeDocument({
      'Trích yếu': 'A',
      'Số ký hiệu': '1/CV-ALCO',
      'Văn bản ký số': '',
      'Ngày ban hành': '13/08/2026',
      'Đơn vị ban hành': 'ALCO'
    }, []);
    expect(missingHeader.signerName).toBe('');
  });

  it('detects signed documents', () => {
    expect(isSignedDocument('Đã ký số')).toBe(true);
    expect(isSignedDocument('')).toBe(false);
  });

  it('groups known unit-name variants into the requested canonical units', () => {
    const emptyMappings: never[] = [];
    expect(normalizeUnit('BAN KIỂM SOÁT', emptyMappings)).toBe('Ban Kiểm soát Agribank');
    expect(normalizeUnit('Đảng Ủy Agribank', emptyMappings)).toBe('Tổ chức Đảng Ủy');
    expect(normalizeUnit('Trụ sở chính Agribank', emptyMappings)).toBe('Văn phòng TSC');
    expect(normalizeUnit('Văn phòng Trụ sở chính', emptyMappings)).toBe('Văn phòng TSC');
    expect(normalizeUnit('Công đoàn cơ sở Trung tâm Thẻ', emptyMappings)).toBe('Trung tâm Thẻ');
    expect(normalizeUnit('Chi bộ Trung tâm PCRT', emptyMappings)).toBe('Trung tâm Phòng, chống rửa tiền');
    expect(normalizeUnit('TTKH', emptyMappings)).toBe('TTDV TT&KH');
    expect(normalizeUnit('phòng Tổng hợp', emptyMappings)).toBe('Văn phòng TSC');
    expect(normalizeUnit('KIỂM TOÁN NỘI BỘ - BAN KIỂM SOÁT', emptyMappings)).toBe('Ban Kiểm soát Agribank');
    expect(normalizeUnit('TTT.12', emptyMappings)).toBe('Trung tâm Thẻ');
    expect(normalizeUnit('Ban thư ký HDTV', emptyMappings)).toBe('Ban Thư ký Hội đồng thành viên');
    expect(normalizeUnit('TTCNTT', emptyMappings)).toBe('Trung tâm Công nghệ thông tin');
    expect(normalizeUnit('KHDN', emptyMappings)).toBe('Ban Khách hàng Doanh nghiệp');
    expect(normalizeUnit('QLRRTD', emptyMappings)).toBe('Trung tâm Quản lý rủi ro tín dụng');
    expect(normalizeUnit('VPĐD miền Trung', emptyMappings)).toBe('Văn phòng đại diện Khu vực miền Trung');
    expect(normalizeUnit('Ban KHCL', emptyMappings)).toBe('Ban Kế hoạch chiến lược');
    expect(normalizeUnit('Ban Tổ chức Đảng ủy', emptyMappings)).toBe('Tổ chức Đảng Ủy');
    expect(normalizeUnit('Ban Quản lý TS Nợ - TS Có', emptyMappings)).toBe('Ban Quản lý Tài sản Nợ - Tài sản Có');
    expect(normalizeUnit('TTPD', emptyMappings)).toBe('Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh');
  });

  it('uses reference number, issue date, and issuing unit as the duplicate identity', () => {
    const date = new Date('2026-08-13T00:00:00.000Z');
    expect(documentDedupeKey('01/CV-ABC', date, 'Ban Kiểm soát')).toBe(documentDedupeKey('01/CV-ABC', date, 'BAN KIỂM SOÁT'));
    expect(documentDedupeKey('01/CV-ABC', date, 'Ban Kiểm soát')).not.toBe(documentDedupeKey('02/CV-ABC', date, 'Ban Kiểm soát'));
  });

  it('maps approved NHNo reference suffixes and excludes unknown suffixes', () => {
    const emptyMappings: never[] = [];
    expect(normalizeNhnoReferenceUnit('12969/NHNo-ALCO', emptyMappings)).toBe('Trung tâm quản lý nợ có vấn đề');
    expect(normalizeNhnoReferenceUnit('1/NHNo-TTT.12', emptyMappings)).toBe('Trung tâm Thẻ');
    expect(normalizeNhnoReferenceUnit('1073', emptyMappings)).toBeNull();
  });
});
