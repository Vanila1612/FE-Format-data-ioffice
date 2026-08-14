import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { exportDocuments } from '../services/exportService.js';
import { createImport, deleteImport, previewImport, reprocessImport } from '../services/importService.js';
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

importRoutes.post('/preview', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Excel file is required');
  return ok(res, await previewImport(req.file));
}));

importRoutes.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Excel file is required');
  return ok(res, await createImport(req.file, req.user!.id), 201);
}));

importRoutes.get('/', asyncHandler(async (_req, res) => {
  const imports = await prisma.import.findMany({
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, username: true, displayName: true } }, _count: { select: { documents: true, snapshots: true } } }
  });
  return ok(res, imports);
}));

// Rebuilds documents from the original uploaded file. This fixes imports made
// before duplicate rows were preserved, without asking the user to upload again.
importRoutes.post('/:id/reprocess', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await reprocessImport(param(req, 'id')));
}));

importRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await deleteImport(param(req, 'id')));
}));

importRoutes.get('/:id', asyncHandler(async (req, res) => {
  const imported = await prisma.import.findUnique({
    where: { id: param(req, 'id') },
    include: { uploadedBy: { select: { id: true, username: true, displayName: true } }, _count: { select: { documents: true, snapshots: true } } }
  });
  if (!imported) throw new AppError(404, 'IMPORT_NOT_FOUND', 'Import not found');
  return ok(res, imported);
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
