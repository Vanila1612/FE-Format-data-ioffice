type UnitMapping = { sourceName: string; normalizedName: string; enabled: boolean };
import XLSX from 'xlsx';

export const REQUIRED_HEADERS = [
  'Trích yếu',
  'Số ký hiệu',
  'Văn bản ký số',
  'Ngày ban hành',
  'Đơn vị ban hành'
] as const;

export type RawExcelRow = Record<string, unknown>;

export type NormalizedDocumentInput = {
  summary: string;
  referenceNumber: string;
  signedDocument: string;
  issueDate: Date | null;
  issuingUnit: string;
  normalizedUnit: string;
  rawData: RawExcelRow;
};

export function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function comparisonKey(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function documentDedupeKey(referenceNumber: string, issueDate: Date | null, issuingUnit: string): string {
  return [comparisonKey(referenceNumber), issueDate?.toISOString().slice(0, 10) || 'no-date', comparisonKey(issuingUnit)].join('|');
}

const BUILT_IN_UNIT_MAPPINGS: Record<string, string> = {
  'ban kiem soat': 'Ban Kiểm soát',
  'dang uy agribank': 'Đảng ủy Agribank',
  'tru so chinh': 'Trụ sở chính',
  'tru so chinh agribank': 'Trụ sở chính',
  'van phong tru so chinh': 'Trụ sở chính',
  'cong doan co so trung tam the': 'Trung tâm Thẻ',
  'chi bo trung tam pcrt': 'Trung tâm Phòng, chống rửa tiền',
  // The input workbook uses both the abbreviation and the full official name.
  'ttkh': 'Trung tâm Dịch vụ thanh toán và kiều hối',
  'phong tong hop': 'Trụ sở chính',
  'kiem toan noi bo ban kiem soat': 'Ban Kiểm soát'
};

// Mã ở cuối số ký hiệu của văn bản NHNo. Danh mục này được đối chiếu với
// workbook rà soát thủ công đã được xác nhận là kết quả chuẩn.
const NHNO_REFERENCE_UNIT_MAPPINGS: Record<string, string> = {
  'qldt': 'Ban Quản lý đầu tư nội ngành',
  'ttkh': 'Trung tâm Dịch vụ thanh toán và kiều hối',
  'alco': 'TRUNG TÂM QUẢN LÝ NỢ CVĐ',
  'khcn': 'Ban Khách hàng cá nhân',
  'tkth': 'Ban Thư ký Tổng hợp',
  'dtcph': 'Ban Đầu tư và Cổ phần hóa',
  'kdvtt': 'Trung tâm Kinh doanh Vốn và Tiền tệ',
  'tttt': 'Trung tâm Thanh toán',
  'vp': 'Trụ sở chính',
  'qlxd': 'Ban QL Dự án ĐTXD khu vực',
  'th': 'Ban QL Dự án ĐTXD khu vực',
  'tcns': 'Ban Tổ chức nhân sự',
  'cskh': 'TRUNG TÂM CHĂM SÓC KHÁCH HÀNG',
  'rrtd': 'Trung tâm QLRRTD',
  'cd': 'Cơ quan Công đoàn',
  'nhs': 'Ban Ngân hàng số',
  'cn': 'Ban Công nghệ',
  'dctc': 'Ban Định chế tài chính',
  'ktnb': 'Ban Kiểm tra, giám sát nội bộ',
  'tdtcb': 'Trường ĐTCB',
  'tttm': 'Trung Tâm Tài Trợ Thương Mại',
  'bqle3': 'Ban QLE3'
};

export function normalizeHeader(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const text = normalizeText(value);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function isSignedDocument(value: unknown): boolean {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return ['đã ký số', 'da ky so', 'signed', 'true', 'yes', '1', 'x'].some((marker) => normalized.includes(marker));
}

export function normalizeUnit(source: string, mappings: Pick<UnitMapping, 'sourceName' | 'normalizedName' | 'enabled'>[]): string {
  const clean = normalizeText(source);
  const key = comparisonKey(clean);
  if (/^ttt(?:\s|$)/i.test(clean) || /^ttt[._-]/i.test(clean)) return 'Trung tâm Thẻ';
  const builtIn = BUILT_IN_UNIT_MAPPINGS[key];
  if (builtIn) return builtIn;
  const match = mappings.find((mapping) => comparisonKey(mapping.sourceName) === key);
  return match ? normalizeText(match.normalizedName) : clean;
}

export function unitSuffixFromReference(referenceNumber: string): string | null {
  const parts = normalizeText(referenceNumber).split('-').map(normalizeText).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) || null : null;
}

/** Returns null when the NHNo suffix has no approved mapping, so it is omitted from the report. */
export function normalizeNhnoReferenceUnit(referenceNumber: string, mappings: Pick<UnitMapping, 'sourceName' | 'normalizedName' | 'enabled'>[]): string | null {
  const suffix = unitSuffixFromReference(referenceNumber);
  if (!suffix) return null;
  const key = comparisonKey(suffix);
  if (/^ttt(?: \d+)?$/.test(key)) return 'Trung tâm Thẻ';
  const builtIn = NHNO_REFERENCE_UNIT_MAPPINGS[key];
  if (builtIn) return builtIn;
  const mapping = mappings.find((item) => comparisonKey(item.sourceName) === key);
  return mapping ? normalizeText(mapping.normalizedName) : null;
}

export function normalizeDocument(row: RawExcelRow, mappings: Pick<UnitMapping, 'sourceName' | 'normalizedName' | 'enabled'>[]): NormalizedDocumentInput {
  const issuingUnit = normalizeText(row['Đơn vị ban hành']);
  return {
    summary: normalizeText(row['Trích yếu']),
    referenceNumber: normalizeText(row['Số ký hiệu']),
    signedDocument: normalizeText(row['Văn bản ký số']),
    issueDate: parseExcelDate(row['Ngày ban hành']),
    issuingUnit,
    normalizedUnit: normalizeUnit(issuingUnit, mappings),
    rawData: row
  };
}

export function missingRequiredHeaders(headers: unknown[]): string[] {
  const normalizedHeaders = headers.map(normalizeHeader);
  return REQUIRED_HEADERS.filter((header) => !normalizedHeaders.includes(normalizeHeader(header)));
}
