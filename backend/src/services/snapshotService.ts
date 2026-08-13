import { prisma } from '../config/prisma.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/appError.js';

type SnapshotSourceDocument = {
  id: string;
  summary: string;
  referenceNumber: string;
  signedDocument: string;
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

export async function createSnapshot(input: { name: string; description?: string; importId: string; createdById: string }) {
  const documents = await prisma.document.findMany({ where: { importId: input.importId }, orderBy: { createdAt: 'asc' } });
  if (documents.length === 0) throw new AppError(400, 'EMPTY_IMPORT', 'Cannot create snapshot for an import without documents');
  const ruleVersion = await createRuleVersion(input.createdById);
  const mappingVersion = await prisma.unitMapping.count();

  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.snapshot.create({
      data: {
        name: input.name,
        description: input.description,
        importId: input.importId,
        ruleVersionId: ruleVersion.id,
        mappingVersion,
        createdById: input.createdById
      }
    });

    await tx.snapshotDocument.createMany({
      data: documents.map((document) => snapshotDocumentInput(snapshot.id, document))
    });

    return tx.snapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
      include: { import: true, ruleVersion: true, _count: { select: { documents: true } } }
    });
  });
}

export async function compareSnapshots(leftId: string, rightId: string) {
  const [left, right] = await Promise.all([
    prisma.snapshot.findUnique({ where: { id: leftId }, include: { documents: true } }),
    prisma.snapshot.findUnique({ where: { id: rightId }, include: { documents: true } })
  ]);
  if (!left || !right) throw new AppError(404, 'SNAPSHOT_NOT_FOUND', 'Snapshot not found');

  const identity = (document: { referenceNumber: string; issueDate: Date | null; summary: string }) =>
    `${document.referenceNumber}|${document.issueDate?.toISOString() || ''}|${document.summary}`;
  const leftMap = new Map(left.documents.map((document) => [identity(document), document]));
  const rightMap = new Map(right.documents.map((document) => [identity(document), document]));
  const added = [...rightMap.keys()].filter((key) => !leftMap.has(key));
  const removed = [...leftMap.keys()].filter((key) => !rightMap.has(key));
  const changed = [...rightMap.keys()].filter((key) => {
    const before = leftMap.get(key);
    const after = rightMap.get(key);
    return before && after && (
      before.documentGroup !== after.documentGroup ||
      before.normalizedUnit !== after.normalizedUnit ||
      before.signedDocument !== after.signedDocument
    );
  });
  const unchanged = [...rightMap.keys()].filter((key) => leftMap.has(key) && !changed.includes(key));

  return { added: added.length, removed: removed.length, changed: changed.length, unchanged: unchanged.length };
}
