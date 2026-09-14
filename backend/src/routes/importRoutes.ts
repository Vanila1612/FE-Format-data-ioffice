import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { exportDocuments } from '../services/exportService.js';
import { deleteImport, enqueueImport, getImportStatus, previewImport, reprocessImport } from '../services/importService.js';
import { listDocuments } from '../services/reportService.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';
import { paginationSchema } from '../validators/common.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 }
});

export const importRoutes = Router();

importRoutes.use(requireAuth);

// --- Cụ thể trước, chung chung sau để tránh 404 khi path chứa sub-segment ---

importRoutes.post('/preview', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Excel file is required');
  return ok(res, await previewImport(req.file));
}));

importRoutes.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Excel file is required');
  const result = await enqueueImport(req.file, req.user!.id);
  res.setHeader('Location', `/api/imports/${result.import.id}/status`);
  return ok(res, result, 202);
}));

importRoutes.get('/reprocess-all', requireAdmin, asyncHandler(async (_req, res) => {
  // GET trên "/reprocess-all" sẽ trả 405 hợp lệ; đặt trước :id để Express không coi "reprocess-all" là 1 :id
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST /api/imports/reprocess-all');
}));

importRoutes.post('/reprocess-all', requireAdmin, asyncHandler(async (_req, res) => {
  const imports = await prisma.import.findMany({ where: { status: 'COMPLETED' }, select: { id: true } });
  const results: Array<{ id: string; status: 'ok' | 'error'; enqueued: boolean; error?: string }> = [];
  for (const entry of imports) {
    try {
      await reprocessImport(entry.id);
      results.push({ id: entry.id, status: 'ok', enqueued: true });
    } catch (error) {
      results.push({
        id: entry.id,
        status: 'error',
        enqueued: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  return ok(res, { processed: imports.length, results });
}));

importRoutes.get('/list', asyncHandler(async (_req, res) => {
  const imports = await prisma.import.findMany({
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, username: true, displayName: true } }, _count: { select: { documents: true, snapshots: true } } }
  });
  return ok(res, imports);
}));

importRoutes.get('/:id/status', asyncHandler(async (req, res) => {
  const status = await getImportStatus(param(req, 'id'));
  const progress = status.totalRows > 0 ? Math.min(100, Math.round((status.processedRows / status.totalRows) * 100)) : 0;
  return ok(res, { ...status, progress });
}));

importRoutes.post('/:id/reprocess', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await reprocessImport(param(req, 'id')));
}));

importRoutes.get('/:id/documents', asyncHandler(async (req, res) => {
  const query = paginationSchema.parse({ ...req.query, importId: param(req, 'id') });
  return ok(res, await listDocuments(query, query.page, query.pageSize, query.sortBy, query.sortDir));
}));

importRoutes.get('/:id/export', asyncHandler(async (req, res) => {
  const buffer = await exportDocuments({ importId: param(req, 'id') });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="ioffice-import-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return res.send(buffer);
}));

// Catch-all cho /:id ở cuối
importRoutes.get('/:id', asyncHandler(async (req, res) => {
  const imported = await prisma.import.findUnique({
    where: { id: param(req, 'id') },
    include: { uploadedBy: { select: { id: true, username: true, displayName: true } }, _count: { select: { documents: true, snapshots: true } } }
  });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Import not found');
  return ok(res, imported);
}));

importRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await deleteImport(param(req, 'id')));
}));

importRoutes.get('/', asyncHandler(async (_req, res) => {
  const imports = await prisma.import.findMany({
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, username: true, displayName: true } }, _count: { select: { documents: true, snapshots: true } } }
  });
  return ok(res, imports);
}));

importRoutes.delete('/', requireAdmin, asyncHandler(async (_req, res) => {
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Use DELETE /api/imports/:id');
}));

// Tránh TS error nếu fail helper không import
import { fail } from '../utils/apiResponse.js';
