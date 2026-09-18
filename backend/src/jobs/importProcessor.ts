import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { classifyDocument } from '../services/classificationService.js';
import { parseWorkbook } from '../services/excelService.js';
import { documentDedupeKey, normalizeDocument, normalizeNhnoReferenceUnit } from '../services/normalizationService.js';
import { buildConnectionOptions, IMPORT_QUEUE_NAME, type ImportJobData } from './importQueue.js';

type ClassifiedDocument = ReturnType<typeof normalizeDocument> & {
  normalizedUnit: string;
  documentGroup: ReturnType<typeof classifyDocument>['documentGroup'];
};

async function markStatus(importId: string, data: Prisma.ImportUpdateInput) {
  await prisma.import.update({ where: { id: importId }, data });
}

export type ProgressReporter = { updateProgress: (percent: number) => Promise<void> };

const noopProgress: ProgressReporter = { updateProgress: async () => undefined };

export async function runImportCore(importId: string, progress: ProgressReporter = noopProgress): Promise<{ imported: number; total: number }> {
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
  console.log(`[import-worker] importId=${importId} status=PROCESSING, file=${imported.filePath}`);

  const parsed = parseWorkbook(buffer);
  console.log(`[import-worker] importId=${importId} parsed rows=${parsed.rows.length}`);
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
    const percent = Math.floor((processed / total) * 100);
    if (processed % (chunkSize * 5) === 0 || processed === total) {
      console.log(`[import-worker] importId=${importId} progress ${processed}/${total} (${percent}%) inserted~${inserted}`);
    }

    await progress.updateProgress(percent);
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
  console.log(`[import-worker] importId=${importId} COMPLETED inserted=${inserted}/${total}`);

  return { imported: inserted, total };
}

async function processImport(job: Job<ImportJobData>): Promise<{ imported: number; total: number }> {
  const { importId } = job.data;
  console.log(`[import-worker] picked job ${job.id} for importId=${importId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1})`);
  const startedAt = Date.now();
  try {
    const result = await runImportCore(importId, { updateProgress: (p) => job.updateProgress(p) });
    console.log(`[import-worker] job ${job.id} importId=${importId} done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (imported=${result.imported}/${result.total})`);
    return result;
  } catch (error) {
    console.error(`[import-worker] job ${job.id} importId=${importId} failed:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

let activeWorker: Worker<ImportJobData> | null = null;

export function startImportWorker() {
  if (activeWorker) return activeWorker;
  if (!env.REDIS_URL) {
    console.error('[import-worker] REDIS_URL is not set — worker will NOT start. Set REDIS_URL in env and restart.');
    throw new Error('REDIS_URL is not set');
  }
  console.log(`[import-worker] connecting to redis ${env.REDIS_URL} queue="${IMPORT_QUEUE_NAME}" concurrency=1`);
  activeWorker = new Worker<ImportJobData>(
    IMPORT_QUEUE_NAME,
    async (job) => processImport(job),
    {
      connection: buildConnectionOptions(),
      concurrency: 1
    }
  );

  activeWorker.on('ready', () => {
    console.log(`[import-worker] ready — listening on queue "${IMPORT_QUEUE_NAME}"`);
  });
  activeWorker.on('stalled', (jobId) => {
    console.warn(`[import-worker] job ${jobId} stalled (worker too slow or crashed mid-job)`);
  });
  activeWorker.on('failed', async (job, error) => {
    if (!job) return;
    const { importId } = job.data;
    const attemptsMade = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    console.warn(`[import-worker] job ${job.id} importId=${importId} failed attempt ${attemptsMade}/${maxAttempts}: ${error instanceof Error ? error.message : error}`);
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
        console.error(`[import-worker] importId=${importId} marked FAILED after ${attemptsMade} attempts`);
      } catch (updateError) {
        console.error('[import-worker] failed to mark import as FAILED:', updateError);
      }
    }
  });

  activeWorker.on('error', (error) => {
    console.error('[import-worker] worker error:', error instanceof Error ? error.message : error);
  });

  activeWorker.on('closed', () => {
    console.log('[import-worker] worker closed');
  });

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
