import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';
import { classifyDocument } from './classificationService.js';
import { parseWorkbook } from './excelService.js';
import { documentDedupeKey, normalizeDocument, normalizeNhnoReferenceUnit } from './normalizationService.js';

const allowedExtensions = new Set(['.xlsx', '.xls']);
const allowedMime = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream'
]);

function sanitizeFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, '_');
}

function validateUpload(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(ext)) throw new AppError(400, 'INVALID_FILE_EXTENSION', 'Only .xlsx and .xls files are supported');
  if (!allowedMime.has(file.mimetype)) throw new AppError(400, 'INVALID_FILE_MIME', 'Invalid Excel MIME type');
}

async function saveOriginalFile(file: Express.Multer.File, importId: string) {
  const now = new Date();
  const directory = path.resolve(env.UPLOAD_DIR, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), `import-${importId}`);
  await fs.mkdir(directory, { recursive: true });
  const storedFileName = `${Date.now()}-${sanitizeFileName(file.originalname)}`;
  const filePath = path.join(directory, storedFileName);
  await fs.writeFile(filePath, file.buffer);
  return { storedFileName, filePath };
}

export async function previewImport(file: Express.Multer.File) {
  validateUpload(file);
  return parseWorkbook(file.buffer);
}

export async function createImport(file: Express.Multer.File, uploadedById: string) {
  validateUpload(file);
  const parsed = parseWorkbook(file.buffer);
  const rules = await prisma.classificationRule.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] });
  const mappings = await prisma.unitMapping.findMany();

  const importRecord = await prisma.import.create({
    data: {
      originalFileName: file.originalname,
      storedFileName: 'pending',
      filePath: 'pending',
      fileSize: file.size,
      status: 'PROCESSING',
      totalRows: parsed.rows.length,
      uploadedById
    }
  });

  try {
    const savedFile = await saveOriginalFile(file, importRecord.id);
    const documents = await normalizeRows(parsed.rows, rules, mappings);
    await persistDocuments(importRecord.id, documents);
    const completed = await prisma.import.update({
      where: { id: importRecord.id },
      data: {
        storedFileName: savedFile.storedFileName,
        filePath: savedFile.filePath,
        status: 'COMPLETED',
        successRows: documents.length,
        failedRows: 0,
        completedAt: new Date()
      }
    });

    return { import: completed, preview: parsed.preview, documentsImported: documents.length, replacedRows: 0 };
  } catch (error) {
    await prisma.import.update({
      where: { id: importRecord.id },
      data: {
        status: 'FAILED',
        failedRows: parsed.rows.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown import error',
        completedAt: new Date()
      }
    });
    throw error;
  }
}

type ClassifiedDocument = ReturnType<typeof normalizeDocument> & { normalizedUnit: string; documentGroup: ReturnType<typeof classifyDocument>['documentGroup'] };

async function normalizeRows(rows: Awaited<ReturnType<typeof parseWorkbook>>['rows'], rules: Awaited<ReturnType<typeof prisma.classificationRule.findMany>>, mappings: Awaited<ReturnType<typeof prisma.unitMapping.findMany>>) {
  return rows.map((row) => {
    const normalized = normalizeDocument(row, mappings);
    const classified = classifyDocument(normalized, rules);
    const normalizedUnit = classified.useReferenceSuffix
      ? normalizeNhnoReferenceUnit(normalized.referenceNumber, mappings) || ''
      : classified.normalizedUnit;
    return { ...normalized, normalizedUnit, documentGroup: classified.documentGroup };
  });
}

async function persistDocuments(importId: string, documents: ClassifiedDocument[]) {
  await prisma.document.createMany({
    data: documents.map((document) => ({
      importId,
      summary: document.summary,
      referenceNumber: document.referenceNumber,
      signedDocument: document.signedDocument,
      issueDate: document.issueDate,
      issuingUnit: document.issuingUnit,
      normalizedUnit: document.normalizedUnit,
      documentGroup: document.documentGroup,
      rawData: document.rawData as Prisma.InputJsonValue,
      dedupeKey: documentDedupeKey(document.referenceNumber, document.issueDate, document.issuingUnit)
    }))
  });
}

export async function reprocessImport(importId: string) {
  const imported = await prisma.import.findUnique({ where: { id: importId } });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Import not found');
  let buffer: Buffer;
  try { buffer = await fs.readFile(imported.filePath); } catch { throw new AppError(404, 'SOURCE_FILE_NOT_FOUND', 'Original import file is no longer available'); }
  const parsed = parseWorkbook(buffer);
  const [rules, mappings] = await Promise.all([
    prisma.classificationRule.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] }),
    prisma.unitMapping.findMany()
  ]);
  const documents = await normalizeRows(parsed.rows, rules, mappings);
  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({ where: { importId } });
    await tx.document.createMany({
      data: documents.map((document) => ({
        importId,
        summary: document.summary,
        referenceNumber: document.referenceNumber,
        signedDocument: document.signedDocument,
        issueDate: document.issueDate,
        issuingUnit: document.issuingUnit,
        normalizedUnit: document.normalizedUnit,
        documentGroup: document.documentGroup,
        rawData: document.rawData as Prisma.InputJsonValue,
        dedupeKey: documentDedupeKey(document.referenceNumber, document.issueDate, document.issuingUnit)
      }))
    });
    await tx.import.update({ where: { id: importId }, data: { totalRows: documents.length, successRows: documents.length, failedRows: 0, status: 'COMPLETED', errorMessage: null, completedAt: new Date() } });
  });
  return prisma.import.findUniqueOrThrow({ where: { id: importId }, include: { _count: { select: { documents: true } } } });
}

export async function deleteImport(importId: string) {
  const imported = await prisma.import.findUnique({ where: { id: importId } });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Không tìm thấy lần nhập dữ liệu');
  const snapshots = await prisma.snapshot.findMany({ where: { importId }, select: { id: true } });
  const snapshotIds = snapshots.map((snapshot) => snapshot.id);
  await prisma.$transaction(async (tx) => {
    if (snapshotIds.length) {
      await tx.snapshotDocument.deleteMany({ where: { snapshotId: { in: snapshotIds } } });
      await tx.snapshot.deleteMany({ where: { id: { in: snapshotIds } } });
    }
    await tx.document.deleteMany({ where: { importId } });
    await tx.import.delete({ where: { id: importId } });
  });
  await fs.rm(imported.filePath, { force: true }).catch(() => undefined);
  return { deleted: true, deletedSnapshots: snapshotIds.length };
}
