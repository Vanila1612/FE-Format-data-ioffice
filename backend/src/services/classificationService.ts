import type { ClassificationRule } from '@prisma/client';
import { normalizeText } from './normalizationService.js';
import { DocumentGroup, type DocumentGroup as DocumentGroupValue } from './documentGroups.js';

const NHNO_ISSUING_UNITS = [
  'NHNo',
  'NHNo.LH',
  'Ngân hàng Nông nghiệp và Phát triển nông thôn Việt Nam',
  'Ngan hang Nong nghiep va Phat trien nong thon Viet Nam'
];

export type ClassificationInput = {
  referenceNumber: string;
  issuingUnit: string;
  normalizedUnit: string;
};

export type ClassificationResult = {
  documentGroup: DocumentGroupValue;
  normalizedUnit: string;
  matchedRuleId: string | null;
  matchedRuleName: string;
  useReferenceSuffix: boolean;
};

function containsInsensitive(source: string, keyword: string): boolean {
  return normalizeText(source).toLowerCase().includes(normalizeText(keyword).toLowerCase());
}

function referenceContainsKeyword(referenceNumber: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  // BC/TTr must not be matched inside a unit suffix such as "ABC". The
  // workbook also contains compact forms (for example "2694TTr"), so a
  // non-letter prefix is accepted. CV/UQ deliberately remain substring
  // matches to cover formats such as "GUQ" used in the manual workbook.
  if (/^(BC|TTr)$/i.test(normalizedKeyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-zA-ZÀ-ỹ])${escaped}`, 'iu').test(normalizeText(referenceNumber));
  }
  return containsInsensitive(referenceNumber, normalizedKeyword);
}

function issuerKey(value: string): string {
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isNhnoSpecialCase(input: ClassificationInput): boolean {
  const issuingUnit = issuerKey(input.issuingUnit);
  return NHNO_ISSUING_UNITS.some((name) => issuerKey(name) === issuingUnit);
}

export function classifyDocument(input: ClassificationInput, rules: Pick<ClassificationRule, 'id' | 'name' | 'keyword' | 'documentGroup' | 'priority' | 'enabled'>[]): ClassificationResult {
  if (isNhnoSpecialCase(input)) {
    return {
      documentGroup: DocumentGroup.LETTER_AUTHORIZATION,
      // The import service resolves the approved reference suffix to its
      // reporting unit after this classification step.
      normalizedUnit: input.normalizedUnit,
      matchedRuleId: null,
      matchedRuleName: 'NHNo special case',
      useReferenceSuffix: true
    };
  }

  const match = [...rules]
    .sort((a, b) => a.priority - b.priority || a.keyword.localeCompare(b.keyword, 'vi'))
    .find((rule) => referenceContainsKeyword(input.referenceNumber, rule.keyword));

  if (match) {
    return {
      documentGroup: match.documentGroup,
      normalizedUnit: input.normalizedUnit,
      matchedRuleId: match.id,
      matchedRuleName: match.name,
      useReferenceSuffix: false
    };
  }

  return {
    documentGroup: DocumentGroup.WORK_LETTER,
    normalizedUnit: input.normalizedUnit,
    matchedRuleId: null,
    matchedRuleName: 'Default work letter',
    useReferenceSuffix: false
  };
}
