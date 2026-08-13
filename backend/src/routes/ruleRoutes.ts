import { Router } from 'express';
import { DocumentGroup } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';

export const ruleRoutes = Router();

const ruleSchema = z.object({
  name: z.string().min(1),
  keyword: z.string().min(1),
  documentGroup: z.nativeEnum(DocumentGroup),
  priority: z.coerce.number().int().min(0),
  enabled: z.boolean().default(true)
});

ruleRoutes.use(requireAuth);

ruleRoutes.get('/', asyncHandler(async (_req, res) => {
  const rules = await prisma.classificationRule.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] });
  return ok(res, rules);
}));

ruleRoutes.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const body = ruleSchema.parse(req.body);
  return ok(res, await prisma.classificationRule.create({ data: body }), 201);
}));

ruleRoutes.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const body = ruleSchema.partial().parse(req.body);
  return ok(res, await prisma.classificationRule.update({ where: { id: param(req, 'id') }, data: body }));
}));

ruleRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.classificationRule.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw new AppError(404, 'RULE_NOT_FOUND', 'Rule not found');
  await prisma.classificationRule.delete({ where: { id: param(req, 'id') } });
  return ok(res, { deleted: true });
}));
