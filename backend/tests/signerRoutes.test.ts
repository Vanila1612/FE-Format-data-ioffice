import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/ioffice_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-me';

const findMany = vi.fn();
const findFirst = vi.fn();
const findUniqueSigner = vi.fn();
const createSigner = vi.fn();
const updateSigner = vi.fn();
const findUniqueUser = vi.fn();

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findUnique: findUniqueUser },
    signer: {
      findMany,
      findFirst,
      findUnique: findUniqueSigner,
      create: createSigner,
      update: updateSigner
    },
    $runCommandRaw: vi.fn()
  }
}));

const { createApp } = await import('../src/app.js');

describe('signer routes', () => {
  const adminToken = jwt.sign({ sub: 'admin-1' }, process.env.JWT_SECRET!);

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueUser.mockResolvedValue({ id: 'admin-1', username: 'admin', displayName: 'Admin', role: 'ADMIN' });
  });

  it('rejects unauthenticated listing', async () => {
    const response = await request(createApp()).get('/api/signers').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects creating a signer with an existing username with 409 and clear message', async () => {
    findFirst.mockResolvedValue({ id: 'signer-1', username: 'hoangminhngoc' });

    const response = await request(createApp())
      .post('/api/signers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'hoangminhngoc', fullName: 'Hoàng Minh Ngọc', position: 'Phó Tổng Giám đốc' })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SIGNER_EXISTS');
    expect(response.body.error.message).toBe('Tên đăng nhập đã tồn tại');
    expect(createSigner).not.toHaveBeenCalled();
  });

  it('rejects updating a signer when new username belongs to another signer', async () => {
    findUniqueSigner.mockResolvedValue({ id: 'signer-2', username: 'a', fullName: 'Nguyễn Văn A', position: 'Nhân viên' });
    findFirst.mockResolvedValue({ id: 'signer-1', username: 'hoangminhngoc' });

    const response = await request(createApp())
      .put('/api/signers/signer-2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'hoangminhngoc', fullName: 'Đào Thị Thúy', position: 'Nhân viên' })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SIGNER_EXISTS');
    expect(response.body.error.message).toBe('Tên đăng nhập đã tồn tại');
    expect(updateSigner).not.toHaveBeenCalled();
  });

  it('allows updating a signer without changing username', async () => {
    findUniqueSigner.mockResolvedValue({ id: 'signer-2', username: 'hoangminhngoc', fullName: 'Hoàng Minh Ngọc', position: 'Nhân viên' });
    updateSigner.mockResolvedValue({ id: 'signer-2', username: 'hoangminhngoc', fullName: 'Hoàng Minh Ngọc', position: 'Phó Tổng Giám đốc' });

    const response = await request(createApp())
      .put('/api/signers/signer-2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'hoangminhngoc', fullName: 'Hoàng Minh Ngọc', position: 'Phó Tổng Giám đốc' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(updateSigner).toHaveBeenCalled();
  });
});
