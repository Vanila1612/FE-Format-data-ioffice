import { prisma } from '../config/prisma.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/appError.js';
import { buildDocumentWhere, isReportableDocument, summaryFromDocuments, type DocumentFilters } from './reportService.js';

type SnapshotSourceDocument = {
  id: string;
  summary: string;
  referenceNumber: string;
  signedDocument: string;
  signerName: string;
  issueDate: Date | null;
  issuingUnit: string;
  normalizedUnit: string;
  documentGroup: Prisma.SnapshotDocumentCreateManyInput['documentGroup'];
  rawData: Prisma.JsonValue;
};

export function snapshotDocumentInput(snapshotId: string, document: SnapshotSourceDocument): Prisma.SnapshotDocumentCreateManyInput {
  return {
    snapshotId,
    originalDocumentId: document.id,
    summary: document.summary,
    referenceNumber: document.referenceNumber,
    signedDocument: document.signedDocument,
    signerName: document.signerName,
    issueDate: document.issueDate,
    issuingUnit: document.issuingUnit,
    normalizedUnit: document.normalizedUnit,
    documentGroup: document.documentGroup,
    rawData: document.rawData as Prisma.InputJsonValue
  };
}

export async function createRuleVersion(createdBy: string) {
  const [rules, last] = await Promise.all([
    prisma.classificationRule.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] }),
    prisma.ruleVersion.findFirst({ orderBy: { version: 'desc' } })
  ]);
  return prisma.ruleVersion.create({
    data: {
      version: (last?.version || 0) + 1,
      rulesJson: rules,
      createdBy
    }
  });
}

export async function createSnapshot(input: { name: string; description?: string; importId?: string; filters?: DocumentFilters; createdById: string }) {
  const filters = { ...(input.filters || {}), ...(input.importId ? { importId: input.importId } : {}) };
  const documents = (await prisma.document.findMany({ where: buildDocumentWhere(filters), orderBy: { createdAt: 'asc' } })).filter(isReportableDocument);
  if (documents.length === 0) throw new AppError(400, 'EMPTY_REPORT', 'Cannot create a snapshot from an empty report');
  const ruleVersion = await createRuleVersion(input.createdById);
  const mappingVersion = await prisma.unitMapping.count();
  const snapshot = await prisma.snapshot.create({
    data: {
      name: input.name,
      description: input.description,
      importId: input.importId || filters.importId,
      ruleVersionId: ruleVersion.id,
      mappingVersion,
      createdById: input.createdById,
      filtersJson: filters as Prisma.InputJsonValue,
      reportJson: summaryFromDocuments(documents) as Prisma.InputJsonValue
    }
  });

  await prisma.snapshotDocument.createMany({
    data: documents.map((document) => snapshotDocumentInput(snapshot.id, document))
  });

  return prisma.snapshot.findUniqueOrThrow({
    where: { id: snapshot.id },
    include: { import: true, ruleVersion: true, _count: { select: { documents: true } } }
  });
}

export async function snapshotReport(snapshotId: string) {
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new AppError(404, 'SNAPSHOT_NOT_FOUND', 'Snapshot not found');
  if (snapshot.reportJson) return snapshot.reportJson;
  const documents = await prisma.snapshotDocument.findMany({ where: { snapshotId } });
  return summaryFromDocuments(documents);
}

export async function compareSnapshots(leftId: string, rightId: string) {
  const [left, right] = await Promise.all([
    prisma.snapshot.findUnique({ where: { id: leftId }, include: { documents: true } }),
    prisma.snapshot.findUnique({ where: { id: rightId }, include: { documents: true } })
  ]);
  if (!left || !right) throw new AppError(404, 'SNAPSHOT_NOT_FOUND', 'Snapshot not found');

  const identity = (document: { referenceNumber: string; issueDate: Date | null; summary: string }) =>
    `${document.referenceNumber}|${document.issueDate?.toISOString() || ''}|${document.summary}`;
  const bucket = <T extends { referenceNumber: string; issueDate: Date | null; summary: string }>(documents: T[]) => documents.reduce((map, document) => {
    const key = identity(document); const values = map.get(key) || []; values.push(document); map.set(key, values); return map;
  }, new Map<string, T[]>());
  const leftBuckets = bucket(left.documents); const rightBuckets = bucket(right.documents);
  let added = 0; let removed = 0; let changed = 0; let unchanged = 0;
  for (const key of new Set([...leftBuckets.keys(), ...rightBuckets.keys()])) {
    const before = leftBuckets.get(key) || []; const after = rightBuckets.get(key) || [];
    const matched = Math.min(before.length, after.length);
    removed += before.length - matched; added += after.length - matched;
    for (let index = 0; index < matched; index += 1) {
      const leftDocument = before[index]; const rightDocument = after[index];
      if (leftDocument.documentGroup !== rightDocument.documentGroup || leftDocument.normalizedUnit !== rightDocument.normalizedUnit || leftDocument.signedDocument !== rightDocument.signedDocument) changed += 1;
      else unchanged += 1;
    }
  }
  return { added, removed, changed, unchanged };
}
