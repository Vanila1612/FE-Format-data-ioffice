import type { ResultBoardRow } from '../types/api';

export type UnitScope = 'ALL' | 'CENTRAL' | 'BRANCH';

const CENTRAL_OFFICE_UNITS = [
  'Văn phòng đại diện khu vực Tây Nam Bộ',
  'Trung tâm Công nghệ thông tin',
  'Trung tâm thẻ',
  'Trường đào tạo cán bộ',
  'Ban Thư ký Hội đồng thành viên',
  'Tổ chức Đảng Ủy',
  'Ủy ban quản lý rủi ro Agribank',
  'Ủy ban Chính sách',
  'Ban Kiểm soát Agribank',
  'Ban Pháp Chế',
  'Ban Thư ký tổng hợp',
  'Ban Thẩm định và phê duyệt tín dụng',
  'Ban Kiểm tra, giám sát nội bộ',
  'Ban Quản lý đầu tư nội ngành',
  'Ban Kế hoạch chiến lược',
  'Ban Định chế tài chính',
  'Ban Đầu tư và Cổ phần hóa',
  'Ban Truyền thông',
  'Trung Tâm thanh toán',
  'Trung tâm vốn',
  'Trung tâm Kinh doanh Vốn và Tiền tệ',
  'TTDV TT&KH',
  'Ban Tài chính kế toán',
  'Văn Phòng Công đoàn',
  'Ban QLDA ĐTXDKV',
  'Văn phòng TSC',
  'Uỷ ban đầu tư',
  'Trung tâm quản lý nợ có vấn đề',
  'Trung tâm Quản lý rủi ro tín dụng',
  'Ban Chính sách tín dụng',
  'Ban Khách hàng cá nhân',
  'Ban Khách hàng doanh nghiệp',
  'Ban Công nghệ',
  'Ban Quản lý Tài sản Nợ - Tài sản Có',
  'Trung tâm Tài trợ Thương Mại',
  'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh',
  'Ủy ban Nhân sự',
  'Trung tâm Phòng, Chống rửa tiền',
  'Cơ quan Đoàn Thanh niên',
  'Ban Quản lý dự án ĐTXD TSC',
  'Trung tâm quản lý dữ liệu',
  'Văn phòng đại diện Khu vực miền Trung',
  'Văn phòng đại diện Khu vực Miền Nam',
  'Trung tâm Quản lý rủi ro phi tín dụng',
  'Ban Tổ chức nhân sự',
  'Chăm sóc khách hàng',
  'Ban Ngân hàng số',
  'Ban QLE3'
];

const CENTRAL_OFFICE_ALIASES = [
  'vpdd tay nam bo',
  'vp dai dien tay nam bo',
  'van phong dai dien tay nam bo',
  'vpdd mien trung',
  'vpdd khu vuc mien trung',
  'vpdd kv mien trung',
  'van phong dai dien mien trung',
  'vpdd mien nam',
  'vpdd khu vuc mien nam',
  'van phong dai dien mien nam',
  'vp tsc',
  'van phong tru so chinh',
  'tsc',
  'tru so chinh',
  'tru so chinh agribank',
  'ttcntt',
  'tt cntt',
  'cntt',
  'tt cong nghe thong tin',
  'tt the',
  'ttt',
  'truong dtcb',
  'truong dao tao cb',
  'truong dao tao can bo',
  'tdtcb',
  'ban thu ky hdtv',
  'ban thu ky hđtv',
  'thu ky hdtv',
  'thu ky hđtv',
  'tk hdtv',
  'tk hđtv',
  'dang uy',
  'to chuc dang uy',
  'ban to chuc dang uy',
  'van phong dang uy',
  'du co quan uy ban kiem tra dang uy',
  'ub qlrr',
  'ub quan ly rui ro',
  'uy ban qlrr',
  'uy ban quan ly rui ro',
  'ub chinh sach',
  'uy ban cs',
  'bks',
  'ban kiem soat',
  'kiem toan noi bo ban kiem soat',
  'pc',
  'phap che',
  'tkth',
  'th',
  'ban tkth',
  'ban thu ky tong hop',
  'td pdtd',
  'td va pdtd',
  'tham dinh phe duyet tin dung',
  'tham dinh va phe duyet tin dung',
  'ktgs',
  'ktgsnb',
  'kiem tra giam sat noi bo',
  'qlđt',
  'qldt',
  'ql dtnn',
  'ql dau tu noi nganh',
  'khcl',
  'ban khcl',
  'ke hoach chien luoc',
  'dctc',
  'đctc',
  'dinh che tai chinh',
  'dtcph',
  'dau tu co phan hoa',
  'truyen thong',
  'tttt',
  'tt thanh toan',
  'chi bo tttt',
  'ttv',
  'trung tam von',
  'kdvtt',
  'kinh doanh von va tien te',
  'ttdv tt kh',
  'ttdv ttkh',
  'ttkh',
  'trung tam dich vu thanh toan va kieu hoi',
  'tckt',
  'tai chinh ke toan',
  'vpcd',
  'van phong cong doan',
  'co quan cong doan',
  'ban qlda dtxdkv',
  'ban qlda dtxd kv',
  'qlda dtxdkv',
  'ban quan ly du an dau tu xay dung khu vuc',
  'ubdt',
  'uy ban dau tu',
  'qlncvd',
  'qlncvđ',
  'ql no co van de',
  'qlrrtd',
  'ql rui ro tin dung',
  'cstd',
  'chinh sach tin dung',
  'khcn',
  'khdn',
  'cong nghe',
  'ql tsn tsc',
  'ban quan ly ts no ts co',
  'quan ly tai san no tai san co',
  'tttm',
  'tai tro thuong mai',
  'pdtd hcm',
  'pdtd tphcm',
  'ttpd',
  'trung tam phe duyet tin dung tai thanh pho hcm',
  'phe duyet tin dung hcm',
  'phe duyet tin dung thanh pho ho chi minh',
  'ubns',
  'uy ban nhan su',
  'pcrt',
  'phong chong rua tien',
  'cq doan thanh nien',
  'co quan doan thanh nien',
  'doan thanh nien',
  'ban ql du an dtxd tsc',
  'qlda dtxd tsc',
  'ttdl',
  'trung tam ql du lieu',
  'trung tam quan ly du lieu',
  'qlrrptd',
  'ql rui ro phi tin dung',
  'tcns',
  'to chuc nhan su',
  'cskh',
  'cham soc khach hang',
  'nhs',
  'ngan hang so',
  'bqle3'
];

export function unitKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/&/g, ' va ')
    .replace(/\bhdtv\b/g, 'hoi dong thanh vien')
    .replace(/\bhđtv\b/g, 'hoi dong thanh vien')
    .replace(/\btp\.?\b/g, ' thanh pho ')
    .replace(/\bcvd\b/g, ' co van de ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CENTRAL_OFFICE_KEYS = new Set([...CENTRAL_OFFICE_UNITS, ...CENTRAL_OFFICE_ALIASES].map(unitKey));

export function isCentralOfficeUnit(unit: string) {
  const key = unitKey(unit);
  return Boolean(key) && CENTRAL_OFFICE_KEYS.has(key);
}

export function isBranchUnit(unit: string) {
  const key = unitKey(unit);
  return Boolean(key) && !CENTRAL_OFFICE_KEYS.has(key);
}

export function filterResultBoardRows(rows: ResultBoardRow[], search: string, scope: UnitScope) {
  const needle = unitKey(search);
  return rows.filter((row) => {
    if (needle && !unitKey(row.unit).includes(needle)) return false;
    if (scope === 'ALL') return true;
    if (scope === 'CENTRAL') return isCentralOfficeUnit(row.unit);
    return isBranchUnit(row.unit);
  });
}

export function totalsFromBoardRows(rows: ResultBoardRow[]) {
  const total = rows.reduce((sum, row) => sum + row.totalDocuments, 0);
  const signed = rows.reduce((sum, row) => sum + row.totalSigned, 0);
  return {
    total,
    signed,
    unsigned: total - signed,
    signRate: total ? Number(((signed / total) * 100).toFixed(1)) : 0
  };
}
