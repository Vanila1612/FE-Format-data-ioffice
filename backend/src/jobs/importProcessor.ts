import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { classifyDocument } from '../services/classificationService.js';
import { parseWorkbook } from '../services/excelService.js';
import { documentDedupeKey, normalizeDocument, normalizeNhnoReferenceUnit } from '../services/normalizationService.js';
import { buildConnection, IMPORT_QUEUE_NAME, type ImportJobData } from './importQueue.js';

type ClassifiedDocument = ReturnType<typeof normalizeDocument> & {
  normalizedUnit: string;
  documentGroup: ReturnType<typeof classifyDocument>['documentGroup'];
};

async function markStatus(importId: string, data: Prisma.ImportUpdateInput) {
  await prisma.import.update({ where: { id: importId }, data });
}

async function processImport(job: Job<ImportJobData>): Promise<{ imported: number; total: number }> {
  const { importId } = job.data;
  const imported = await prisma.import.findUnique({ where: { id: importId } });
  if (!imported) throw new Error(`Import ${importId} not found`);
  if (imported.status === 'COMPLETED') {
    return { imported: imported.successRows, total: imported.totalRows };
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(imported.filePath);
  } catch {
    throw new Error(`Original file missing on disk: ${imported.filePath}`);
  }

  await markStatus(importId, { status: 'PROCESSING', processedRows: 0, errorMessage: null });

  const parsed = parseWorkbook(buffer);
  const [rules, mappings] = await Promise.all([
    prisma.classificationRule.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] }),
    prisma.unitMapping.findMany()
  ]);

  const total = parsed.rows.length;
  await prisma.import.update({ where: { id: importId }, data: { totalRows: total } });

  const chunkSize = env.IMPORT_CHUNK_SIZE;
  let processed = 0;
  let inserted = 0;

  for (let start = 0; start < total; start += chunkSize) {
    const slice = parsed.rows.slice(start, start + chunkSize);
    const documents: ClassifiedDocument[] = slice.map((row) => {
      const normalized = normalizeDocument(row, mappings);
      const classified = classifyDocument(normalized, rules);
      const normalizedUnit = classified.useReferenceSuffix
        ? normalizeNhnoReferenceUnit(normalized.referenceNumber, mappings) || ''
        : classified.normalizedUnit;
      return { ...normalized, normalizedUnit, documentGroup: classified.documentGroup };
    });

    try {
      await prisma.document.createMany({
        data: documents.map((doc) => ({
          importId,
          summary: doc.summary,
          referenceNumber: doc.referenceNumber,
          signedDocument: doc.signedDocument,
          signerName: doc.signerName ?? '',
          issueDate: doc.issueDate,
          issuingUnit: doc.issuingUnit,
          normalizedUnit: doc.normalizedUnit,
          documentGroup: doc.documentGroup,
          rawData: doc.rawData as unknown as Prisma.InputJsonValue,
          dedupeKey: documentDedupeKey(doc.referenceNumber, doc.issueDate, doc.issuingUnit)
        }))
      });
      inserted += slice.length;
    } catch (error) {
      // Nếu trùng dedupeKey (unique), Mongo sẽ báo duplicate key — bỏ qua các dòng lỗi, tiếp tục batch kế tiếp
      const message = error instanceof Error ? error.message : String(error);
      if (/duplicate key|E11000/i.test(message)) {
        console.warn(`[import-worker] skipped duplicates in batch starting ${processed}`);
        // đếm inserted dựa trên số dòng đã insert (xấp xỉ)
      } else {
        throw error;
      }
    }
    processed += slice.length;

    await job.updateProgress(Math.floor((processed / total) * 100));
    await markStatus(importId, { processedRows: processed });
  }

  await markStatus(importId, {
    status: 'COMPLETED',
    processedRows: total,
    successRows: inserted,
    failedRows: Math.max(0, total - inserted),
    completedAt: new Date(),
    errorMessage: null
  });

  return { imported: inserted, total };
}

let activeWorker: Worker<ImportJobData> | null = null;

export function startImportWorker() {
  if (activeWorker) return activeWorker;
  activeWorker = new Worker<ImportJobData>(
    IMPORT_QUEUE_NAME,
    async (job) => processImport(job),
    {
      connection: buildConnection(),
      concurrency: 1
    }
  );

  activeWorker.on('failed', async (job, error) => {
    if (!job) return;
    const { importId } = job.data;
    const attemptsMade = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    if (attemptsMade >= maxAttempts) {
      try {
        await prisma.import.update({
          where: { id: importId },
          data: {
            status: 'FAILED',
            errorMessage: error.message || String(error),
            completedAt: new Date()
          }
        });
      } catch (updateError) {
        console.error('Failed to mark import as FAILED:', updateError);
      }
    }
  });

  activeWorker.on('error', (error) => {
    console.error('[import-worker] error:', error);
  });

  console.log(`[import-worker] listening on queue "${IMPORT_QUEUE_NAME}" (redis: ${new URL(env.REDIS_URL ?? '').host})`);
  return activeWorker;
}

export async function stopImportWorker() {
  if (!activeWorker) return;
  await activeWorker.close();
  activeWorker = null;
}

export function queueFilePath(filePath: string): string {
  return path.resolve(filePath);
}
