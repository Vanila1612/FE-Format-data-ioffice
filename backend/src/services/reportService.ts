import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { DocumentGroup, documentGroupLabels, type DocumentGroup as DocumentGroupValue } from './documentGroups.js';
import { isSignedDocument } from './normalizationService.js';
import { isNhnoSpecialCase } from './classificationService.js';

export type DocumentFilters = {
  importId?: string;
  search?: string;
  unit?: string;
  group?: DocumentGroupValue;
  from?: Date;
  to?: Date;
};

export type ResultBoardRow = {
  stt: number;
  unit: string;
  reportSigned: number; reportTotal: number; reportRate: number;
  letterSigned: number; letterTotal: number; letterRate: number;
  workSigned: number; workTotal: number; workRate: number;
  totalSigned: number; totalDocuments: number; totalRate: number;
};

type SummaryDocument = {
  documentGroup: DocumentGroupValue;
  normalizedUnit: string;
  issuingUnit: string;
  signedDocument: string;
  signerName?: string | null;
};

export type SignerBoardRow = {
  stt: number;
  signer: string;
  totalDocuments: number;
  signed: number;
  signRate: number;
};

function signerKey(value: string | null | undefined): string {
  return (value || '').trim();
}

function buildSignerBoard(documents: SummaryDocument[]): SignerBoardRow[] {
  const map = new Map<string, { signer: string; totalDocuments: number; signed: number }>();
  for (const document of documents) {
    const name = signerKey(document.signerName);
    if (!name) continue;
    if (!map.has(name)) map.set(name, { signer: name, totalDocuments: 0, signed: 0 });
    const row = map.get(name)!;
    row.totalDocuments += 1;
    if (isSignedDocument(document.signedDocument)) row.signed += 1;
  }
  return [...map.values()]
    .sort((a, b) => b.totalDocuments - a.totalDocuments || a.signer.localeCompare(b.signer, 'vi'))
    .map((row, index) => ({ stt: index + 1, ...row, signRate: percentage(row.signed, row.totalDocuments) }));
}

export function isReportableDocument(document: Pick<SummaryDocument, 'issuingUnit' | 'normalizedUnit'>): boolean {
  return Boolean(document.normalizedUnit) || !isNhnoSpecialCase({ referenceNumber: '', issuingUnit: document.issuingUnit, normalizedUnit: document.normalizedUnit });
}

export function buildDocumentWhere(filters: DocumentFilters): Prisma.DocumentWhereInput {
  const issueDate = filters.from || filters.to ? {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {})
  } : undefined;
  return {
    importId: filters.importId,
    documentGroup: filters.group,
    normalizedUnit: filters.unit ? { contains: filters.unit } : undefined,
    issueDate,
    OR: filters.search
      ? [
          { summary: { contains: filters.search } },
          { referenceNumber: { contains: filters.search } },
          { issuingUnit: { contains: filters.search } },
          { normalizedUnit: { contains: filters.search } }
        ]
      : undefined
  };
}

export async function listDocuments(filters: DocumentFilters, page: number, pageSize: number, sortBy = 'issueDate', sortDir: 'asc' | 'desc' = 'desc') {
  const where = buildDocumentWhere(filters);
  const orderBy = { [sortBy]: sortDir } as Prisma.DocumentOrderByWithRelationInput;
  const [total, items] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

function percentage(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

export function summaryFromDocuments(documents: SummaryDocument[]) {
  const reportableDocuments = documents.filter(isReportableDocument);
  const totals = {
    total: reportableDocuments.length,
    signed: reportableDocuments.filter((document) => isSignedDocument(document.signedDocument)).length,
    unsigned: 0,
    signRate: 0
  };
  totals.unsigned = totals.total - totals.signed;
  totals.signRate = percentage(totals.signed, totals.total);

  const byGroup = Object.fromEntries(Object.values(DocumentGroup).map((group) => [group, {
    key: group,
    label: documentGroupLabels[group],
    total: 0
  }]));
  const byUnit = new Map<string, { unit: string; total: number; signed: number; unsigned: number; signRate: number }>();

  for (const document of reportableDocuments) {
    byGroup[document.documentGroup].total += 1;
    const unit = document.normalizedUnit || document.issuingUnit || 'Unknown';
    if (!byUnit.has(unit)) byUnit.set(unit, { unit, total: 0, signed: 0, unsigned: 0, signRate: 0 });
    const row = byUnit.get(unit)!;
    row.total += 1;
    if (isSignedDocument(document.signedDocument)) row.signed += 1;
  }
  for (const row of byUnit.values()) {
    row.unsigned = row.total - row.signed;
    row.signRate = percentage(row.signed, row.total);
  }

  const board = new Map<string, Omit<ResultBoardRow, 'stt' | 'reportRate' | 'letterRate' | 'workRate' | 'totalRate'>>();
  for (const document of reportableDocuments) {
    const unit = document.normalizedUnit || document.issuingUnit || 'Không rõ';
    if (!board.has(unit)) board.set(unit, { unit, reportSigned: 0, reportTotal: 0, letterSigned: 0, letterTotal: 0, workSigned: 0, workTotal: 0, totalSigned: 0, totalDocuments: 0 });
    const row = board.get(unit)!; const signed = isSignedDocument(document.signedDocument);
    if (document.documentGroup === DocumentGroup.REPORT_PROPOSAL) { row.reportTotal += 1; if (signed) row.reportSigned += 1; }
    else if (document.documentGroup === DocumentGroup.LETTER_AUTHORIZATION) { row.letterTotal += 1; if (signed) row.letterSigned += 1; }
    else { row.workTotal += 1; if (signed) row.workSigned += 1; }
    row.totalDocuments += 1; if (signed) row.totalSigned += 1;
  }
  const boardRows: ResultBoardRow[] = [...board.values()]
    .sort((a, b) => b.totalDocuments - a.totalDocuments || a.unit.localeCompare(b.unit, 'vi'))
    .map((row, index) => ({ stt: index + 1, ...row, reportRate: percentage(row.reportSigned, row.reportTotal), letterRate: percentage(row.letterSigned, row.letterTotal), workRate: percentage(row.workSigned, row.workTotal), totalRate: percentage(row.totalSigned, row.totalDocuments) }));

  return {
    totals,
    byGroup: Object.values(byGroup),
    byUnit: [...byUnit.values()].sort((a, b) => b.total - a.total),
    boardRows,
    signerBoardRows: buildSignerBoard(reportableDocuments)
  };
}

export async function summary(filters: DocumentFilters) {
  return summaryFromDocuments(await prisma.document.findMany({ where: buildDocumentWhere(filters) }));
}
