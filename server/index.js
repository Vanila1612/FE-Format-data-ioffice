import express from 'express';
import multer from 'multer';
import Database from 'better-sqlite3';
import XLSX from 'xlsx';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'ioffice.db'));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const requiredHeaders = ['Trích yếu', 'Số ký hiệu', 'Văn bản ký số', 'Ngày ban hành', 'Đơn vị ban hành'];
const defaultRules = { report: ['BC', 'TTr'], letter: ['CV', 'UQ'], agribank: ['NHNo', 'Ngân hàng Nông nghiệp và Phát triển nông thôn Việt Nam'] };

db.exec(`CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY, file_name TEXT NOT NULL, sheet_name TEXT NOT NULL, row_count INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, import_id INTEGER NOT NULL, stt TEXT, abstract TEXT, document_code TEXT, signing_status TEXT, issue_date TEXT, issuing_unit TEXT, FOREIGN KEY(import_id) REFERENCES imports(id));
CREATE INDEX IF NOT EXISTS idx_documents_import ON documents(import_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('rules', JSON.stringify(defaultRules));

function text(value) { return String(value ?? '').trim(); }
function contains(value, words) { const valueLower = text(value).toLocaleLowerCase('vi'); return words.some((word) => valueLower.includes(text(word).toLocaleLowerCase('vi'))); }
function rules() { try { return { ...defaultRules, ...JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get('rules').value) }; } catch { return defaultRules; } }
function category(document, config) { if (contains(document.issuing_unit, config.agribank)) return 'letter'; if (contains(document.document_code, config.report)) return 'report'; if (contains(document.document_code, config.letter)) return 'letter'; return 'work'; }
function unitName(document, config) {
  const unit = text(document.issuing_unit);
  if (contains(unit, config.agribank)) return text(document.document_code).split('-').map(text).filter(Boolean).at(-1) || 'Trụ sở chính';
  const aliases = [[/^văn phòng (trụ sở chính|tsc)$/i, 'Trụ sở chính'], [/^trụ sở chính( agribank)?$/i, 'Trụ sở chính'], [/^ban khách hàng doanh nghiệp$/i, 'Ban Khách hàng Doanh Nghiệp'], [/^ban thư ký tổng hợp$/i, 'Ban Thư ký Tổng hợp'], [/^ban kiểm soát$/i, 'Ban Kiểm soát'], [/^đảng ủy agribank$/i, 'Đảng Ủy Agribank'], [/^ban quản lý dự án đầu tư xây dựng khu vực$/i, 'Ban QL Dự án ĐTXD khu vực'], [/^trung tâm phê duyệt tín dụng tại tp\.hcm$/i, 'TT phê duyệt tín dụng tại TP.HCM']];
  return aliases.find(([pattern]) => pattern.test(unit))?.[1] || unit;
}
function isSigned(status) { return text(status).toLocaleLowerCase('vi').includes('đã ký số'); }
function dateSortKey(value) { const match = text(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text(value); }
function reportFor(importId) {
  const config = rules(); const groups = new Map();
  for (const document of db.prepare('SELECT * FROM documents WHERE import_id = ?').iterate(importId)) {
    const unit = unitName(document, config); const type = category(document, config); const signed = isSigned(document.signing_status);
    if (!groups.has(unit)) groups.set(unit, { unit, report: [0, 0], letter: [0, 0], work: [0, 0] });
    const result = groups.get(unit)[type]; result[1] += 1; if (signed) result[0] += 1;
  }
  const records = [...groups.values()].map((row) => ({ ...row, signed: row.report[0] + row.letter[0] + row.work[0], total: row.report[1] + row.letter[1] + row.work[1] })).sort((a, b) => b.total - a.total);
  const totals = records.reduce((acc, row) => ({ total: acc.total + row.total, signed: acc.signed + row.signed, report: acc.report + row.report[1], letter: acc.letter + row.letter[1], work: acc.work + row.work[1] }), { total: 0, signed: 0, report: 0, letter: 0, work: 0 });
  const dates = db.prepare('SELECT issue_date FROM documents WHERE import_id = ?').all(importId).map((row) => text(row.issue_date)).filter(Boolean).sort((a, b) => dateSortKey(a).localeCompare(dateSortKey(b)));
  return { records, totals, period: { from: dates[0] || null, to: dates.at(-1) || null } };
}

app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/imports', (_req, res) => res.json(db.prepare('SELECT * FROM imports ORDER BY id DESC').all()));
app.get('/api/rules', (_req, res) => res.json(rules()));
app.put('/api/rules', (req, res) => { const value = { report: req.body.report?.map(text).filter(Boolean) || [], letter: req.body.letter?.map(text).filter(Boolean) || [], agribank: req.body.agribank?.map(text).filter(Boolean) || [] }; db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(value), 'rules'); res.json(value); });
app.post('/api/imports', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) throw new Error('Vui lòng chọn file Excel.');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false }); const sheetName = workbook.SheetNames[0]; const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.includes(header)));
    if (headerIndex < 0) throw new Error(`Không tìm thấy các cột bắt buộc: ${requiredHeaders.join(', ')}.`);
    const headers = rows[headerIndex].map(text); const sttIndex = headers.indexOf('STT');
    const documents = rows.slice(headerIndex + 1).filter((row) => row.some((value) => text(value)) && (sttIndex < 0 || Number.isFinite(Number(row[sttIndex])))).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
    const save = db.transaction(() => { const result = db.prepare('INSERT INTO imports (file_name, sheet_name, row_count) VALUES (?, ?, ?)').run(req.file.originalname, sheetName, documents.length); const insert = db.prepare('INSERT INTO documents (import_id, stt, abstract, document_code, signing_status, issue_date, issuing_unit) VALUES (?, ?, ?, ?, ?, ?, ?)'); documents.forEach((row) => insert.run(result.lastInsertRowid, text(row.STT), text(row['Trích yếu']), text(row['Số ký hiệu']), text(row['Văn bản ký số']), text(row['Ngày ban hành']), text(row['Đơn vị ban hành']))); return result.lastInsertRowid; });
    const importId = save(); res.status(201).json({ import: db.prepare('SELECT * FROM imports WHERE id = ?').get(importId), preview: documents.slice(0, 8) });
  } catch (error) { next(error); }
});
app.get('/api/imports/:id/report', (req, res) => { const imported = db.prepare('SELECT * FROM imports WHERE id = ?').get(req.params.id); if (!imported) return res.status(404).json({ error: 'Không tìm thấy lần nhập dữ liệu.' }); return res.json({ import: imported, ...reportFor(imported.id) }); });
app.use((error, _req, res, _next) => res.status(400).json({ error: error.message || 'Không thể xử lý yêu cầu.' }));
const dist = path.join(root, 'dist'); if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
app.listen(3001, () => console.log('iOffice API listening at http://localhost:3001'));
