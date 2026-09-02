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
