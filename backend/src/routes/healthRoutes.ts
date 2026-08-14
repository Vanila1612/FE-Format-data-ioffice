import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRoutes = Router();

healthRoutes.get('/', asyncHandler(async (_req, res) => {
  await prisma.$runCommandRaw({ ping: 1 });
  return ok(res, { status: 'ok' });
}));
