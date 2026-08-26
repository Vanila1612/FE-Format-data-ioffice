import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';

export const signerRoutes = Router();

const signerSchema = z.object({
  username: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  position: z.string().trim().min(1)
});

signerRoutes.use(requireAuth);

signerRoutes.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const position = String(req.query.position || '').trim();
  const signers = await prisma.signer.findMany({
    where: {
      position: position || undefined,
      OR: search ? [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } }
      ] : undefined
    },
    orderBy: { username: 'asc' }
  });
  return ok(res, signers);
}));

signerRoutes.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const body = signerSchema.parse(req.body);
  if (await prisma.signer.findUnique({ where: { username: body.username } })) throw new AppError(409, 'SIGNER_EXISTS', 'Signer username already exists');
  return ok(res, await prisma.signer.create({ data: body }), 201);
}));

signerRoutes.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const body = signerSchema.partial().parse(req.body);
  const id = param(req, 'id');
  if (!(await prisma.signer.findUnique({ where: { id } }))) throw new AppError(404, 'SIGNER_NOT_FOUND', 'Signer not found');
  return ok(res, await prisma.signer.update({ where: { id }, data: body }));
}));

signerRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = param(req, 'id');
  if (!(await prisma.signer.findUnique({ where: { id } }))) throw new AppError(404, 'SIGNER_NOT_FOUND', 'Signer not found');
  await prisma.signer.delete({ where: { id } });
  return ok(res, { deleted: true });
}));
