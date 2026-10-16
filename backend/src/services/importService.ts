import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';
import { getImportQueue, hasRedis } from '../jobs/importQueue.js';
import { processImportInline } from './importInlineFallback.js';
import { parseWorkbook } from './excelService.js';
import { documentDedupeKey, normalizeDocument } from './normalizationService.js';
import { resolveImportFilePath } from '../utils/fileStorage.js';

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
  const relDir = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), `import-${importId}`);
  const directory = path.resolve(env.UPLOAD_DIR, relDir);
  await fs.mkdir(directory, { recursive: true });
  const storedFileName = `${Date.now()}-${sanitizeFileName(file.originalname)}`;
  const diskPath = path.join(directory, storedFileName);
  await fs.writeFile(diskPath, file.buffer);
  const relativeFilePath = path.join(relDir, storedFileName);
  return { storedFileName, filePath: relativeFilePath, diskPath };
}

export async function previewImport(file: Express.Multer.File) {
  validateUpload(file);
  return parseWorkbook(file.buffer);
}

/**
 * Đẩy file + tạo Import record (PROCESSING + processedRows=0) rồi enqueue vào BullMQ.
 * Không xử lý Excel trong request — worker sẽ xử lý nền và cập nhật tiến độ.
 */
export async function enqueueImport(file: Express.Multer.File, uploadedById: string) {
  validateUpload(file);
  const parsed = parseWorkbook(file.buffer);
  console.log(`[import-enqueue] received file="${file.originalname}" size=${file.size} rows=${parsed.rows.length} uploadedBy=${uploadedById}`);

  // Chặn trùng lặp: nếu file cùng tên và dung lượng đang trong quá trình xử lý
  const ongoing = await prisma.import.findFirst({
    where: {
      originalFileName: file.originalname,
      fileSize: file.size,
      status: { in: ['PROCESSING', 'UPLOADED'] }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (ongoing) {
    throw new AppError(409, 'IMPORT_ALREADY_PROCESSING', 'File này đang trong quá trình xử lý, vui lòng chờ hệ thống hoàn thành.');
  }

  // Chặn trùng lặp: nếu file cùng tên, cùng dung lượng và cùng số dòng đã lưu thành công trước đó
  const duplicate = await prisma.import.findFirst({
    where: {
      originalFileName: file.originalname,
      fileSize: file.size,
      totalRows: parsed.rows.length,
      status: 'COMPLETED'
    },
    orderBy: { createdAt: 'desc' }
  });
  if (duplicate) {
    throw new AppError(409, 'DUPLICATE_IMPORT', 'Dữ liệu file này đã được lưu vào hệ thống trước đó. Vui lòng không lưu lại cùng dữ liệu nếu không có thay đổi.');
  }

  const importRecord = await prisma.import.create({
    data: {
      originalFileName: file.originalname,
      storedFileName: 'pending',
      filePath: 'pending',
      fileSize: file.size,
      status: 'PROCESSING',
      totalRows: parsed.rows.length,
      processedRows: 0,
      uploadedById
    }
  });
  console.log(`[import-enqueue] created import record id=${importRecord.id}`);

  const savedFile = await saveOriginalFile(file, importRecord.id);
  await prisma.import.update({
    where: { id: importRecord.id },
    data: { storedFileName: savedFile.storedFileName, filePath: savedFile.filePath }
  });
  console.log(`[import-enqueue] saved file to ${savedFile.filePath}`);

  try {
    const job = await getImportQueue().add('process', { importId: importRecord.id, uploadedById });
    console.log(`[import-enqueue] enqueued job=${job.id} importId=${importRecord.id} redis=${process.env.REDIS_URL || '(unset)'}`);
  } catch (queueError) {
    // Redis không khả dụng → fallback xử lý inline đồng bộ (giống code cũ)
    console.warn('[import-enqueue] Redis queue failed, falling back to inline processing:', queueError instanceof Error ? queueError.message : queueError);
    await processImportInline({
      importId: importRecord.id,
      filePath: savedFile.filePath,
      totalRows: parsed.rows.length
    });
    return {
      import: await prisma.import.findUniqueOrThrow({ where: { id: importRecord.id } }),
      preview: parsed.preview,
      documentsImported: parsed.rows.length,
      jobEnqueued: false,
      inline: true
    };
  }

  return {
    import: importRecord,
    preview: parsed.preview,
    documentsImported: 0,
    jobEnqueued: true
  };
}

export async function getImportStatus(importId: string) {
  const imported = await prisma.import.findUnique({
    where: { id: importId },
    select: {
      id: true,
      status: true,
      totalRows: true,
      processedRows: true,
      successRows: true,
      failedRows: true,
      errorMessage: true,
      completedAt: true,
      createdAt: true
    }
  });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Không tìm thấy lần nhập dữ liệu');
  return imported;
}

export async function getActiveImports(userId: string) {
  return prisma.import.findMany({
    where: {
      OR: [{ status: 'PROCESSING' }, { status: 'UPLOADED' }]
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
}

export async function reprocessImport(importId: string) {
  const imported = await prisma.import.findUnique({ where: { id: importId } });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Import not found');
  if (!imported.filePath || imported.filePath === 'pending') {
    throw new AppError(404, 'SOURCE_FILE_NOT_FOUND', 'Original import file is no longer available');
  }

  try {
    await resolveImportFilePath(
      imported.filePath,
      imported.storedFileName,
      imported.id,
      imported.createdAt
    );
  } catch {
    throw new AppError(404, 'SOURCE_FILE_NOT_FOUND', `Original import file is missing on disk: ${imported.filePath}`);
  }

  // Xóa documents cũ trước khi đẩy lại job (worker giả định insert từ đầu)
  await prisma.document.deleteMany({ where: { importId } });
  await prisma.import.update({
    where: { id: importId },
    data: {
      status: 'PROCESSING',
      totalRows: 0,
      processedRows: 0,
      successRows: 0,
      failedRows: 0,
      errorMessage: null,
      completedAt: null
    }
  });

  try {
    await getImportQueue().add('process', { importId, uploadedById: imported.uploadedById });
  } catch (queueError) {
    console.warn('[import-reprocess] Redis queue failed, falling back to inline:', queueError instanceof Error ? queueError.message : queueError);
    await processImportInline({
      importId,
      filePath: imported.filePath,
      totalRows: 0
    });
  }
  return prisma.import.findUniqueOrThrow({ where: { id: importId } });
}

export async function deleteImport(importId: string) {
  const imported = await prisma.import.findUnique({ where: { id: importId } });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Không tìm thấy lần nhập dữ liệu');

  const wasBusy = imported.status === 'PROCESSING' || imported.status === 'UPLOADED';

  const snapshots = await prisma.snapshot.findMany({ where: { importId }, select: { id: true } });
  const snapshotIds = snapshots.map((snapshot) => snapshot.id);

  // Xóa documents:
  // - Nếu đang xử lý (worker có thể vẫn insert): chunk để tránh xung đột.
  // - Nếu đã hoàn tất: 1 lệnh deleteMany — giảm từ ~92 round-trip xuống 1.
  try {
    if (snapshotIds.length) {
      await prisma.snapshotDocument.deleteMany({ where: { snapshotId: { in: snapshotIds } } });
      await prisma.snapshot.deleteMany({ where: { id: { in: snapshotIds } } });
    }
    if (wasBusy) {
      const BATCH = 1000;
      let hasMore = true;
      while (hasMore) {
        const ids = await prisma.document.findMany({
          where: { importId },
          select: { id: true },
          take: BATCH
        });
        if (ids.length === 0) { hasMore = false; break; }
        await prisma.document.deleteMany({ where: { id: { in: ids.map((d) => d.id) } } });
        if (ids.length < BATCH) hasMore = false;
      }
    } else {
      await prisma.document.deleteMany({ where: { importId } });
    }
    await prisma.import.delete({ where: { id: importId } });
  } catch (error) {
    console.error('[deleteImport] failed:', error);
    throw new AppError(500, 'DELETE_FAILED', 'Không thể xóa lần nhập: ' + (error instanceof Error ? error.message : 'unknown error'));
  }

  // Xóa file đã lưu (nếu là file thật, không phải 'pending')
  if (imported.filePath && imported.filePath !== 'pending') {
    try {
      const resolved = await resolveImportFilePath(
        imported.filePath,
        imported.storedFileName,
        imported.id,
        imported.createdAt
      );
      await fs.rm(resolved, { force: true }).catch(() => undefined);
    } catch {
      // Ignore if file cannot be located or is already deleted
    }
  }
  return { deleted: true, deletedSnapshots: snapshotIds.length, wasBusy };
}
