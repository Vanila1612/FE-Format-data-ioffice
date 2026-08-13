import { DocumentGroup } from '@prisma/client';
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  importId: z.string().optional(),
  unit: z.string().optional(),
  group: z.nativeEnum(DocumentGroup).optional(),
  sortBy: z.enum(['createdAt', 'issueDate', 'referenceNumber', 'summary', 'normalizedUnit', 'documentGroup']).default('issueDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
});
