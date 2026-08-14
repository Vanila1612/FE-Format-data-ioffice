import * as XLSX from 'xlsx';
import type { DocumentGroup } from '../types/api';

export type LocalDocument = {
  stt: number;
  summary: string;
  referenceNumber: string;
  signedDocument: string;
  issueDate: string;
  issuingUnit: string;
  normalizedUnit: string;
  documentGroup: DocumentGroup;
  rawData: Record<string, unknown>;
};

export type LocalImportResult = {
  documents: LocalDocument[];
  missingColumns: string[];
  totals: {
    total: number;
    signed: number;
    unsigned: number;
    signRate: number;
  };
  period: {
    from: string;
    to: string;
  };
  boardRows: ResultBoardRow[];
};


export type ResultBoardRow = {
  stt: number;
  unit: string;
  reportSigned: number;
  reportTotal: number;
  reportRate: number;
  letterSigned: number;
  letterTotal: number;
  letterRate: number;
  workSigned: number;
  workTotal: number;
  workRate: number;
  totalSigned: number;
  totalDocuments: number;
  totalRate: number;
};

const unitNameMap: Record<string, string> = {
  'trụ sở chính': 'Trụ sở chính',
  'tru so chinh': 'Trụ sở chính',
  'trụ sở chính agribank': 'Trụ sở chính',
  'văn phòng trụ sở chính': 'Trụ sở chính',
  'ban khách hàng doanh nghiệp': 'Ban Khách hàng doanh nghiệp',
  'ban khach hang doanh nghiep': 'Ban Khách hàng doanh nghiệp',
  'ban khách hàng cá nhân': 'Ban Khách hàng cá nhân',
  'ban khach hang ca nhan': 'Ban Khách hàng cá nhân',
  'trung tâm công nghệ thông tin': 'TTCNTT',
  'ttcntt': 'TTCNTT',
  'qlđt': 'Ban Quản lý đầu tư nội ngành',
  'qldt': 'Ban Quản lý đầu tư nội ngành',
  'khcn': 'Ban Khách hàng cá nhân',
  'khdn': 'Ban Khách hàng Doanh Nghiệp',
  'ktgs': 'Ban Kiểm tra, giám sát nội bộ',
  'tckt': 'Ban Tài chính Kế toán',
  'tcns': 'Ban Tổ chức nhân sự',
  'pc': 'Ban Pháp chế',
  'nhs': 'Ban Ngân hàng số',
  'kdvtt': 'Trung tâm Kinh doanh Vốn và Tiền tệ',
  'th': 'Ban Thư ký Tổng hợp',
  'ttt': 'Trung tâm Thanh toán',
  'tttm': 'Trung Tâm Tài Trợ Thương Mại',
  'qlrrtd': 'Trung tâm QLRRTD',
  'qlncvđ': 'TRUNG TÂM QUẢN LÝ NỢ CVĐ',
  'qlncvd': 'TRUNG TÂM QUẢN LÝ NỢ CVĐ',
  'cskh': 'TRUNG TÂM CHĂM SÓC KHÁCH HÀNG',
  'đctc': 'Ban Định chế tài chính',
  'dctc': 'Ban Định chế tài chính'
};

const requiredUnitMap: Record<string, string> = {
  'ban kiem soat': 'Ban Kiểm soát',
  'dang uy agribank': 'Đảng ủy Agribank',
  'tru so chinh': 'Trụ sở chính',
  'tru so chinh agribank': 'Trụ sở chính',
  'van phong tru so chinh': 'Trụ sở chính',
  'cong doan co so trung tam the': 'Trung tâm Thẻ',
  'chi bo trung tam pcrt': 'Trung tâm Phòng, chống rửa tiền',
  'ttkh': 'Trung tâm Dịch vụ thanh toán và kiều hối',
  'phong tong hop': 'Trụ sở chính',
  'kiem toan noi bo ban kiem soat': 'Ban Kiểm soát'
};

const nhnoSuffixUnitMap: Record<string, string> = {
  'qldt': 'Ban Quản lý đầu tư nội ngành', 'ttkh': 'Trung tâm Dịch vụ thanh toán và kiều hối', 'alco': 'TRUNG TÂM QUẢN LÝ NỢ CVĐ',
  'khcn': 'Ban Khách hàng cá nhân', 'tkth': 'Ban Thư ký Tổng hợp', 'dtcph': 'Ban Đầu tư và Cổ phần hóa',
  'kdvtt': 'Trung tâm Kinh doanh Vốn và Tiền tệ', 'tttt': 'Trung tâm Thanh toán', 'vp': 'Trụ sở chính',
  'qlxd': 'Ban QL Dự án ĐTXD khu vực', 'th': 'Ban QL Dự án ĐTXD khu vực', 'tcns': 'Ban Tổ chức nhân sự',
  'cskh': 'TRUNG TÂM CHĂM SÓC KHÁCH HÀNG', 'rrtd': 'Trung tâm QLRRTD', 'cd': 'Cơ quan Công đoàn',
  'nhs': 'Ban Ngân hàng số', 'cn': 'Ban Công nghệ', 'dctc': 'Ban Định chế tài chính',
  'ktnb': 'Ban Kiểm tra, giám sát nội bộ', 'tdtcb': 'Trường ĐTCB', 'tttm': 'Trung Tâm Tài Trợ Thương Mại', 'bqle3': 'Ban QLE3'
};

const requiredHeaders = ['Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành'];

function clean(value: unknown) {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function comparisonKey(value: string) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeUnitName(value: unknown) {
  const text = clean(value);
  if (/^ttt(?:\s|$)/i.test(text) || /^ttt[._-]/i.test(text)) return 'Trung tâm Thẻ';
  const required = requiredUnitMap[comparisonKey(text)];
  if (required) return required;
  const key = text.toLowerCase();
  return unitNameMap[key] || text;
}

function headerKey(value: unknown) {
  return clean(value).toLowerCase();
}

function missingColumns(headers: string[]) {
  const available = headers.map(headerKey);
  return requiredHeaders.filter((header) => !available.includes(headerKey(header)));
}

function formatExcelDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = clean(value);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return text;
}

function rate(signed: number, total: number) {
  return total ? Number(((signed / total) * 100).toFixed(1)) : 0;
}

function isSigned(value: unknown) {
  const text = clean(value).toLowerCase();
  return ['đã ký số', 'da ky so', 'signed', 'true', 'yes', '1', 'x'].some((marker) => text.includes(marker));
}

function hasToken(referenceNumber: string, keyword: string) {
  if (/^(BC|TTr)$/i.test(keyword)) return new RegExp(`(^|[^a-zA-ZÀ-ỹ])${keyword}`, 'iu').test(clean(referenceNumber));
  return clean(referenceNumber).toLowerCase().includes(keyword.toLowerCase());
}

function isNhnoUnit(unit: string) {
  const key = comparisonKey(unit);
  return ['nhno', 'nhno lh', 'ngan hang nong nghiep va phat trien nong thon viet nam'].includes(key);
}

function normalizeNhnoSuffix(referenceNumber: string) {
  const parts = clean(referenceNumber).split('-').map(clean).filter(Boolean);
  const suffix = parts.length > 1 ? parts.at(-1) || '' : '';
  const key = comparisonKey(suffix);
  if (/^ttt(?: \d+)?$/.test(key)) return 'Trung tâm Thẻ';
  return nhnoSuffixUnitMap[key] || '';
}

function classify(referenceNumber: string, issuingUnit: string): { group: DocumentGroup; normalizedUnit?: string } {
  if (isNhnoUnit(issuingUnit)) {
    return { group: 'LETTER_AUTHORIZATION', normalizedUnit: normalizeNhnoSuffix(referenceNumber) };
  }
  if (hasToken(referenceNumber, 'BC') || hasToken(referenceNumber, 'TTr')) return { group: 'REPORT_PROPOSAL' };
  if (hasToken(referenceNumber, 'CV') || hasToken(referenceNumber, 'UQ')) return { group: 'LETTER_AUTHORIZATION' };
  return { group: 'WORK_LETTER' };
}

export async function parseLocalExcel(file: File): Promise<LocalImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Excel không có sheet dữ liệu.');

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
  const headerIndex = matrix.findIndex((row) => missingColumns(row.map(clean)).length === 0);
  if (headerIndex < 0) {
    const candidate = matrix.find((row) => row.some((cell) => clean(cell)))?.map(clean) || [];
    return {
      documents: [],
      missingColumns: missingColumns(candidate),
      totals: { total: 0, signed: 0, unsigned: 0, signRate: 0 },
      period: { from: '', to: '' },
      boardRows: []
    };
  }

  const headers = matrix[headerIndex].map(clean);
  const sttIndex = headers.findIndex((header) => headerKey(header) === 'stt');
  const documents = matrix.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => clean(cell)))
    .filter((row) => sttIndex < 0 || Number.isFinite(Number(row[sttIndex])))
    .map((row, index) => {
      const rawData = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex]]));
      const summary = clean(rawData['Trích yếu']);
      const referenceNumber = clean(rawData['Số ký hiệu']);
      const signedDocument = clean(rawData['Văn bản ký số']);
      const issuingUnit = clean(rawData['Đơn vị ban hành']);
      const classified = classify(referenceNumber, issuingUnit);
      return {
        stt: index + 1,
        summary,
        referenceNumber,
        signedDocument,
        issueDate: formatExcelDate(rawData['Ngày ban hành']),
        issuingUnit,
        normalizedUnit: classified.normalizedUnit ?? normalizeUnitName(issuingUnit),
        documentGroup: classified.group,
        rawData
      };
    });

  const reportableDocuments = documents.filter((document) => document.normalizedUnit || !isNhnoUnit(document.issuingUnit));
  const signed = reportableDocuments.filter((document) => isSigned(document.signedDocument)).length;
  const total = reportableDocuments.length;
  const dates = reportableDocuments.map((document) => document.issueDate).filter(Boolean).sort();
  return {
    documents,
    missingColumns: [],
    totals: {
      total,
      signed,
      unsigned: total - signed,
      signRate: total ? Number(((signed / total) * 100).toFixed(1)) : 0
    },
    period: {
      from: dates[0] || '',
      to: dates.at(-1) || ''
    },
    boardRows: buildResultBoard(reportableDocuments)
  };
}


export function buildResultBoard(documents: LocalDocument[]): ResultBoardRow[] {
  const rows = new Map<string, Omit<ResultBoardRow, 'stt' | 'reportRate' | 'letterRate' | 'workRate' | 'totalRate'>>();
  for (const document of documents) {
    const unit = document.normalizedUnit || document.issuingUnit || 'Không rõ';
    if (!rows.has(unit)) {
      rows.set(unit, {
        unit,
        reportSigned: 0,
        reportTotal: 0,
        letterSigned: 0,
        letterTotal: 0,
        workSigned: 0,
        workTotal: 0,
        totalSigned: 0,
        totalDocuments: 0
      });
    }
    const row = rows.get(unit)!;
    const signed = isSigned(document.signedDocument);
    if (document.documentGroup === 'REPORT_PROPOSAL') {
      row.reportTotal += 1;
      if (signed) row.reportSigned += 1;
    } else if (document.documentGroup === 'LETTER_AUTHORIZATION') {
      row.letterTotal += 1;
      if (signed) row.letterSigned += 1;
    } else {
      row.workTotal += 1;
      if (signed) row.workSigned += 1;
    }
    row.totalDocuments += 1;
    if (signed) row.totalSigned += 1;
  }

  return [...rows.values()]
    .sort((a, b) => b.totalDocuments - a.totalDocuments || a.unit.localeCompare(b.unit, 'vi'))
    .map((row, index) => ({
      stt: index + 1,
      ...row,
      reportRate: rate(row.reportSigned, row.reportTotal),
      letterRate: rate(row.letterSigned, row.letterTotal),
      workRate: rate(row.workSigned, row.workTotal),
      totalRate: rate(row.totalSigned, row.totalDocuments)
    }));
}
