import { expect, test } from 'vitest';
import { isBranchUnit } from './ImportPage';

test('nhận diện chi nhánh theo tên đơn vị', () => {
  for (const unit of ['Chi nhánh Sở Giao dịch', 'Agribank chi nhanh gia lai', 'Agribank CN Bắc Yên Bái'])
    expect(isBranchUnit(unit)).toBe(true);
  for (const unit of ['Ban Pháp chế', 'Trung tâm Kinh doanh Vốn và Tiền tệ', 'Văn phòng đại diện Miền Trung'])
    expect(isBranchUnit(unit)).toBe(false);
});
