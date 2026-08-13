import { DocumentGroup } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';
import { documentGroupLabels } from './documentGroups.js';
import { buildWorkbook } from './excelService.js';
import { buildDocumentWhere, summary, type DocumentFilters } from './reportService.js';

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

export async function exportDocuments(filters: DocumentFilters) {
  const report = await summary(filters);
  const documents = await prisma.document.findMany({ where: buildDocumentWhere(filters), orderBy: { createdAt: 'desc' } });
  return buildWorkbook([
    {
      name: 'Summary',
      rows: [
        { Metric: 'Total documents', Value: report.totals.total },
        { Metric: 'Signed', Value: report.totals.signed },
        { Metric: 'Unsigned', Value: report.totals.unsigned },
        { Metric: 'Sign rate', Value: `${report.totals.signRate}%` }
      ]
    },
    {
      name: 'By Unit',
      rows: report.byUnit.map((row) => ({
        'Đơn vị': row.unit,
        'Tổng số': row.total,
        'Đã ký số': row.signed,
        'Chưa ký số': row.unsigned,
        'Tỷ lệ ký': `${row.signRate}%`
      }))
    },
    {
      name: 'Documents',
      rows: documents.map((document, index) => ({
        STT: index + 1,
        'Trích yếu': document.summary,
        'Số ký hiệu': document.referenceNumber,
        'Văn bản ký số': document.signedDocument,
        'Ngày ban hành': formatDate(document.issueDate),
        'Đơn vị ban hành': document.issuingUnit,
        'Đơn vị chuẩn hóa': document.normalizedUnit,
        'Nhóm văn bản': documentGroupLabels[document.documentGroup]
      }))
    }
  ]);
}

export async function exportSnapshot(snapshotId: string) {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    include: { documents: true, ruleVersion: true, import: true }
  });
  if (!snapshot) throw new AppError(404, 'SNAPSHOT_NOT_FOUND', 'Snapshot not found');

  return buildWorkbook([
    {
      name: 'Snapshot',
      rows: [{
        Name: snapshot.name,
        Import: snapshot.import.originalFileName,
        'Rule version': snapshot.ruleVersion.version,
        'Mapping version': snapshot.mappingVersion,
        'Created at': snapshot.createdAt.toISOString()
      }]
    },
    {
      name: 'Documents',
      rows: snapshot.documents.map((document, index) => ({
        STT: index + 1,
        'Trích yếu': document.summary,
        'Số ký hiệu': document.referenceNumber,
        'Văn bản ký số': document.signedDocument,
        'Ngày ban hành': formatDate(document.issueDate),
        'Đơn vị ban hành': document.issuingUnit,
        'Đơn vị chuẩn hóa': document.normalizedUnit,
        'Nhóm văn bản': documentGroupLabels[document.documentGroup as DocumentGroup]
      }))
    }
  ]);
}
