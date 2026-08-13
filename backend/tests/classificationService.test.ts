import { DocumentGroup } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { classifyDocument, unitFromReference } from '../src/services/classificationService.js';

const rules = [
  { id: 'bc', name: 'BC', keyword: 'BC', documentGroup: DocumentGroup.REPORT_PROPOSAL, priority: 20, enabled: true },
  { id: 'ttr', name: 'TTr', keyword: 'TTr', documentGroup: DocumentGroup.REPORT_PROPOSAL, priority: 20, enabled: true },
  { id: 'cv', name: 'CV', keyword: 'CV', documentGroup: DocumentGroup.LETTER_AUTHORIZATION, priority: 30, enabled: true },
  { id: 'uq', name: 'UQ', keyword: 'UQ', documentGroup: DocumentGroup.LETTER_AUTHORIZATION, priority: 30, enabled: true }
];

describe('classificationService', () => {
  it('classifies BC and TTr as report/proposal', () => {
    expect(classifyDocument({ referenceNumber: '12/BC-ABC', issuingUnit: 'ABC', normalizedUnit: 'ABC' }, rules).documentGroup).toBe(DocumentGroup.REPORT_PROPOSAL);
    expect(classifyDocument({ referenceNumber: '12/TTr-ABC', issuingUnit: 'ABC', normalizedUnit: 'ABC' }, rules).documentGroup).toBe(DocumentGroup.REPORT_PROPOSAL);
  });

  it('classifies CV and UQ as letter/authorization', () => {
    expect(classifyDocument({ referenceNumber: '12/CV-ABC', issuingUnit: 'ABC', normalizedUnit: 'ABC' }, rules).documentGroup).toBe(DocumentGroup.LETTER_AUTHORIZATION);
    expect(classifyDocument({ referenceNumber: '12/UQ-ABC', issuingUnit: 'ABC', normalizedUnit: 'ABC' }, rules).documentGroup).toBe(DocumentGroup.LETTER_AUTHORIZATION);
  });

  it('defaults to work letter', () => {
    expect(classifyDocument({ referenceNumber: '12/TB-ABC', issuingUnit: 'ABC', normalizedUnit: 'ABC' }, rules).documentGroup).toBe(DocumentGroup.WORK_LETTER);
  });

  it('handles NHNo and Agribank before normal rules', () => {
    const nhno = classifyDocument({ referenceNumber: '12969/NHNo-ALCO', issuingUnit: 'NHNo', normalizedUnit: 'NHNo' }, rules);
    expect(nhno.documentGroup).toBe(DocumentGroup.LETTER_AUTHORIZATION);
    expect(nhno.normalizedUnit).toBe('ALCO');
    const agribank = classifyDocument({ referenceNumber: '1/BC-TSC', issuingUnit: 'Agribank', normalizedUnit: 'Agribank' }, rules);
    expect(agribank.documentGroup).toBe(DocumentGroup.LETTER_AUTHORIZATION);
  });

  it('extracts unit after dash in reference number', () => {
    expect(unitFromReference('12969/NHNo-ALCO')).toBe('ALCO');
  });
});
