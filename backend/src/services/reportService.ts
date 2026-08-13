import { DocumentGroup, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { documentGroupLabels } from './documentGroups.js';
import { isSignedDocument } from './normalizationService.js';

export type DocumentFilters = {
  importId?: string;
  search?: string;
  unit?: string;
  group?: DocumentGroup;
  from?: Date;
  to?: Date;
};

export function buildDocumentWhere(filters: DocumentFilters): Prisma.DocumentWhereInput {
  return {
    importId: filters.importId,
    documentGroup: filters.group,
    normalizedUnit: filters.unit ? { contains: filters.unit, mode: 'insensitive' } : undefined,
    issueDate: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    OR: filters.search
      ? [
          { summary: { contains: filters.search, mode: 'insensitive' } },
          { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
          { issuingUnit: { contains: filters.search, mode: 'insensitive' } },
          { normalizedUnit: { contains: filters.search, mode: 'insensitive' } }
        ]
      : undefined
  };
}

export async function listDocuments(filters: DocumentFilters, page: number, pageSize: number, sortBy = 'issueDate', sortDir: 'asc' | 'desc' = 'desc') {
  const where = buildDocumentWhere(filters);
  const orderBy = { [sortBy]: sortDir } as Prisma.DocumentOrderByWithRelationInput;
  const [total, items] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function summary(filters: DocumentFilters) {
  const documents = await prisma.document.findMany({ where: buildDocumentWhere(filters) });
  const totals = {
    total: documents.length,
    signed: documents.filter((document) => isSignedDocument(document.signedDocument)).length,
    unsigned: 0,
    signRate: 0
  };
  totals.unsigned = totals.total - totals.signed;
  totals.signRate = totals.total ? Number(((totals.signed / totals.total) * 100).toFixed(1)) : 0;

  const byGroup = Object.fromEntries(Object.values(DocumentGroup).map((group) => [group, {
    key: group,
    label: documentGroupLabels[group],
    total: 0
  }]));
  const byUnit = new Map<string, { unit: string; total: number; signed: number; unsigned: number; signRate: number }>();

  for (const document of documents) {
    byGroup[document.documentGroup].total += 1;
    const unit = document.normalizedUnit || document.issuingUnit || 'Unknown';
    if (!byUnit.has(unit)) byUnit.set(unit, { unit, total: 0, signed: 0, unsigned: 0, signRate: 0 });
    const row = byUnit.get(unit)!;
    row.total += 1;
    if (isSignedDocument(document.signedDocument)) row.signed += 1;
  }
  for (const row of byUnit.values()) {
    row.unsigned = row.total - row.signed;
    row.signRate = row.total ? Number(((row.signed / row.total) * 100).toFixed(1)) : 0;
  }

  return {
    totals,
    byGroup: Object.values(byGroup),
    byUnit: [...byUnit.values()].sort((a, b) => b.total - a.total)
  };
}
