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
  sourceName: z.string().min(1),
  normalizedName: z.string().min(1),
  enabled: z.boolean().default(true)
});

unitMappingRoutes.use(requireAuth);

unitMappingRoutes.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '');
  const mappings = await prisma.unitMapping.findMany({
    where: search ? { OR: [
      { sourceName: { contains: search, mode: 'insensitive' } },
      { normalizedName: { contains: search, mode: 'insensitive' } }
    ] } : undefined,
    orderBy: { sourceName: 'asc' }
  });
  return ok(res, mappings);
}));

unitMappingRoutes.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const body = mappingSchema.parse(req.body);
  return ok(res, await prisma.unitMapping.create({ data: body }), 201);
}));

unitMappingRoutes.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const body = mappingSchema.partial().parse(req.body);
  return ok(res, await prisma.unitMapping.update({ where: { id: param(req, 'id') }, data: body }));
}));

unitMappingRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.unitMapping.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw new AppError(404, 'UNIT_MAPPING_NOT_FOUND', 'Unit mapping not found');
  await prisma.unitMapping.delete({ where: { id: param(req, 'id') } });
  return ok(res, { deleted: true });
}));
