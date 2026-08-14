import { z } from 'zod';
import { DocumentGroup } from '../services/documentGroups.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  importId: z.string().optional(),
  unit: z.string().optional(),
  group: z.enum([DocumentGroup.REPORT_PROPOSAL, DocumentGroup.LETTER_AUTHORIZATION, DocumentGroup.WORK_LETTER]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'issueDate', 'referenceNumber', 'summary', 'normalizedUnit', 'documentGroup']).default('issueDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
});

export const documentFiltersSchema = paginationSchema.pick({
  importId: true,
  search: true,
  unit: true,
  group: true,
  from: true,
  to: true
});
