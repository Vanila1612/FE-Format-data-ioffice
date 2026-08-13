import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ioffice:ioffice@localhost:5432/ioffice_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-me';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    $queryRaw: queryRaw
  }
}));

const { createApp } = await import('../src/app.js');

describe('api envelope', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('returns standard health response', async () => {
    const response = await request(createApp()).get('/api/health').expect(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('returns standard not found error response', async () => {
    const response = await request(createApp()).get('/api/missing').expect(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
