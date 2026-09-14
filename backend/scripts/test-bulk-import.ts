import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const FILE = path.resolve(process.argv[2] || 'storage/tmp/bulk-sample.xlsx');

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; error: { code: string; message: string } };

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  });
  const json = (await res.json()) as ApiOk<{ token: string }> | ApiErr;
  if (!json.success) throw new Error(`Login failed: ${json.error.message}`);
  return json.data.token;
}

async function upload(token: string): Promise<string> {
  const blob = await fs.readFile(FILE);
  const form = new FormData();
  form.append('file', new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(FILE));
  const res = await fetch(`${BASE_URL}/api/imports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const json = (await res.json()) as ApiOk<{ import: { id: string; totalRows: number } }> | ApiErr;
  if (!json.success) throw new Error(`Upload failed: ${json.error.message}`);
  console.log(`[upload] 202 Accepted → importId = ${json.data.import.id} | totalRows = ${json.data.import.totalRows}`);
  return json.data.import.id;
}

async function pollStatus(token: string, importId: string): Promise<void> {
  const start = Date.now();
  let lastProgress = -1;
  const timeoutMs = 30 * 60 * 1000;
  while (true) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Polling timeout after ${Math.floor(timeoutMs / 60000)}m`);
    }
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${BASE_URL}/api/imports/${importId}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = (await res.json()) as ApiOk<{
      status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UPLOADED';
      totalRows: number;
      processedRows: number;
      successRows: number;
      failedRows: number;
      progress: number;
      errorMessage: string | null;
    }> | ApiErr;
    if (!json.success) {
      console.warn(`[poll] error: ${json.error.message}`);
      continue;
    }
    const s = json.data;
    if (s.progress !== lastProgress) {
      console.log(`[poll] ${s.status.padEnd(10)} | ${s.processedRows.toLocaleString('en-US')}/${s.totalRows.toLocaleString('en-US')} (${s.progress}%) | ${Math.round((Date.now() - start) / 1000)}s`);
      lastProgress = s.progress;
    }
    if (s.status === 'COMPLETED') {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`\n✓ DONE in ${elapsed}s`);
      console.log(`  rows inserted : ${s.successRows.toLocaleString('en-US')}`);
      console.log(`  rows skipped  : ${(s.totalRows - s.successRows).toLocaleString('en-US')}`);
      return;
    }
    if (s.status === 'FAILED') {
      throw new Error(`Import FAILED: ${s.errorMessage}`);
    }
  }
}

async function verifyDb(token: string, importId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/documents?importId=${importId}&pageSize=1&page=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = (await res.json()) as ApiOk<{ total: number }> | ApiErr;
  if (!json.success) throw new Error(`verify failed: ${json.error.message}`);
  console.log(`\n[verify] documents in DB for this import: ${json.data.total.toLocaleString('en-US')}`);
}

async function main() {
  console.log(`[test-bulk-import] file : ${FILE}`);
  const stat = await fs.stat(FILE).catch(() => null);
  if (!stat) {
    console.error(`File not found: ${FILE}. Run gen-bulk-excel.ts first.`);
    process.exit(1);
  }
  console.log(`[test-bulk-import] size : ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[test-bulk-import] api  : ${BASE_URL}\n`);

  const token = await login();
  console.log('[login] OK');
  const importId = await upload(token);
  await pollStatus(token, importId);
  await verifyDb(token, importId);
}

main().catch((error) => {
  console.error('\n✗ FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
