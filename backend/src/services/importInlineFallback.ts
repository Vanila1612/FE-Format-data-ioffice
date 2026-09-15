import { prisma } from '../config/prisma.js';
import { runImportCore } from '../jobs/importProcessor.js';

export type InlineImportInput = {
  importId: string;
  filePath?: string;
  totalRows?: number;
};

/**
 * Fallback chạy inline khi Redis queue không khả dụng.
 * Dùng lại core logic của worker nhưng chạy đồng bộ trong request.
 * Lưu ý: với file rất lớn (>50k dòng) sẽ chiếm HTTP request lâu — chỉ nên fallback khi Redis thật sự không chạy.
 */
export async function processImportInline(input: InlineImportInput): Promise<void> {
  await runImportCore(input.importId);
}
