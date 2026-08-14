import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { exportSnapshot } from '../services/exportService.js';
import { compareSnapshots, createSnapshot, snapshotReport } from '../services/snapshotService.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';
import { documentFiltersSchema, paginationSchema } from '../validators/common.js';

export const snapshotRoutes = Router();

snapshotRoutes.use(requireAuth);

snapshotRoutes.get('/', asyncHandler(async (_req, res) => {
  const snapshots = await prisma.snapshot.findMany({
    include: {
      import: true,
      createdBy: { select: { id: true, username: true, displayName: true } },
      ruleVersion: true,
      _count: { select: { documents: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  return ok(res, snapshots);
}));

snapshotRoutes.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    importId: z.string().min(1).optional(),
    filters: documentFiltersSchema.optional()
  }).parse(req.body);
  return ok(res, await createSnapshot({ ...body, createdById: req.user!.id }), 201);
}));

snapshotRoutes.get('/:id/report', asyncHandler(async (req, res) => {
  return ok(res, await snapshotReport(param(req, 'id')));
}));

snapshotRoutes.get('/compare', asyncHandler(async (req, res) => {
  const query = z.object({ leftId: z.string(), rightId: z.string() }).parse(req.query);
  return ok(res, await compareSnapshots(query.leftId, query.rightId));
}));

snapshotRoutes.get('/:id', asyncHandler(async (req, res) => {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: param(req, 'id') },
    include: {
      import: true,
      createdBy: { select: { id: true, username: true, displayName: true } },
      ruleVersion: true,
      _count: { select: { documents: true } }
    }
  });
  if (!snapshot) throw new AppError(404, 'SNAPSHOT_NOT_FOUND', 'Snapshot not found');
  return ok(res, snapshot);
}));

snapshotRoutes.get('/:id/documents', asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const [total, items] = await Promise.all([
    prisma.snapshotDocument.count({ where: { snapshotId: param(req, 'id') } }),
    prisma.snapshotDocument.findMany({
      where: { snapshotId: param(req, 'id') },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { referenceNumber: 'asc' }
    })
  ]);
  return ok(res, { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) });
}));

snapshotRoutes.get('/:id/export', asyncHandler(async (req, res) => {
  const buffer = await exportSnapshot(param(req, 'id'));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="ioffice-snapshot-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return res.send(buffer);
}));

snapshotRoutes.delete('/:id', asyncHandler(async (req, res) => {
  const id = param(req, 'id');
  const snapshot = await prisma.snapshot.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!snapshot) throw new AppError(404, 'SNAPSHOT_NOT_FOUND', 'Không tìm thấy kết quả đã lưu');
  if (req.user!.role !== 'ADMIN' && snapshot.createdById !== req.user!.id) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xóa kết quả này');
  await prisma.$transaction(async (tx) => { await tx.snapshotDocument.deleteMany({ where: { snapshotId: id } }); await tx.snapshot.delete({ where: { id } }); });
  return ok(res, { deleted: true });
}));
