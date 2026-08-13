import { DocumentGroup, type ClassificationRule } from '@prisma/client';
import { normalizeText } from './normalizationService.js';

const AGRIBANK_NAMES = [
  'NHNo',
  'Agribank',
  'Ngân hàng Nông nghiệp và Phát triển nông thôn Việt Nam',
  'Ngan hang Nong nghiep va Phat trien nong thon Viet Nam'
];

export type ClassificationInput = {
  referenceNumber: string;
  issuingUnit: string;
  normalizedUnit: string;
};

export type ClassificationResult = {
  documentGroup: DocumentGroup;
  normalizedUnit: string;
  matchedRuleId: string | null;
  matchedRuleName: string;
};

function containsInsensitive(source: string, keyword: string): boolean {
  return normalizeText(source).toLowerCase().includes(normalizeText(keyword).toLowerCase());
}

function referenceContainsKeyword(referenceNumber: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword).toLowerCase();
  return normalizeText(referenceNumber)
    .split(/[^0-9a-zA-ZÀ-ỹ]+/u)
    .map((part) => part.toLowerCase())
    .some((part) => part === normalizedKeyword);
}

export function isAgribankSpecialCase(input: ClassificationInput): boolean {
  return AGRIBANK_NAMES.some((name) => containsInsensitive(input.issuingUnit, name));
}

export function unitFromReference(referenceNumber: string): string | null {
  const parts = normalizeText(referenceNumber).split('-').map(normalizeText).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) || null : null;
}

export function classifyDocument(input: ClassificationInput, rules: Pick<ClassificationRule, 'id' | 'name' | 'keyword' | 'documentGroup' | 'priority' | 'enabled'>[]): ClassificationResult {
  if (isAgribankSpecialCase(input)) {
    return {
      documentGroup: DocumentGroup.LETTER_AUTHORIZATION,
      normalizedUnit: unitFromReference(input.referenceNumber) || input.normalizedUnit || 'Trụ sở chính',
      matchedRuleId: null,
      matchedRuleName: 'Agribank/NHNo special case'
    };
  }

  const match = [...rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority || a.keyword.localeCompare(b.keyword, 'vi'))
    .find((rule) => referenceContainsKeyword(input.referenceNumber, rule.keyword));

  if (match) {
    return {
      documentGroup: match.documentGroup,
      normalizedUnit: input.normalizedUnit,
      matchedRuleId: match.id,
      matchedRuleName: match.name
    };
  }

  return {
    documentGroup: DocumentGroup.WORK_LETTER,
    normalizedUnit: input.normalizedUnit,
    matchedRuleId: null,
    matchedRuleName: 'Default work letter'
  };
}
