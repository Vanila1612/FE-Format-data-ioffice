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
  signerName: string;
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
  // The input workbook uses both the abbreviation and the full official name.
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

// Mã ở cuối số ký hiệu của văn bản NHNo. Danh mục này được đối chiếu với
// workbook rà soát thủ công đã được xác nhận là kết quả chuẩn.
const NHNO_REFERENCE_UNIT_MAPPINGS: Record<string, string> = {
  'qldt': 'Ban Quản lý đầu tư nội ngành',
  'ttkh': 'TTDV TT&KH',
  'alco': 'Trung tâm quản lý nợ có vấn đề',
  'khcn': 'Ban Khách hàng cá nhân',
  'tkth': 'Ban Thư ký tổng hợp',
  'dtcph': 'Ban Đầu tư và Cổ phần hóa',
  'kdvtt': 'Trung tâm Kinh doanh Vốn và Tiền tệ',
  'tttt': 'Trung tâm Thanh toán',
  'vp': 'Văn phòng TSC',
  'qlxd': 'Ban QLDA ĐTXDKV',
  'th': 'Ban QLDA ĐTXDKV',
  'tcns': 'Ban Tổ chức nhân sự',
  'cskh': 'Chăm sóc khách hàng',
  'rrtd': 'Trung tâm Quản lý rủi ro tín dụng',
  'cd': 'Văn Phòng Công đoàn',
  'nhs': 'Ban Ngân hàng số',
  'cn': 'Ban Công nghệ',
  'dctc': 'Ban Định chế tài chính',
  'ktnb': 'Ban Kiểm tra, giám sát nội bộ',
  'tdtcb': 'Trường đào tạo cán bộ',
  'tttm': 'Trung tâm Tài trợ Thương Mại',
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

/** Reads the "Người ký chính" column whether the workbook uses the legacy uppercase
 *  header (`NGUOI_KY_CHINH`) or the new Vietnamese label. Missing values resolve
 *  to an empty string so existing imports keep working. */
function readSignerName(row: RawExcelRow): string {
  const direct = row['Người ký chính'] ?? row['NGUOI_KY_CHINH'];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return normalizeText(direct);
  for (const [key, value] of Object.entries(row)) {
    if (!key) continue;
    const normalized = normalizeHeader(key);
    if (normalized === 'nguoi_ky_chinh' || normalized === 'nguoi ky chinh' || normalized === 'người ký chính') {
      return normalizeText(value);
    }
  }
  return '';
}

export function normalizeDocument(row: RawExcelRow, mappings: Pick<UnitMapping, 'sourceName' | 'normalizedName' | 'enabled'>[]): NormalizedDocumentInput {
  const issuingUnit = normalizeText(row['Đơn vị ban hành']);
  return {
    summary: normalizeText(row['Trích yếu']),
    referenceNumber: normalizeText(row['Số ký hiệu']),
    signedDocument: normalizeText(row['Văn bản ký số']),
    signerName: readSignerName(row),
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
