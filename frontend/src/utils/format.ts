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

export function getMonthDateRange(monthKey: string): { from: string; to: string } {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return { from: '', to: '' };
  }
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
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
