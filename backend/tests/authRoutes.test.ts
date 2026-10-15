import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/ioffice_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-me';

const findUnique = vi.fn();

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findUnique },
    $runCommandRaw: vi.fn()
  }
}));

const { createApp } = await import('../src/app.js');

describe('auth routes and user session validation', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('rejects /api/auth/me without token', async () => {
    const response = await request(createApp()).get('/api/auth/me').expect(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects /api/auth/me when user has been deleted from database', async () => {
    const token = jwt.sign({ sub: 'deleted-user-id', role: 'USER' }, process.env.JWT_SECRET!);
    findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toBe('Invalid authentication token');
  });

  it('returns user data on /api/auth/me when user exists', async () => {
    const token = jwt.sign({ sub: 'valid-user-id', role: 'USER' }, process.env.JWT_SECRET!);
    findUnique.mockResolvedValue({
      id: 'valid-user-id',
      username: 'userA',
      displayName: 'User A',
      role: 'USER'
    });

    const response = await request(createApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: 'valid-user-id',
      username: 'userA',
      displayName: 'User A',
      role: 'USER'
    });
  });
});
