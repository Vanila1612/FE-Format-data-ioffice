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

export type StoredLocalImport = LocalImportResult & {
  fileName: string;
  importedAt: string;
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

const localImportStorageKey = 'ioffice.localImport';
const unitNameMap: Record<string, string> = {
  'trụ sở chính': 'Trụ sở chính',
  'tru so chinh': 'Trụ sở chính',
  'trụ sở chính agribank': 'Trụ sở chính',
  'văn phòng trụ sở chính': 'Trụ sở chính',
  'ban khách hàng doanh nghiệp': 'Ban Khách hàng Doanh Nghiệp',
  'ban khach hang doanh nghiep': 'Ban Khách hàng Doanh Nghiệp',
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

const requiredHeaders = ['Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành'];

function clean(value: unknown) {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function normalizeUnitName(value: unknown) {
  const text = clean(value);
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
  const parts = clean(referenceNumber).split(/[^0-9a-zA-ZÀ-ỹ]+/u).map((part) => part.toLowerCase());
  return parts.includes(keyword.toLowerCase());
}

function isAgribankUnit(unit: string) {
  const text = clean(unit).toLowerCase();
  return text.includes('nhno') ||
    text.includes('agribank') ||
    text.includes('ngân hàng nông nghiệp và phát triển nông thôn việt nam') ||
    text.includes('ngan hang nong nghiep va phat trien nong thon viet nam');
}

function unitFromReference(referenceNumber: string) {
  const parts = clean(referenceNumber).split('-').map(clean).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) || '' : '';
}

function classify(referenceNumber: string, issuingUnit: string): { group: DocumentGroup; unitOverride?: string } {
  if (isAgribankUnit(issuingUnit)) {
    return { group: 'LETTER_AUTHORIZATION', unitOverride: normalizeUnitName(unitFromReference(referenceNumber) || 'Trụ sở chính') };
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
  const documents = matrix.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => clean(cell)))
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
        normalizedUnit: classified.unitOverride || normalizeUnitName(issuingUnit),
        documentGroup: classified.group,
        rawData
      };
    });

  const signed = documents.filter((document) => isSigned(document.signedDocument)).length;
  const total = documents.length;
  const dates = documents.map((document) => document.issueDate).filter(Boolean).sort();
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
    boardRows: buildResultBoard(documents)
  };
}

export function saveLocalImport(fileName: string, result: LocalImportResult) {
  const stored: StoredLocalImport = {
    ...result,
    fileName,
    importedAt: new Date().toISOString()
  };
  localStorage.setItem(localImportStorageKey, JSON.stringify(stored));
}

export function loadLocalImport(): StoredLocalImport | null {
  const raw = localStorage.getItem(localImportStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredLocalImport;
  } catch {
    localStorage.removeItem(localImportStorageKey);
    return null;
  }
}

export function clearLocalImport() {
  localStorage.removeItem(localImportStorageKey);
}

export function localDocumentsByUnit(documents: LocalDocument[]) {
  const units = new Map<string, { unit: string; total: number; signed: number; unsigned: number; signRate: number }>();
  for (const document of documents) {
    const unit = document.normalizedUnit || document.issuingUnit || 'Không rõ';
    if (!units.has(unit)) units.set(unit, { unit, total: 0, signed: 0, unsigned: 0, signRate: 0 });
    const row = units.get(unit)!;
    row.total += 1;
    if (isSigned(document.signedDocument)) row.signed += 1;
  }
  return [...units.values()].map((row) => ({
    ...row,
    unsigned: row.total - row.signed,
    signRate: row.total ? Number(((row.signed / row.total) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);
}

export function localDocumentsByGroup(documents: LocalDocument[]) {
  return documents.reduce<Record<DocumentGroup, number>>((acc, document) => {
    acc[document.documentGroup] += 1;
    return acc;
  }, { REPORT_PROPOSAL: 0, LETTER_AUTHORIZATION: 0, WORK_LETTER: 0 });
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
