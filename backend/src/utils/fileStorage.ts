import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Resolves an import file path safely across different runtime environments
 * (e.g., local host dev, Docker container, or moved workspace folders).
 *
 * Supports:
 * 1. Exact path if accessible directly on disk.
 * 2. Relative path resolved against env.UPLOAD_DIR.
 * 3. Cross-platform/container translation: extracts relative subpath from legacy absolute paths.
 * 4. Standard directory convention: <UPLOAD_DIR>/<YYYY>/<MM>/import-<id>/<storedFileName>.
 */
export async function resolveImportFilePath(
  filePath: string,
  storedFileName?: string,
  importId?: string,
  createdAt?: Date | null
): Promise<string> {
  if (!filePath || filePath === 'pending') {
    throw new Error('File path is pending or not set');
  }

  // 1. Direct path check
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    // Continue fallback
  }

  // 2. Relative to UPLOAD_DIR
  const resolvedFromUpload = path.resolve(env.UPLOAD_DIR, filePath);
  try {
    await fs.access(resolvedFromUpload);
    return resolvedFromUpload;
  } catch {
    // Continue fallback
  }

  // 3. Absolute path from another machine/container (e.g. /Volumes/... or /app/...)
  const normalized = filePath.replace(/\\/g, '/');
  const uploadMatch = normalized.match(/(?:^|\/)(?:storage\/)?uploads\/(.+)$/);
  if (uploadMatch) {
    const fromUpload = path.resolve(env.UPLOAD_DIR, uploadMatch[1]);
    try {
      await fs.access(fromUpload);
      return fromUpload;
    } catch {
      // Continue fallback
    }
  }

  // 4. Standard directory structure: <UPLOAD_DIR>/<YYYY>/<MM>/import-<id>/<storedFileName>
  if (storedFileName && importId) {
    const datesToTry: Date[] = [];
    if (createdAt) datesToTry.push(new Date(createdAt));
    datesToTry.push(new Date());

    for (const d of datesToTry) {
      const year = String(d.getUTCFullYear());
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const standardPath = path.resolve(env.UPLOAD_DIR, year, month, `import-${importId}`, storedFileName);
      try {
        await fs.access(standardPath);
        return standardPath;
      } catch {
        // Continue fallback
      }
    }
  }

  throw new Error(`Original file missing on disk: ${filePath}`);
}
