import { expect, test } from 'vitest';
import { filterResultBoardRows, isBranchUnit } from '../utils/unitScope';

test('nhận diện chi nhánh bằng danh sách đơn vị trụ sở chính', () => {
  for (const unit of ['Chi nhánh Sở Giao dịch', 'Agribank chi nhanh gia lai', 'Sở Giao dịch', 'Agribank Láng Hạ'])
    expect(isBranchUnit(unit)).toBe(true);
  for (const unit of ['Ban Pháp chế', 'ban phap che', 'TTCNTT', 'Trung tam the', 'Văn phòng đại diện Miền Trung', 'Ban thư ký HDTV'])
    expect(isBranchUnit(unit)).toBe(false);
  for (const unit of ['Trung tâm Kinh doanh Vốn và Tiền tệ', 'Ban QLE3'])
    expect(isBranchUnit(unit)).toBe(false);
});

test('lọc đơn vị hỗ trợ tìm kiếm không dấu', () => {
  const rows = [
    boardRow('Ban Pháp Chế'),
    boardRow('Chi nhánh Sở Giao dịch')
  ];

  expect(filterResultBoardRows(rows, 'phap che', 'ALL').map((row) => row.unit)).toEqual(['Ban Pháp Chế']);
  expect(filterResultBoardRows(rows, '', 'CENTRAL').map((row) => row.unit)).toEqual(['Ban Pháp Chế']);
  expect(filterResultBoardRows(rows, '', 'BRANCH').map((row) => row.unit)).toEqual(['Chi nhánh Sở Giao dịch']);
});

test('lọc 5 đơn vị Trụ sở chính ký số nhiều nhất và không chứa chi nhánh', () => {
  const units = [
    { unit: 'PerfTest', total: 7631, signed: 0 },
    { unit: 'Văn phòng TSC', total: 5677, signed: 951 },
    { unit: 'Chi nhánh Sở Giao dịch', total: 3831, signed: 0 },
    { unit: 'Ban Khách hàng cá nhân', total: 2823, signed: 392 },
    { unit: 'Agribank chi nhánh Thái Bình', total: 2541, signed: 56 },
    { unit: 'Trung tâm quản lý dữ liệu', total: 2467, signed: 612 },
    { unit: 'Ban Pháp Chế', total: 2296, signed: 743 },
    { unit: 'Ban Khách hàng Doanh nghiệp', total: 2073, signed: 1353 },
    { unit: 'Trung tâm Công nghệ thông tin', total: 1590, signed: 646 }
  ];

  const top5Central = units
    .filter((row) => !isBranchUnit(row.unit))
    .sort((a, b) => b.signed - a.signed)
    .slice(0, 5);

  expect(top5Central.map((u) => u.unit)).toEqual([
    'Ban Khách hàng Doanh nghiệp',
    'Văn phòng TSC',
    'Ban Pháp Chế',
    'Trung tâm Công nghệ thông tin',
    'Trung tâm quản lý dữ liệu'
  ]);
  expect(top5Central.map((u) => u.signed)).toEqual([1353, 951, 743, 646, 612]);
});

function boardRow(unit: string) {
  return {
    stt: 1,
    unit,
    reportSigned: 0,
    reportTotal: 0,
    reportRate: 0,
    letterSigned: 0,
    letterTotal: 0,
    letterRate: 0,
    workSigned: 0,
    workTotal: 0,
    workRate: 0,
    totalSigned: 0,
    totalDocuments: 0,
    totalRate: 0
  };
}
