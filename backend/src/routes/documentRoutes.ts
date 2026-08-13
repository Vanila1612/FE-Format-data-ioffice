import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { listDocuments } from '../services/reportService.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';
import { paginationSchema } from '../validators/common.js';

export const documentRoutes = Router();

documentRoutes.use(requireAuth);

documentRoutes.get('/', asyncHandler(async (req, res) => {
  const query = paginationSchema.parse(req.query);
  return ok(res, await listDocuments(query, query.page, query.pageSize, query.sortBy, query.sortDir));
}));

documentRoutes.get('/:id', asyncHandler(async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: param(req, 'id') }, include: { import: true } });
  if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  return ok(res, document);
}));
