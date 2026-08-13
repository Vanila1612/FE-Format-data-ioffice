import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { login } from '../services/authService.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRoutes = Router();

authRoutes.post('/login', asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
  return ok(res, await login(body.username, body.password));
}));

authRoutes.get('/me', requireAuth, asyncHandler(async (req, res) => ok(res, req.user)));
