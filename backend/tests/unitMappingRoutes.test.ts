import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/ioffice_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-me';

const findMany = vi.fn();
const findFirst = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const deleteFn = vi.fn();

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    unitMapping: {
      findMany,
      findFirst,
      findUnique,
      create,
      update,
      delete: deleteFn
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'admin-id', role: 'ADMIN', username: 'admin' })
    },
    $runCommandRaw: vi.fn()
  }
}));

const { createApp } = await import('../src/app.js');

describe('unit mapping routes', () => {
  const token = jwt.sign({ sub: 'admin-id', role: 'ADMIN' }, process.env.JWT_SECRET!);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated listing', async () => {
    const response = await request(createApp()).get('/api/unit-mappings').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries unit mappings ordered by updatedAt descending', async () => {
    const mockMappings = [
      { id: '1', sourceName: 'Ban KHCL', normalizedName: 'Ban Kế hoạch', updatedAt: new Date('2026-10-14T10:00:00Z') },
      { id: '2', sourceName: 'Ban CN', normalizedName: 'Ban Công nghệ', updatedAt: new Date('2026-10-14T09:00:00Z') }
    ];
    findMany.mockResolvedValue(mockMappings);

    const response = await request(createApp())
      .get('/api/unit-mappings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { updatedAt: 'desc' }
    });
    expect(response.body.data).toHaveLength(2);
  });
});
