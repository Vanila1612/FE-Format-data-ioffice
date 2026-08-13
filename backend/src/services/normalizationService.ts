import type { UnitMapping } from '@prisma/client';
import XLSX from 'xlsx';

export const REQUIRED_HEADERS = [
  'Trích yếu',
  'Số ký hiệu',
  'Văn bản ký số',
  'Ngày ban hành',
  'Đơn vị ban hành'
] as const;

export type RawExcelRow = Record<string, unknown>;

export type NormalizedDocumentInput = {
  summary: string;
  referenceNumber: string;
  signedDocument: string;
  issueDate: Date | null;
  issuingUnit: string;
  normalizedUnit: string;
  rawData: RawExcelRow;
};

export function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const text = normalizeText(value);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function isSignedDocument(value: unknown): boolean {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return ['đã ký số', 'da ky so', 'signed', 'true', 'yes', '1', 'x'].some((marker) => normalized.includes(marker));
}

export function normalizeUnit(source: string, mappings: Pick<UnitMapping, 'sourceName' | 'normalizedName' | 'enabled'>[]): string {
  const clean = normalizeText(source);
  const match = mappings.find((mapping) => mapping.enabled && normalizeText(mapping.sourceName).toLowerCase() === clean.toLowerCase());
  return match ? normalizeText(match.normalizedName) : clean;
}

export function normalizeDocument(row: RawExcelRow, mappings: Pick<UnitMapping, 'sourceName' | 'normalizedName' | 'enabled'>[]): NormalizedDocumentInput {
  const issuingUnit = normalizeText(row['Đơn vị ban hành']);
  return {
    summary: normalizeText(row['Trích yếu']),
    referenceNumber: normalizeText(row['Số ký hiệu']),
    signedDocument: normalizeText(row['Văn bản ký số']),
    issueDate: parseExcelDate(row['Ngày ban hành']),
    issuingUnit,
    normalizedUnit: normalizeUnit(issuingUnit, mappings),
    rawData: row
  };
}

export function missingRequiredHeaders(headers: unknown[]): string[] {
  const normalizedHeaders = headers.map(normalizeHeader);
  return REQUIRED_HEADERS.filter((header) => !normalizedHeaders.includes(normalizeHeader(header)));
}
