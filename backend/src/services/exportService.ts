import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';
import { documentGroupLabels } from './documentGroups.js';
import { buildWorkbook } from './excelService.js';
import { buildDocumentWhere, summary, summaryFromDocuments, type DocumentFilters, type ResultBoardRow } from './reportService.js';

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
      name: 'Văn bản',
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

  const report = snapshot.reportJson ? snapshot.reportJson as unknown as Awaited<ReturnType<typeof summary>> : summaryFromDocuments(snapshot.documents);
  return buildWorkbook([
    {
      name: 'Thông tin kết quả',
      rows: [{
        'Tên kết quả': snapshot.name,
        'Nguồn dữ liệu': snapshot.import?.originalFileName || 'Nhiều lần import',
        'Phiên bản quy tắc': snapshot.ruleVersion.version,
        'Phiên bản chuẩn hóa': snapshot.mappingVersion,
        'Thời điểm lưu': snapshot.createdAt.toISOString()
      }]
    },
    {
      name: 'Kết quả thống kê',
      rows: resultBoardRows(report.boardRows)
    },
    {
      name: 'Văn bản',
      rows: snapshot.documents.map((document, index) => ({
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

function resultBoardRows(rows: ResultBoardRow[]) {
  return rows.map((row) => ({
    STT: row.stt,
    'Đơn vị': row.unit,
    'BC/TTr - Đã ký': row.reportSigned,
    'BC/TTr - Tổng': row.reportTotal,
    'BC/TTr - Tỷ lệ': `${row.reportRate}%`,
    'CV/UQ - Đã ký': row.letterSigned,
    'CV/UQ - Tổng': row.letterTotal,
    'CV/UQ - Tỷ lệ': `${row.letterRate}%`,
    'Thư công tác - Đã ký': row.workSigned,
    'Thư công tác - Tổng': row.workTotal,
    'Thư công tác - Tỷ lệ': `${row.workRate}%`,
    'Tổng đã ký': row.totalSigned,
    'Tổng văn bản': row.totalDocuments,
    'Tỷ lệ ký': `${row.totalRate}%`
  }));
}
