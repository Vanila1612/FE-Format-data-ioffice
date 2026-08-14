import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { param } from '../utils/request.js';

export const userRoutes = Router();

const roleSchema = z.enum(['ADMIN', 'USER']);
const publicUser = { id: true, username: true, displayName: true, role: true, createdAt: true, updatedAt: true } as const;

userRoutes.use(requireAuth, requireAdmin);

userRoutes.get('/', asyncHandler(async (_req, res) => {
  return ok(res, await prisma.user.findMany({ select: publicUser, orderBy: [{ role: 'asc' }, { username: 'asc' }] }));
}));

userRoutes.post('/', asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string().trim().min(3).max(50), displayName: z.string().trim().min(1).max(100), password: z.string().min(8).max(128), role: roleSchema.default('USER') }).parse(req.body);
  const exists = await prisma.user.findUnique({ where: { username: body.username } });
  if (exists) throw new AppError(409, 'USERNAME_EXISTS', 'Tên đăng nhập đã tồn tại');
  const user = await prisma.user.create({ data: { username: body.username, displayName: body.displayName, passwordHash: await bcrypt.hash(body.password, 12), role: body.role }, select: publicUser });
  return ok(res, user, 201);
}));

userRoutes.put('/:id', asyncHandler(async (req, res) => {
  const body = z.object({ displayName: z.string().trim().min(1).max(100).optional(), password: z.string().min(8).max(128).optional(), role: roleSchema.optional() }).parse(req.body);
  const id = param(req, 'id'); const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
  if (user.role === 'ADMIN' && body.role === 'USER') await ensureAnotherAdmin(id);
  const updated = await prisma.user.update({ where: { id }, data: { ...(body.displayName ? { displayName: body.displayName } : {}), ...(body.password ? { passwordHash: await bcrypt.hash(body.password, 12) } : {}), ...(body.role ? { role: body.role } : {}) }, select: publicUser });
  return ok(res, updated);
}));

userRoutes.delete('/:id', asyncHandler(async (req, res) => {
  const id = param(req, 'id');
  if (req.user!.id === id) throw new AppError(400, 'CANNOT_DELETE_SELF', 'Không thể tự xóa tài khoản đang đăng nhập');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
  if (user.role === 'ADMIN') await ensureAnotherAdmin(id);
  const [importCount, snapshotCount] = await Promise.all([
    prisma.import.count({ where: { uploadedById: id } }),
    prisma.snapshot.count({ where: { createdById: id } })
  ]);
  if (importCount || snapshotCount) throw new AppError(400, 'USER_HAS_DATA', 'Không thể xóa người dùng đã có dữ liệu hoặc kết quả đã lưu');
  await prisma.user.delete({ where: { id } });
  return ok(res, { deleted: true });
}));

async function ensureAnotherAdmin(excludedId: string) {
  const count = await prisma.user.count({ where: { role: 'ADMIN', id: { not: excludedId } } });
  if (count === 0) throw new AppError(400, 'LAST_ADMIN', 'Hệ thống phải luôn có ít nhất một quản trị viên');
}
