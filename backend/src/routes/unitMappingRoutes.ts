import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';

export const unitMappingRoutes = Router();

const mappingSchema = z.object({
  sourceName: z.string().trim().min(1),
  normalizedName: z.string().trim().min(1)
});

unitMappingRoutes.use(requireAuth);

unitMappingRoutes.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '');
  const mappings = await prisma.unitMapping.findMany({
    where: search ? { OR: [
      { sourceName: { contains: search, mode: 'insensitive' } },
      { normalizedName: { contains: search, mode: 'insensitive' } }
    ] } : undefined,
    orderBy: { updatedAt: 'desc' }
  });
  return ok(res, mappings);
}));

unitMappingRoutes.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const body = mappingSchema.parse(req.body);
  const exists = await prisma.unitMapping.findFirst({
    where: { sourceName: { equals: body.sourceName, mode: 'insensitive' } }
  });
  if (exists) throw new AppError(409, 'UNIT_MAPPING_EXISTS', 'Tên đơn vị nguồn đã tồn tại');

  try {
    return ok(res, await prisma.unitMapping.create({ data: { ...body, enabled: true } }), 201);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new AppError(409, 'UNIT_MAPPING_EXISTS', 'Tên đơn vị nguồn đã tồn tại');
    }
    throw err;
  }
}));

unitMappingRoutes.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const body = mappingSchema.partial().parse(req.body);
  const id = param(req, 'id');
  const existing = await prisma.unitMapping.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'UNIT_MAPPING_NOT_FOUND', 'Không tìm thấy quy đổi đơn vị');

  if (body.sourceName) {
    const duplicate = await prisma.unitMapping.findFirst({
      where: {
        sourceName: { equals: body.sourceName, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (duplicate) {
      throw new AppError(409, 'UNIT_MAPPING_EXISTS', 'Tên đơn vị nguồn đã tồn tại');
    }
  }

  try {
    return ok(res, await prisma.unitMapping.update({ where: { id }, data: { ...body, enabled: true } }));
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new AppError(409, 'UNIT_MAPPING_EXISTS', 'Tên đơn vị nguồn đã tồn tại');
    }
    throw err;
  }
}));

unitMappingRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.unitMapping.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw new AppError(404, 'UNIT_MAPPING_NOT_FOUND', 'Không tìm thấy quy đổi đơn vị');
  await prisma.unitMapping.delete({ where: { id: param(req, 'id') } });
  return ok(res, { deleted: true });
}));
