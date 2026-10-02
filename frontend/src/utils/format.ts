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

// NFD + strip combining marks so 'Nguyễn' and 'Nguyen' compare equal.
// Collapses whitespace so accidental double spaces from import don't break the match.
export function foldText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
