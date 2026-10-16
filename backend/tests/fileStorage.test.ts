process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/ioffice_test';

import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { env } = await import('../src/config/env.js');
const { resolveImportFilePath } = await import('../src/utils/fileStorage.js');

describe('resolveImportFilePath', () => {
  const testDir = path.resolve(env.UPLOAD_DIR, '2026', '10', 'import-test-storage');
  const fileName = '12345-sample.xlsx';
  const diskPath = path.join(testDir, fileName);

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(diskPath, 'fake-excel-content');
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('resolves exact absolute disk path', async () => {
    const resolved = await resolveImportFilePath(diskPath);
    expect(resolved).toBe(diskPath);
  });

  it('resolves relative path relative to env.UPLOAD_DIR', async () => {
    const relPath = path.join('2026', '10', 'import-test-storage', fileName);
    const resolved = await resolveImportFilePath(relPath);
    expect(resolved).toBe(diskPath);
  });

  it('translates legacy absolute path from another machine/container', async () => {
    const foreignAbsolutePath = `/var/other/storage/uploads/2026/10/import-test-storage/${fileName}`;
    const resolved = await resolveImportFilePath(foreignAbsolutePath);
    expect(resolved).toBe(diskPath);
  });

  it('resolves via standard directory structure fallback using importId and storedFileName', async () => {
    const wrongPath = '/non/existent/path/file.xlsx';
    const resolved = await resolveImportFilePath(
      wrongPath,
      fileName,
      'test-storage',
      new Date('2026-10-15T00:00:00Z')
    );
    expect(resolved).toBe(diskPath);
  });

  it('throws descriptive error if file truly does not exist', async () => {
    await expect(
      resolveImportFilePath('/totally/missing/file.xlsx', 'missing.xlsx', 'non-existent-id')
    ).rejects.toThrow('Original file missing on disk: /totally/missing/file.xlsx');
  });
});
