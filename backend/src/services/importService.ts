import { ImportStatus, Prisma } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';
import { classifyDocument } from './classificationService.js';
import { parseWorkbook } from './excelService.js';
import { normalizeDocument } from './normalizationService.js';

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
  const rules = await prisma.classificationRule.findMany({ where: { enabled: true }, orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] });
  const mappings = await prisma.unitMapping.findMany();

  const importRecord = await prisma.import.create({
    data: {
      originalFileName: file.originalname,
      storedFileName: 'pending',
      filePath: 'pending',
      fileSize: file.size,
      status: ImportStatus.PROCESSING,
      totalRows: parsed.rows.length,
      uploadedById
    }
  });

  try {
    const savedFile = await saveOriginalFile(file, importRecord.id);
    const documents = parsed.rows.map((row) => {
      const normalized = normalizeDocument(row, mappings);
      const classified = classifyDocument(normalized, rules);
      return {
        ...normalized,
        normalizedUnit: classified.normalizedUnit,
        documentGroup: classified.documentGroup
      };
    });

    const completed = await prisma.$transaction(async (tx) => {
      await tx.document.createMany({
        data: documents.map((document) => ({
          importId: importRecord.id,
          summary: document.summary,
          referenceNumber: document.referenceNumber,
          signedDocument: document.signedDocument,
          issueDate: document.issueDate,
          issuingUnit: document.issuingUnit,
          normalizedUnit: document.normalizedUnit,
          documentGroup: document.documentGroup,
          rawData: document.rawData as Prisma.InputJsonValue
        }))
      });
      return tx.import.update({
        where: { id: importRecord.id },
        data: {
          storedFileName: savedFile.storedFileName,
          filePath: savedFile.filePath,
          status: ImportStatus.COMPLETED,
          successRows: documents.length,
          failedRows: 0,
          completedAt: new Date()
        }
      });
    });

    return { import: completed, preview: parsed.preview, documentsImported: documents.length };
  } catch (error) {
    await prisma.import.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.FAILED,
        failedRows: parsed.rows.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown import error',
        completedAt: new Date()
      }
    });
    throw error;
  }
}
