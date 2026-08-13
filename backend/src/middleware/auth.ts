import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
};

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Invalid authentication token');
    req.user = { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'UNAUTHORIZED', 'Invalid authentication token'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(new AppError(403, 'FORBIDDEN', 'Admin permission required'));
  return next();
}
