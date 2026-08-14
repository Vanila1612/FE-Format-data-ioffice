export const DocumentGroup = {
  REPORT_PROPOSAL: 'REPORT_PROPOSAL',
  LETTER_AUTHORIZATION: 'LETTER_AUTHORIZATION',
  WORK_LETTER: 'WORK_LETTER'
} as const;

export type DocumentGroup = typeof DocumentGroup[keyof typeof DocumentGroup];

export const documentGroupLabels: Record<DocumentGroup, string> = {
  REPORT_PROPOSAL: 'Báo cáo / Tờ trình',
  LETTER_AUTHORIZATION: 'Công văn / Ủy quyền',
  WORK_LETTER: 'Thư công tác'
};

export function parseDocumentGroup(value: string): DocumentGroup {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('báo cáo') || normalized.includes('bao cao') || normalized.includes('tờ trình') || normalized.includes('to trinh')) {
    return DocumentGroup.REPORT_PROPOSAL;
  }
  if (normalized.includes('công văn') || normalized.includes('cong van') || normalized.includes('ủy quyền') || normalized.includes('uy quyen')) {
    return DocumentGroup.LETTER_AUTHORIZATION;
  }
  return DocumentGroup.WORK_LETTER;
}
