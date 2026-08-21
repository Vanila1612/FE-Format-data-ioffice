import { DocumentGroup } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { snapshotDocumentInput } from '../src/services/snapshotService.js';

describe('snapshotService', () => {
  it('copies document fields into immutable snapshot input', () => {
    const source = {
      id: 'doc-1',
      summary: 'Original summary',
      referenceNumber: '01/CV-ALCO',
      signedDocument: 'Đã ký số',
      signerName: 'Nguyễn Văn A',
      issueDate: new Date('2026-08-13T00:00:00.000Z'),
      issuingUnit: 'NHNo',
      normalizedUnit: 'ALCO',
      documentGroup: DocumentGroup.LETTER_AUTHORIZATION,
      rawData: { 'Số ký hiệu': '01/CV-ALCO' }
    };

    const copied = snapshotDocumentInput('snapshot-1', source);
    source.summary = 'Changed later';
    source.normalizedUnit = 'CHANGED';

    expect(copied.snapshotId).toBe('snapshot-1');
    expect(copied.originalDocumentId).toBe('doc-1');
    expect(copied.summary).toBe('Original summary');
    expect(copied.normalizedUnit).toBe('ALCO');
    expect(copied.documentGroup).toBe(DocumentGroup.LETTER_AUTHORIZATION);
    expect(copied.signerName).toBe('Nguyễn Văn A');
  });
});
