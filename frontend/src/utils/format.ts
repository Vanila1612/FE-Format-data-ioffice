import type { DocumentGroup } from '../types/api';

export const groupLabels: Record<DocumentGroup, string> = {
  REPORT_PROPOSAL: 'Báo cáo / Tờ trình',
  LETTER_AUTHORIZATION: 'Công văn / Ủy quyền',
  WORK_LETTER: 'Thư công tác'
};

export function numberText(value: number | undefined) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

export function dateText(value?: string | null) {
  return value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '-';
}
