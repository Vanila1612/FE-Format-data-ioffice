import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/ioffice_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-me';

const importFindFirst = vi.fn();
const importCreate = vi.fn();
const importUpdate = vi.fn();

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    import: {
      findFirst: importFindFirst,
      create: importCreate,
      update: importUpdate
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'admin-id', role: 'ADMIN', username: 'admin' })
    },
    $runCommandRaw: vi.fn()
  }
}));

vi.mock('../src/jobs/importQueue.js', () => ({
  getImportQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'job-123' })
  }),
  hasRedis: vi.fn().mockReturnValue(true)
}));

const { createApp } = await import('../src/app.js');

function createSampleExcelBuffer(): Buffer {
  const rows = [
    ['STT', 'Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành', 'Người ký chính'],
    ['1', 'Công văn 1', '100/CV-VP', 'Đã ký số', '2026-08-01', 'Văn phòng TSC', 'Nguyễn Văn A']
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('import deduplication protection', () => {
  const token = jwt.sign({ sub: 'admin-id', role: 'ADMIN' }, process.env.JWT_SECRET!);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects upload when identical file is already PROCESSING', async () => {
    importFindFirst.mockResolvedValueOnce({
      id: 'existing-import-id',
      originalFileName: 'test.xlsx',
      status: 'PROCESSING'
    });

    const buffer = createSampleExcelBuffer();
    const response = await request(createApp())
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx')
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('IMPORT_ALREADY_PROCESSING');
    expect(response.body.error.message).toContain('đang trong quá trình xử lý');
    expect(importCreate).not.toHaveBeenCalled();
  });

  it('rejects upload when identical file has already been COMPLETED without changes', async () => {
    // First findFirst for ongoing -> null
    importFindFirst.mockResolvedValueOnce(null);
    // Second findFirst for completed duplicate -> returns existing completed import
    importFindFirst.mockResolvedValueOnce({
      id: 'completed-import-id',
      originalFileName: 'test.xlsx',
      status: 'COMPLETED',
      totalRows: 1
    });

    const buffer = createSampleExcelBuffer();
    const response = await request(createApp())
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx')
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DUPLICATE_IMPORT');
    expect(response.body.error.message).toContain('đã được lưu vào hệ thống trước đó');
    expect(importCreate).not.toHaveBeenCalled();
  });

  it('allows upload when no ongoing or completed duplicate exists', async () => {
    importFindFirst.mockResolvedValue(null);
    importCreate.mockResolvedValue({
      id: 'new-import-id',
      originalFileName: 'test.xlsx',
      fileSize: 1000,
      status: 'PROCESSING',
      totalRows: 1,
      processedRows: 0,
      uploadedById: 'admin-id'
    });
    importUpdate.mockResolvedValue({ id: 'new-import-id' });

    const buffer = createSampleExcelBuffer();
    const response = await request(createApp())
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx')
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.data.import.id).toBe('new-import-id');
    expect(importCreate).toHaveBeenCalled();
  });
});
