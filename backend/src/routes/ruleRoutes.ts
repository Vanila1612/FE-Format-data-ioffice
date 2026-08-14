import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';
import { DocumentGroup } from '../services/documentGroups.js';

export const ruleRoutes = Router();

const ruleSchema = z.object({
  keyword: z.string().trim().min(1),
  documentGroup: z.enum([DocumentGroup.REPORT_PROPOSAL, DocumentGroup.LETTER_AUTHORIZATION, DocumentGroup.WORK_LETTER]),
  priority: z.coerce.number().int().min(0).optional()
});

ruleRoutes.use(requireAuth);

ruleRoutes.get('/', asyncHandler(async (_req, res) => {
  const rules = await prisma.classificationRule.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] });
  return ok(res, rules);
}));

ruleRoutes.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const body = ruleSchema.parse(req.body);
  return ok(res, await prisma.classificationRule.create({ data: { ...body, priority: body.priority ?? 50, name: body.keyword, enabled: true } }), 201);
}));

ruleRoutes.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const body = ruleSchema.partial().parse(req.body);
  return ok(res, await prisma.classificationRule.update({ where: { id: param(req, 'id') }, data: { ...body, enabled: true } }));
}));

ruleRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.classificationRule.findUnique({ where: { id: param(req, 'id') } });
  if (!existing) throw new AppError(404, 'RULE_NOT_FOUND', 'Rule not found');
  await prisma.classificationRule.delete({ where: { id: param(req, 'id') } });
  return ok(res, { deleted: true });
}));
