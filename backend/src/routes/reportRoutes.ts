import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { exportDocuments } from '../services/exportService.js';
import { summary } from '../services/reportService.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationSchema } from '../validators/common.js';

export const reportRoutes = Router();

reportRoutes.use(requireAuth);

reportRoutes.get('/summary', asyncHandler(async (req, res) => {
  const query = paginationSchema.partial().parse(req.query);
  return ok(res, await summary(query));
}));

reportRoutes.get('/export', asyncHandler(async (req, res) => {
  const query = paginationSchema.partial().parse(req.query);
  const buffer = await exportDocuments(query);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="ioffice-report-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return res.send(buffer);
}));
