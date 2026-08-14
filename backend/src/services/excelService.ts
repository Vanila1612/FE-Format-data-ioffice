import XLSX from 'xlsx';
import { AppError } from '../utils/appError.js';
import { missingRequiredHeaders, normalizeHeader, normalizeText, type RawExcelRow } from './normalizationService.js';

export type ParsedWorkbook = {
  sheetName: string;
  headers: string[];
  rows: RawExcelRow[];
  preview: RawExcelRow[];
};

export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError(400, 'EMPTY_EXCEL', 'Excel file does not contain any sheets');

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  const headerIndex = matrix.findIndex((row) => missingRequiredHeaders(row).length === 0);
  if (headerIndex < 0) {
    const candidate = matrix.find((row) => row.some((cell) => normalizeText(cell))) || [];
    throw new AppError(400, 'MISSING_REQUIRED_COLUMNS', 'Excel file is missing required columns', missingRequiredHeaders(candidate));
  }

  const headers = matrix[headerIndex].map(normalizeText);
  const normalizedHeaders = headers.map(normalizeHeader);
  const sttIndex = normalizedHeaders.indexOf('stt');
  const rows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => normalizeText(cell)))
    // The iOffice export contains a second row such as “(1), (2), …”.
    // It describes the columns; it is not a document and must not be imported.
    .filter((row) => sttIndex < 0 || Number.isFinite(Number(row[sttIndex])))
    .map((row) => Object.fromEntries(row.map((cell, index) => [headers[index] || `Column ${index + 1}`, cell])))
    .filter((row) => normalizedHeaders.some((_, index) => normalizeText(Object.values(row)[index])));

  if (rows.length === 0) throw new AppError(400, 'EMPTY_EXCEL', 'Excel file does not contain document rows');

  return { sheetName, headers, rows, preview: rows.slice(0, 10) };
}

export function buildWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[]): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), sheet.name);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}
