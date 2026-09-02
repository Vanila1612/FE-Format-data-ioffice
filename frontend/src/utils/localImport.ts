import * as XLSX from 'xlsx';
import type { DocumentGroup } from '../types/api';

export type LocalDocument = {
  stt: number;
  summary: string;
  referenceNumber: string;
  signedDocument: string;
  signerName: string;
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
  signerBoardRows: SignerBoardRow[];
};

export type SignerBoardRow = {
  stt: number;
  signer: string;
  totalDocuments: number;
  signed: number;
  signRate: number;
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
  'ban kiem soat': 'Ban Kiểm soát Agribank',
  'ban kiem soat agribank': 'Ban Kiểm soát Agribank',
  'bks': 'Ban Kiểm soát Agribank',
  'dang uy agribank': 'Tổ chức Đảng Ủy',
  'dang uy': 'Tổ chức Đảng Ủy',
  'to chuc dang uy': 'Tổ chức Đảng Ủy',
  'ban to chuc dang uy': 'Tổ chức Đảng Ủy',
  'van phong dang uy': 'Tổ chức Đảng Ủy',
  'du co quan uy ban kiem tra dang uy': 'Tổ chức Đảng Ủy',
  'tru so chinh': 'Văn phòng TSC',
  'tru so chinh agribank': 'Văn phòng TSC',
  'van phong tru so chinh': 'Văn phòng TSC',
  'vp tsc': 'Văn phòng TSC',
  'vptsc': 'Văn phòng TSC',
  'cong doan co so trung tam the': 'Trung tâm Thẻ',
  'chi bo trung tam pcrt': 'Trung tâm Phòng, chống rửa tiền',
  'ttkh': 'TTDV TT&KH',
  'ttdv tt kh': 'TTDV TT&KH',
  'ttdv ttkh': 'TTDV TT&KH',
  'trung tam dich vu thanh toan va kieu hoi': 'TTDV TT&KH',
  'phong tong hop': 'Văn phòng TSC',
  'kiem toan noi bo ban kiem soat': 'Ban Kiểm soát Agribank',
  'ttcntt': 'Trung tâm Công nghệ thông tin',
  'tt cntt': 'Trung tâm Công nghệ thông tin',
  'cntt': 'Trung tâm Công nghệ thông tin',
  'trung tam cong nghe thong tin': 'Trung tâm Công nghệ thông tin',
  'ttt': 'Trung tâm Thẻ',
  'tt the': 'Trung tâm Thẻ',
  'trung tam the': 'Trung tâm Thẻ',
  'tdtcb': 'Trường đào tạo cán bộ',
  'truong dtcb': 'Trường đào tạo cán bộ',
  'truong dao tao can bo': 'Trường đào tạo cán bộ',
  'ban thu ky hdtv': 'Ban Thư ký Hội đồng thành viên',
  'thu ky hdtv': 'Ban Thư ký Hội đồng thành viên',
  'tk hdtv': 'Ban Thư ký Hội đồng thành viên',
  'ban thu ky hoi dong thanh vien': 'Ban Thư ký Hội đồng thành viên',
  'ub qlrr': 'Ủy ban quản lý rủi ro Agribank',
  'uy ban qlrr': 'Ủy ban quản lý rủi ro Agribank',
  'uy ban quan ly rui ro': 'Ủy ban quản lý rủi ro Agribank',
  'ub chinh sach': 'Ủy ban Chính sách',
  'uy ban cs': 'Ủy ban Chính sách',
  'pc': 'Ban Pháp Chế',
  'ban phap che': 'Ban Pháp Chế',
  'tkth': 'Ban Thư ký tổng hợp',
  'ban tkth': 'Ban Thư ký tổng hợp',
  'th': 'Ban Thư ký tổng hợp',
  'ban thu ky tong hop': 'Ban Thư ký tổng hợp',
  'ban tham dinh va phe duyet tin dung': 'Ban Thẩm định và phê duyệt tín dụng',
  'ban tham dinh phe duyet tin dung': 'Ban Thẩm định và phê duyệt tín dụng',
  'td pdtd': 'Ban Thẩm định và phê duyệt tín dụng',
  'ktgs': 'Ban Kiểm tra, giám sát nội bộ',
  'ktgsnb': 'Ban Kiểm tra, giám sát nội bộ',
  'ktnb': 'Ban Kiểm tra, giám sát nội bộ',
  'qldt': 'Ban Quản lý đầu tư nội ngành',
  'ql dau tu noi nganh': 'Ban Quản lý đầu tư nội ngành',
  'khcl': 'Ban Kế hoạch chiến lược',
  'ban khcl': 'Ban Kế hoạch chiến lược',
  'dctc': 'Ban Định chế tài chính',
  'dtcph': 'Ban Đầu tư và Cổ phần hóa',
  'tttt': 'Trung tâm Thanh toán',
  'tt thanh toan': 'Trung tâm Thanh toán',
  'chi bo tttt': 'Trung tâm Thanh toán',
  'ttv': 'Trung tâm vốn',
  'trung tam von': 'Trung tâm vốn',
  'tckt': 'Ban Tài chính kế toán',
  'vpcd': 'Văn Phòng Công đoàn',
  'van phong cong doan': 'Văn Phòng Công đoàn',
  'co quan cong doan': 'Văn Phòng Công đoàn',
  'ban qlda dtxdkv': 'Ban QLDA ĐTXDKV',
  'qlda dtxdkv': 'Ban QLDA ĐTXDKV',
  'ban quan ly du an dau tu xay dung khu vuc': 'Ban QLDA ĐTXDKV',
  'ubdt': 'Uỷ ban đầu tư',
  'uy ban dau tu': 'Uỷ ban đầu tư',
  'qlncvd': 'Trung tâm quản lý nợ có vấn đề',
  'trung tam qlncvd': 'Trung tâm quản lý nợ có vấn đề',
  'qlrrtd': 'Trung tâm Quản lý rủi ro tín dụng',
  'trung tam qlrrtd': 'Trung tâm Quản lý rủi ro tín dụng',
  'cstd': 'Ban Chính sách tín dụng',
  'khcn': 'Ban Khách hàng cá nhân',
  'khdn': 'Ban Khách hàng Doanh nghiệp',
  'ban khach hang doanh nghiep': 'Ban Khách hàng Doanh nghiệp',
  'cn': 'Ban Công nghệ',
  'ban cong nghe': 'Ban Công nghệ',
  'ban alco': 'Ban Quản lý Tài sản Nợ - Tài sản Có',
  'ban quan ly ts no ts co': 'Ban Quản lý Tài sản Nợ - Tài sản Có',
  'qltsn tsc': 'Ban Quản lý Tài sản Nợ - Tài sản Có',
  'tttm': 'Trung tâm Tài trợ Thương Mại',
  'trung tam tai tro thuong mai': 'Trung tâm Tài trợ Thương Mại',
  'tai tro thuong mai': 'Trung tâm Tài trợ Thương Mại',
  'pdtd hcm': 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh',
  'pdtd tphcm': 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh',
  'ttpd': 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh',
  'trung tam phe duyet tin dung tai thanh pho hcm': 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh',
  'trung tam phe duyet tin dung tai tp hcm': 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh',
  'ubns': 'Ủy ban Nhân sự',
  'uy ban nhan su': 'Ủy ban Nhân sự',
  'pcrt': 'Trung tâm Phòng, Chống rửa tiền',
  'trung tam pcrt': 'Trung tâm Phòng, Chống rửa tiền',
  'cq doan thanh nien': 'Cơ quan Đoàn Thanh niên',
  'doan thanh nien': 'Cơ quan Đoàn Thanh niên',
  'ban qlda dtxd tsc': 'Ban Quản lý dự án ĐTXD TSC',
  'qlda dtxd tsc': 'Ban Quản lý dự án ĐTXD TSC',
  'ttdl': 'Trung tâm quản lý dữ liệu',
  'trung tam qldl': 'Trung tâm quản lý dữ liệu',
  'trung tam quan ly du lieu': 'Trung tâm quản lý dữ liệu',
  'vpdd mien trung': 'Văn phòng đại diện Khu vực miền Trung',
  'vpdd kv mien trung': 'Văn phòng đại diện Khu vực miền Trung',
  'van phong dai dien mien trung': 'Văn phòng đại diện Khu vực miền Trung',
  'vpdd mien nam': 'Văn phòng đại diện Khu vực Miền Nam',
  'van phong dai dien mien nam': 'Văn phòng đại diện Khu vực Miền Nam',
  'dang uy van phong dai dien mien nam': 'Văn phòng đại diện Khu vực Miền Nam',
  'vpdd tay nam bo': 'Văn phòng đại diện khu vực Tây Nam Bộ',
  'van phong dai dien tay nam bo': 'Văn phòng đại diện khu vực Tây Nam Bộ',
  'qlrrptd': 'Trung tâm Quản lý rủi ro phi tín dụng',
  'trung tam qlrr phi tin dung': 'Trung tâm Quản lý rủi ro phi tín dụng',
  'trung tam quan ly rui ro phi tin dung': 'Trung tâm Quản lý rủi ro phi tín dụng',
  'tcns': 'Ban Tổ chức nhân sự',
  'cskh': 'Chăm sóc khách hàng',
  'trung tam cskh': 'Chăm sóc khách hàng',
  'nhs': 'Ban Ngân hàng số'
};

const nhnoSuffixUnitMap: Record<string, string> = {
  'qldt': 'Ban Quản lý đầu tư nội ngành', 'ttkh': 'TTDV TT&KH', 'alco': 'Trung tâm quản lý nợ có vấn đề',
  'khcn': 'Ban Khách hàng cá nhân', 'tkth': 'Ban Thư ký tổng hợp', 'dtcph': 'Ban Đầu tư và Cổ phần hóa',
  'kdvtt': 'Trung tâm Kinh doanh Vốn và Tiền tệ', 'tttt': 'Trung tâm Thanh toán', 'vp': 'Văn phòng TSC',
  'qlxd': 'Ban QLDA ĐTXDKV', 'th': 'Ban QLDA ĐTXDKV', 'tcns': 'Ban Tổ chức nhân sự',
  'cskh': 'Chăm sóc khách hàng', 'rrtd': 'Trung tâm Quản lý rủi ro tín dụng', 'cd': 'Văn Phòng Công đoàn',
  'nhs': 'Ban Ngân hàng số', 'cn': 'Ban Công nghệ', 'dctc': 'Ban Định chế tài chính',
  'ktnb': 'Ban Kiểm tra, giám sát nội bộ', 'tdtcb': 'Trường đào tạo cán bộ', 'tttm': 'Trung tâm Tài trợ Thương Mại', 'bqle3': 'Ban QLE3'
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
      boardRows: [],
      signerBoardRows: []
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
      const signerName = clean(rawData['Người ký chính'] ?? rawData['NGUOI_KY_CHINH'] ?? '');
      const issuingUnit = clean(rawData['Đơn vị ban hành']);
      const classified = classify(referenceNumber, issuingUnit);
      return {
        stt: index + 1,
        summary,
        referenceNumber,
        signedDocument,
        signerName,
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
    boardRows: buildResultBoard(reportableDocuments),
    signerBoardRows: buildSignerBoard(reportableDocuments)
  };
}

export function buildSignerBoard(documents: LocalDocument[]): SignerBoardRow[] {
  const map = new Map<string, { signer: string; totalDocuments: number; signed: number }>();
  for (const document of documents) {
    const name = (document.signerName || '').trim();
    if (!name) continue;
    if (!map.has(name)) map.set(name, { signer: name, totalDocuments: 0, signed: 0 });
    const row = map.get(name)!;
    row.totalDocuments += 1;
    if (isSigned(document.signedDocument)) row.signed += 1;
  }
  return [...map.values()]
    .sort((a, b) => b.totalDocuments - a.totalDocuments || a.signer.localeCompare(b.signer, 'vi'))
    .map((row, index) => ({
      stt: index + 1,
      ...row,
      signRate: row.totalDocuments ? Number(((row.signed / row.totalDocuments) * 100).toFixed(1)) : 0
    }));
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
