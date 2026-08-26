import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/ioffice_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-me';

const findMany = vi.fn();

vi.mock('../src/config/prisma.js', () => ({
  prisma: { signer: { findMany }, $runCommandRaw: vi.fn() }
}));

const { createApp } = await import('../src/app.js');

describe('signer routes', () => {
  it('rejects unauthenticated listing', async () => {
    const response = await request(createApp()).get('/api/signers').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(findMany).not.toHaveBeenCalled();
  });
});
