import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';
import {
  buildDocumentWhere,
  summaryFromDocuments,
  type DocumentFilters
} from './reportService.js';
import { DocumentGroup, documentGroupLabels } from './documentGroups.js';

export type ChatTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolName =
  | 'get_top_units_by_completion'
  | 'get_top_units_by_volume'
  | 'get_document_groups_breakdown'
  | 'get_report_summary'
  | 'get_completion_trend'
  | 'search_documents'
  | 'get_documents_by_unit';

const dateRange = {
  type: 'object',
  properties: {
    from: { type: 'string', description: 'ISO date (yyyy-mm-dd) hoặc ISO datetime — bao gồm từ ngày này trở đi.' },
    to: { type: 'string', description: 'ISO date (yyyy-mm-dd) hoặc ISO datetime — đến ngày này (bao gồm).' }
  },
  additionalProperties: false
} as const;

function parseRange(args: { from?: string; to?: string }): { from?: Date; to?: Date } {
  const out: { from?: Date; to?: Date } = {};
  if (args.from) {
    const d = new Date(args.from);
    if (Number.isNaN(d.getTime())) throw new AppError(400, 'INVALID_DATE', `from không hợp lệ: ${args.from}`);
    out.from = d;
  }
  if (args.to) {
    const d = new Date(args.to);
    if (Number.isNaN(d.getTime())) throw new AppError(400, 'INVALID_DATE', `to không hợp lệ: ${args.to}`);
    out.to = d;
  }
  return out;
}

export const chatTools: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_top_units_by_completion',
      description: 'DÙNG KHI user hỏi về TỶ LỆ KÝ. Các từ khóa đặc trưng: "tỷ lệ ký", "hiệu suất xử lý", "xử lý xong" ở nghĩa đã ký/hoàn tất, tỷ lệ hoàn thành, % đã ký. Sắp xếp ưu tiên theo signRate giảm dần, tie-break bởi tổng văn bản. KHÔNG dùng khi user nói "nhiều nhất", "phát hành nhiều" — khi đó dùng get_top_units_by_volume.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Số lượng đơn vị trả về (mặc định 10).' },
          sortBy: { type: 'string', enum: ['completion_rate', 'total_documents'], default: 'completion_rate', description: 'Tiêu chí sắp xếp.' },
          ...dateRange.properties
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_top_units_by_volume',
      description: 'DÙNG KHI user hỏi về TỔNG SỐ VĂN BẢN đã phát hành. Các từ khóa đặc trưng: "nhiều nhất", "phát hành nhiều", "ban hành nhiều", "số lượng văn bản", "xử lý xong" ở nghĩa đã phát hành (không quan tâm ký hay chưa). Sắp xếp theo totalDocuments giảm dần. Kèm thêm tỷ lệ ký nhưng KHÔNG dùng để xếp hạng tỷ lệ.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          ...dateRange.properties
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_document_groups_breakdown',
      description: 'DÙNG KHI user hỏi về PHÂN BỔ THEO NHÓM văn bản. Các từ khóa đặc trưng: "theo nhóm", "3 nhóm", "Báo cáo/Tờ trình", "Công văn/Ủy quyền", "Thư công tác", "tỷ lệ ký của từng nhóm". Trả về 3 nhóm cố định, kèm tổng số, tỷ lệ ký và share. KHÔNG dùng khi user muốn xem chi tiết từng đơn vị — dùng get_top_units_by_*.',
      parameters: {
        type: 'object',
        properties: { ...dateRange.properties },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_report_summary',
      description: 'DÙNG KHI user hỏi về TỔNG QUAN / ĐẾM SỐ chung. Các từ khóa đặc trưng: "tổng có bao nhiêu", "bao nhiêu văn bản", "tổng kết", "tóm tắt", "tổng quan", "dashboard". Trả về 4 số tổng: tổng văn bản, đã ký, chưa ký, tỷ lệ ký. Hỗ trợ filter importId/unit/group/search/date. KHÔNG dùng khi user muốn xếp hạng top — dùng get_top_units_by_*.',
      parameters: {
        type: 'object',
        properties: {
          importId: { type: 'string', description: 'Lọc theo import cụ thể.' },
          unit: { type: 'string', description: 'Lọc theo normalizedUnit (contains).' },
          group: { type: 'string', enum: ['REPORT_PROPOSAL', 'LETTER_AUTHORIZATION', 'WORK_LETTER'] },
          search: { type: 'string' },
          ...dateRange.properties
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_completion_trend',
      description: 'DÙNG KHI user hỏi về XU HƯỚNG / BIẾN ĐỘNG theo thời gian. Các từ khóa đặc trưng: "xu hướng", "theo tháng", "theo tuần", "theo ngày", "6 tháng gần nhất", "diễn biến", "tăng hay giảm". Bucket: day hoặc month. KHÔNG dùng khi user chỉ muốn 1 con số tổng — dùng get_report_summary.',
      parameters: {
        type: 'object',
        properties: {
          bucket: { type: 'string', enum: ['day', 'month'], default: 'month' },
          ...dateRange.properties
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_documents',
      description: 'DÙNG KHI user muốn TÌM VĂN BẢN CỤ THỂ bằng từ khóa / số hiệu / trích yếu. Các từ khóa đặc trưng: "tìm văn bản", "tìm kiếm", "văn bản có số", "trích yếu chứa", "văn bản về chủ đề". Tìm trên summary, referenceNumber, issuingUnit, normalizedUnit. KHÔNG dùng khi user đã chỉ định đơn vị — dùng get_documents_by_unit nhanh hơn.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          ...dateRange.properties
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_documents_by_unit',
      description: 'DÙNG KHI user đã biết ĐƠN VỊ cụ thể và muốn xem văn bản của đơn vị đó. Các từ khóa đặc trưng: "của đơn vị X", "đơn vị X phát hành", "văn bản của X", "liệt kê của X", "của ALCO", "của Hội sở", "của Chi nhánh Cần Thơ". Lọc theo normalizedUnit contains. KHÔNG dùng khi user muốn xếp hạng nhiều đơn vị — dùng get_top_units_by_*.',
      parameters: {
        type: 'object',
        properties: {
          unit: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          ...dateRange.properties
        },
        required: ['unit'],
        additionalProperties: false
      }
    }
  }
];

async function loadDocuments(filters: DocumentFilters) {
  const where = buildDocumentWhere(filters);
  return prisma.document.findMany({
    where,
    select: {
      id: true,
      summary: true,
      referenceNumber: true,
      signedDocument: true,
      issueDate: true,
      issuingUnit: true,
      normalizedUnit: true,
      documentGroup: true
    },
    orderBy: { issueDate: 'desc' }
  });
}

function truncate(value: string, max = 200): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function groupLabel(group: keyof typeof documentGroupLabels | string): string {
  if (group in documentGroupLabels) return documentGroupLabels[group as keyof typeof documentGroupLabels];
  return String(group);
}

async function getTopUnitsByCompletion(args: {
  limit?: number;
  sortBy?: 'completion_rate' | 'total_documents';
  from?: string;
  to?: string;
}) {
  const limit = args.limit ?? 10;
  const range = parseRange(args);
  const docs = await loadDocuments({ from: range.from, to: range.to });
  const summary = summaryFromDocuments(docs);

  const rows = summary.boardRows
    .filter((row) => row.totalDocuments > 0)
    .map((row) => ({
      unit: row.unit,
      totalDocuments: row.totalDocuments,
      signed: row.totalSigned,
      signRate: row.totalRate,
      byGroup: {
        REPORT_PROPOSAL: { total: row.reportTotal, signed: row.reportSigned, rate: row.reportRate },
        LETTER_AUTHORIZATION: { total: row.letterTotal, signed: row.letterSigned, rate: row.letterRate },
        WORK_LETTER: { total: row.workTotal, signed: row.workSigned, rate: row.workRate }
      }
    }));

  const sortBy = args.sortBy ?? 'completion_rate';
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'completion_rate') {
      if (b.signRate !== a.signRate) return b.signRate - a.signRate;
      if (b.totalDocuments !== a.totalDocuments) return b.totalDocuments - a.totalDocuments;
    } else {
      if (b.totalDocuments !== a.totalDocuments) return b.totalDocuments - a.totalDocuments;
      if (b.signRate !== a.signRate) return b.signRate - a.signRate;
    }
    return a.unit.localeCompare(b.unit, 'vi');
  });

  return {
    sortBy,
    totalUnits: rows.length,
    items: sorted.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      unit: row.unit,
      totalDocuments: row.totalDocuments,
      signed: row.signed,
      signRate: row.signRate,
      byGroup: row.byGroup
    }))
  };
}

async function getTopUnitsByVolume(args: { limit?: number; from?: string; to?: string }) {
  const limit = args.limit ?? 10;
  const range = parseRange(args);
  const docs = await loadDocuments({ from: range.from, to: range.to });
  const summary = summaryFromDocuments(docs);
  return {
    totalUnits: summary.byUnit.length,
    items: summary.byUnit.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      unit: row.unit,
      total: row.total,
      signed: row.signed,
      signRate: row.signRate
    }))
  };
}

async function getDocumentGroupsBreakdown(args: { from?: string; to?: string }) {
  const range = parseRange(args);
  const docs = await loadDocuments({ from: range.from, to: range.to });
  const summary = summaryFromDocuments(docs);
  const totals = summary.totals.total || 1;
  return {
    totals: summary.totals,
    groups: summary.byGroup.map((row) => ({
      key: row.key,
      label: groupLabel(row.key),
      total: row.total,
      share: Number(((row.total / totals) * 100).toFixed(1))
    }))
  };
}

async function getReportSummary(args: {
  importId?: string;
  unit?: string;
  group?: keyof typeof DocumentGroup;
  search?: string;
  from?: string;
  to?: string;
}) {
  const range = parseRange(args);
  const groupEnum = args.group && args.group in DocumentGroup ? (args.group as DocumentGroup) : undefined;
  const docs = await loadDocuments({
    importId: args.importId,
    unit: args.unit,
    group: groupEnum,
    search: args.search,
    from: range.from,
    to: range.to
  });
  return summaryFromDocuments(docs);
}

async function getCompletionTrend(args: { bucket?: 'day' | 'month'; from?: string; to?: string }) {
  const bucket = args.bucket ?? 'month';
  const range = parseRange(args);
  const where: Prisma.DocumentWhereInput = {};
  if (range.from || range.to) {
    where.issueDate = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {})
    };
  }
  const docs = await prisma.document.findMany({
    where,
    select: { issueDate: true, signedDocument: true },
    orderBy: { issueDate: 'asc' }
  });
  const buckets = new Map<string, { bucket: string; total: number; signed: number; signRate: number }>();
  for (const doc of docs) {
    if (!doc.issueDate) continue;
    const date = new Date(doc.issueDate);
    const key = bucket === 'day'
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
      : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, { bucket: key, total: 0, signed: 0, signRate: 0 });
    const row = buckets.get(key)!;
    row.total += 1;
    if (doc.signedDocument && doc.signedDocument.trim()) row.signed += 1;
  }
  const items = [...buckets.values()].map((row) => ({
    ...row,
    signRate: row.total ? Number(((row.signed / row.total) * 100).toFixed(1)) : 0
  }));
  return { bucket, items };
}

async function searchDocuments(args: { query: string; limit?: number; from?: string; to?: string }) {
  const limit = args.limit ?? 10;
  const range = parseRange(args);
  const docs = await loadDocuments({ search: args.query, from: range.from, to: range.to });
  return {
    total: docs.length,
    items: docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      summary: truncate(doc.summary, 160),
      referenceNumber: doc.referenceNumber,
      signedDocument: doc.signedDocument,
      issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
      issuingUnit: doc.issuingUnit,
      normalizedUnit: doc.normalizedUnit,
      documentGroup: groupLabel(doc.documentGroup)
    }))
  };
}

async function getDocumentsByUnit(args: { unit: string; limit?: number; from?: string; to?: string }) {
  const limit = args.limit ?? 20;
  const range = parseRange(args);
  const docs = await loadDocuments({ unit: args.unit, from: range.from, to: range.to });
  return {
    total: docs.length,
    items: docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      summary: truncate(doc.summary, 160),
      referenceNumber: doc.referenceNumber,
      signedDocument: doc.signedDocument,
      issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
      issuingUnit: doc.issuingUnit,
      documentGroup: groupLabel(doc.documentGroup)
    }))
  };
}

export async function executeTool(name: string, rawArgs: unknown): Promise<unknown> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  switch (name as ToolName) {
    case 'get_top_units_by_completion':
      return getTopUnitsByCompletion(args as Parameters<typeof getTopUnitsByCompletion>[0]);
    case 'get_top_units_by_volume':
      return getTopUnitsByVolume(args as Parameters<typeof getTopUnitsByVolume>[0]);
    case 'get_document_groups_breakdown':
      return getDocumentGroupsBreakdown(args as Parameters<typeof getDocumentGroupsBreakdown>[0]);
    case 'get_report_summary':
      return getReportSummary(args as Parameters<typeof getReportSummary>[0]);
    case 'get_completion_trend':
      return getCompletionTrend(args as Parameters<typeof getCompletionTrend>[0]);
    case 'search_documents':
      return searchDocuments(args as Parameters<typeof searchDocuments>[0]);
    case 'get_documents_by_unit':
      return getDocumentsByUnit(args as Parameters<typeof getDocumentsByUnit>[0]);
    default:
      throw new AppError(400, 'UNKNOWN_TOOL', `Tool không được hỗ trợ: ${name}`);
  }
}
