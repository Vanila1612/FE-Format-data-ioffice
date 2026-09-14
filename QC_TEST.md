# Tài liệu QC & Kiểm thử — iOffice (Rà soát văn bản đi)

> Tài liệu này dành cho QC / Tester nắm nhanh sản phẩm, môi trường, phạm vi test, kịch bản kiểm thử theo module và checklist nghiệm thu.

---

## 1. Tổng quan sản phẩm

**iOffice — Rà soát văn bản đi** là ứng dụng nội bộ dùng để:

- Upload file Excel xuất từ hệ thống iOffice.
- Chuẩn hoá dữ liệu (đơn vị ban hành, ngày, người ký, trạng thái ký số).
- Phân loại văn bản theo quy tắc cấu hình (BC/TTr, CV/UQ, Thư công tác, đặc biệt NHNo/Agribank).
- Xem, lọc, sắp xếp, xuất Excel báo cáo.
- Lưu kết quả thống kê (snapshot) bất biến kèm bản sao văn bản gốc.
- Quản trị người dùng, quy tắc phân loại, chuẩn hoá đơn vị, người ký chính.

**Kiến trúc**

```
frontend/ React 19 + Vite + TypeScript  → REST /api
backend/  Express + TypeScript + Prisma  → MongoDB
storage/  uploads/ exports/ snapshots/   (volume persistent)
```

**Phân quyền**

- `ADMIN`: toàn quyền (quản lý user, rule, mapping, signer; xoá văn bản, import, snapshot).
- `USER`: nhập liệu, xem văn bản, tạo báo cáo, lưu kết quả; chỉ xoá được snapshot do chính mình tạo.

---

## 2. Yêu cầu môi trường & cài đặt

| Thành phần | Phiên bản |
| --- | --- |
| Node.js | 22+ |
| pnpm | mới nhất |
| MongoDB | replica set `rs0` (khuyến nghị qua Docker Compose) |
| Docker Desktop | bật khi chạy bằng container |

### 2.1 Cài đặt local

```bash
pnpm install
docker compose up -d mongo
pnpm prisma:push
pnpm seed
pnpm dev
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:3001/api/health
- Tài khoản mặc định: `admin / admin123456`

### 2.2 Stack Docker

```bash
docker compose up -d --build           # dev
docker compose -f docker-compose.prod.yml up -d --build   # prod
```

### 2.3 Biến môi trường quan trọng (xem `.env.example`)

- `DATABASE_URL` — chuỗi kết nối MongoDB (replica set).
- `JWT_SECRET` — tối thiểu 12 ký tự, **bắt buộc đổi ở môi trường production**.
- `CORS_ORIGIN` — origin frontend (vd: `http://localhost:5173`).
- `MAX_UPLOAD_SIZE_MB` — mặc định 50 MB.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` — seed tài khoản admin.
- `OPENAI_API_KEY` (tuỳ chọn) — bật tính năng trợ lý AI; nếu trống sẽ ẩn chức năng AI.

### 2.4 Sinh file Excel mẫu để test

```bash
pnpm --filter @ioffice/backend fixture
```

Mẫu: `backend/fixtures/sample-ioffice.xlsx`.

---

## 3. Hướng dẫn nhanh để QC tự chạy

1. Đăng nhập bằng `admin / admin123456`.
2. **Tổng quan**: kiểm tra KPI tổng, biểu đồ phân loại, lần nhập gần đây.
3. **Nhập dữ liệu**: kéo thả `sample-ioffice.xlsx` → xem preview chuẩn hoá → bấm **Lưu vào hệ thống**.
4. **Văn bản**: lọc theo import, đơn vị, ngày; xoá (admin).
5. **Thống kê**: xem bảng kết quả theo đơn vị / người ký; lưu kết quả.
6. **Lịch sử nhập**: bấm **Đọc lại file gốc** để reprocess (admin).
7. **Kết quả đã lưu**: xem lại, so sánh, xuất Excel.
8. **Quy tắc / Chuẩn hoá đơn vị / Người ký / Người dùng**: CRUD (chỉ admin).

---

## 4. Cấu trúc phản hồi API & Mã lỗi

Tất cả response đều theo envelope:

```json
{ "success": true, "data": {...} }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

Mã lỗi thường gặp cần test:

| Code | HTTP | Mô tả |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | Sai tài khoản/mật khẩu |
| `UNAUTHORIZED` | 401 | Thiếu hoặc token không hợp lệ |
| `FORBIDDEN` | 403 | Không đủ quyền (admin-only) |
| `FILE_REQUIRED` | 400 | Upload thiếu file |
| `INVALID_FILE_EXTENSION` | 400 | Không phải `.xlsx`/`.xls` |
| `INVALID_FILE_MIME` | 400 | MIME type không hợp lệ |
| `MISSING_REQUIRED_COLUMNS` | 400 | Thiếu cột bắt buộc (xem mục 6.1) |
| `EMPTY_EXCEL` | 400 | File rỗng / không có dòng dữ liệu |
| `SOURCE_FILE_NOT_FOUND` | 404 | File gốc đã bị xoá, không thể reprocess |
| `IMPORT_NOT_FOUND`, `DOCUMENT_NOT_FOUND`, `RULE_NOT_FOUND`, `UNIT_MAPPING_NOT_FOUND`, `USER_NOT_FOUND`, `SNAPSHOT_NOT_FOUND`, `SIGNER_NOT_FOUND` | 404 | Không tìm thấy resource |
| `USERNAME_EXISTS`, `SIGNER_EXISTS` | 409 | Trùng username |
| `LAST_ADMIN` | 400 | Không được hạ cấp/xoá admin cuối cùng |
| `CANNOT_DELETE_SELF` | 400 | Không tự xoá chính mình |
| `USER_HAS_DATA` | 400 | Không xoá user đã có import/snapshot |
| `EMPTY_REPORT` | 400 | Không tạo snapshot khi không có văn bản thoả mãn filter |
| `VALIDATION_ERROR` | 400 | Sai schema (Zod) |

---

## 5. Hành vi nghiệp vụ quan trọng cần QC ưu tiên

### 5.1 Chuẩn hoá dữ liệu

- Tên đơn vị được so sánh không phân biệt hoa/thường, bỏ dấu, gộp khoảng trắng (vd: `Trụ sở chính` ≡ `TRU SO CHINH` ≡ `văn phòng trụ sở chính`).
- Bảng chuẩn hoá tích hợp sẵn (built-in) trong `normalizationService.ts` + danh sách `UnitMapping` trong DB → ưu tiên mapping DB hơn built-in (vì `find` chạy sau built-in). **Lưu ý**: nếu mapping DB chỉ khoá `sourceName`, cần trùng khớp chính xác sau khi chuẩn hoá.
- Ngày hỗ trợ: `Date`, số serial Excel, `dd/mm/yyyy`, `dd-mm-yyyy`, ISO string.

### 5.2 Trạng thái ký số (`isSignedDocument`)

Một giá trị được tính là **đã ký số** khi chứa (không phân biệt hoa/thường, có dấu/không dấu) một trong các marker:

- `đã ký số` / `da ky so`
- `signed`
- `true`, `yes`, `1`, `x`

### 5.3 Phân loại văn bản (thứ tự ưu tiên)

1. **Đặc biệt NHNo**: nếu `issuingUnit` là `NHNo`, `NHNo.LH`, `Ngân hàng Nông nghiệp và Phát triển nông thôn Việt Nam` (kể cả không dấu) → nhóm = `Công văn / Ủy quyền`; **đơn vị chuẩn hoá được suy ra từ phần đuôi số ký hiệu** (vd: `12969/NHNo-ALCO` → `TRUNG TÂM QUẢN LÝ NỢ CVĐ`). Nếu suffix không nằm trong bảng `NHNO_REFERENCE_UNIT_MAPPINGS` (built-in) hoặc `UnitMapping` DB → đơn vị rỗng ⇒ văn bản bị loại khỏi thống kê.
2. **Quy tắc từ khoá** trong `số ký hiệu`:
   - `BC`, `TTr` → `Báo cáo / Tờ trình` (so khớp theo ranh giới từ, **không match `ABC`**).
   - `CV`, `UQ` → `Công văn / Ủy quyền` (so khớp substring để bao trùm `GUQ`).
   - Ưu tiên `priority` nhỏ hơn; quy tắc `enabled=false` bị bỏ.
3. **Mặc định**: `Thư công tác`.

### 5.4 Snapshot (kết quả đã lưu)

- Mỗi snapshot lưu cả bảng thống kê (`reportJson`) và bản sao văn bản (`snapshot_documents`).
- Có phiên bản quy tắc (`ruleVersion`) tại thời điểm lưu.
- **Bất biến**: sửa rule/mapping hay xoá văn bản sau đó **không ảnh hưởng** snapshot đã lưu.
- So sánh 2 snapshot dựa trên khoá định danh: `referenceNumber + issueDate + summary`.
- Trường được xét là "thay đổi": `documentGroup`, `normalizedUnit`, `signedDocument`.

### 5.5 Quyền xoá snapshot

- `ADMIN` xoá mọi snapshot.
- `USER` chỉ xoá snapshot do chính mình tạo.

### 5.6 Quyền quản trị

- Không được hạ cấp admin cuối cùng (`LAST_ADMIN`).
- Không tự xoá tài khoản đang đăng nhập (`CANNOT_DELETE_SELF`).
- Không xoá user đã có `import` hoặc `snapshot` (`USER_HAS_DATA`).

---

## 6. Test case theo module

> Định dạng: **TC-[Module]-[Số]** — Mô tả — Dữ liệu — Bước — Expected.

### 6.1 Import (Nhập file Excel)

#### 6.1.1 Cấu trúc file bắt buộc

Cột bắt buộc (case-insensitive, NFC normalize):

- `Trích yếu`
- `Số ký hiệu`
- `Văn bản ký số`
- `Ngày ban hành`
- `Đơn vị ban hành`

Cột tuỳ chọn: `Người ký chính` (hỗ trợ cả alias `NGUOI_KY_CHINH`).

| TC | Mô tả | Bước | Expected |
| --- | --- | --- | --- |
| TC-IMP-01 | Upload file thiếu 1 cột bắt buộc | Tạo file Excel chỉ có 4/5 cột, POST `/api/imports` | HTTP 400, code `MISSING_REQUIRED_COLUMNS`, `error.details` liệt kê cột thiếu |
| TC-IMP-02 | Upload đúng 5 cột | Upload `sample-ioffice.xlsx` | HTTP 201, `data.documentsImported` = số dòng hợp lệ |
| TC-IMP-03 | Sai định dạng file | Upload `.txt` / `.pdf` | HTTP 400, code `INVALID_FILE_EXTENSION` hoặc `INVALID_FILE_MIME` |
| TC-IMP-04 | File quá dung lượng | Upload file > `MAX_UPLOAD_SIZE_MB` | HTTP 400, lỗi multer (`LIMIT_FILE_SIZE`) |
| TC-IMP-05 | File rỗng sau header | Upload file chỉ có header, không có dòng | HTTP 400, code `EMPTY_EXCEL`; import status = `FAILED` |
| TC-IMP-06 | Bỏ dòng STT không phải số | File có dòng phụ kiểu `(1)`, `(2)` | Hệ thống tự lọc, không tạo document rác |
| TC-IMP-07 | Upload khi chưa đăng nhập | Bỏ token | HTTP 401, code `UNAUTHORIZED` |
| TC-IMP-08 | Ngày nhiều định dạng | Trộn `dd/mm/yyyy` và `yyyy-mm-dd` | Đều parse thành `Date` (UTC) |
| TC-IMP-09 | Ngày không hợp lệ | Ghi `"abc"` vào `Ngày ban hành` | `issueDate = null`, document vẫn lưu |
| TC-IMP-10 | Tên đơn vị viết hoa/không dấu | `"TRỤ SỞ CHÍNH"`, `"tru so chinh"` | `normalizedUnit = "Trụ sở chính"` |
| TC-IMP-11 | Văn bản NHNo-ALCO | `Số ký hiệu = "12969/NHNo-ALCO"`, `Đơn vị = "NHNo"` | `documentGroup = LETTER_AUTHORIZATION`, `normalizedUnit = "TRUNG TÂM QUẢN LÝ NỢ CVĐ"` |
| TC-IMP-12 | Văn bản NHNo-ALCO thiếu mapping suffix | `Số ký hiệu = "12969/NHNo-UNKNOWN"` | `normalizedUnit = ""` ⇒ bị loại khỏi thống kê |
| TC-IMP-13 | Phân loại BC/TTr không khớp ABC | `Số ký hiệu = "ABC/123"` | `documentGroup = WORK_LETTER` |
| TC-IMP-14 | Phân loại CV/UQ match substring | `Số ký hiệu = "GUQ/01"` | `documentGroup = LETTER_AUTHORIZATION` |

#### 6.1.2 Trang **Nhập dữ liệu** (frontend)

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-IMPUI-01 | Kéo thả file hợp lệ | Preview KPI + 2 bảng (đơn vị, người ký) hiển thị sau khi parse |
| TC-IMPUI-02 | File thiếu cột | Toast lỗi `Thiếu cột bắt buộc`, panel `error-state` hiển thị các cột |
| TC-IMPUI-03 | Bấm **Lưu vào hệ thống** | Gọi `POST /imports`; chuyển hướng sang `/documents?importId=...` |
| TC-IMPUI-04 | Bấm **Làm mới** | Reset file + result |
| TC-IMPUI-05 | Tìm đơn vị / chọn nhóm văn bản | Bảng lọc client, cập nhật `X/Y đơn vị` |

---

### 6.2 Văn bản (Documents)

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-DOC-01 | Mở `/documents` mặc định | Hiển thị trang 1, 20 dòng/trang, sắp theo `issueDate desc` |
| TC-DOC-02 | Tìm kiếm theo từ khoá | Gõ từ khoá → debounce → API trả items khớp `summary`/`referenceNumber`/`issuingUnit`/`normalizedUnit` |
| TC-DOC-03 | Lọc theo `importId` | Combo chọn lần import; query có `importId` |
| TC-DOC-04 | Lọc theo khoảng ngày (từ–đến) | Chọn ngày → bấm **Áp dụng**; từ > đến → toast lỗi |
| TC-DOC-05 | Đổi page size | 20/50/100; API gửi `pageSize` tương ứng |
| TC-DOC-06 | Phân trang | Bấm `Sau` / `Trước` / số trang; API gọi `page` đúng |
| TC-DOC-07 | Xuất Excel | Bấm **Xuất Excel** → tải `.xlsx` đúng filter (không bao gồm `page`/`pageSize`) |
| TC-DOC-08 | Xoá văn bản (ADMIN) | Confirm → row biến mất; admin còn cột `Xoá` |
| TC-DOC-09 | Không hiển thị nút Xoá (USER) | Cột `Xoá` không render |
| TC-DOC-10 | USER cố gọi `DELETE /documents/:id` qua DevTools | HTTP 403 `FORBIDDEN` |

---

### 6.3 Lịch sử nhập (Imports)

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-IMP-HIST-01 | Xem danh sách import | Sắp theo `createdAt desc`, hiển thị uploadedBy, status, total/success/failed |
| TC-IMP-HIST-02 | Bấm **Xem dữ liệu** | Điều hướng `/documents?importId=...` |
| TC-IMP-HIST-03 | Bấm **Excel** | Tải file `ioffice-import-YYYY-MM-DD.xlsx` |
| TC-IMP-HIST-04 | **Đọc lại file gốc** (ADMIN) | Reprocess; toast số bản ghi khôi phục |
| TC-IMP-HIST-05 | Reprocess khi file gốc bị xoá | HTTP 404, code `SOURCE_FILE_NOT_FOUND` |
| TC-IMP-HIST-06 | **Xoá import** (ADMIN) | Confirm → xoá cascade document + snapshot liên quan |
| TC-IMP-HIST-07 | Reprocess tất cả | Bấm nút trên Rules → `POST /imports/reprocess-all` → toast số ok/err |

---

### 6.4 Thống kê & Lưu kết quả (Reports & Snapshots)

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-REP-01 | Xem báo cáo không filter | KPI + bảng đơn vị + bảng người ký |
| TC-REP-02 | Lọc theo import | KPI thu hẹp; bảng chỉ chứa đơn vị trong import đó |
| TC-REP-03 | Lọc khoảng ngày | API gọi `from`, `to` |
| TC-REP-04 | Từ > đến | Toast lỗi, không gọi API |
| TC-REP-05 | Sắp xếp bảng đơn vị | Click header → toggle asc/desc; sort theo `vi` locale |
| TC-REP-06 | Bộ lọc Chi nhánh / Không gồm chi nhánh | Dựa trên regex tên đơn vị chứa `chi nhanh`/`cn` (đã bỏ dấu) |
| TC-REP-07 | **Lưu kết quả thống kê** | Tạo snapshot; tên mặc định `Thống kê dd/mm/yyyy` nếu bỏ trống |
| TC-REP-08 | Lưu khi KPI = 0 | Nút bị disable |
| TC-REP-09 | Xem snapshot | Hiển thị KPI + bảng; tên phiên bản rule = `vN` |
| TC-REP-10 | So sánh 2 snapshot | API `GET /snapshots/compare?leftId&rightId` → `{added, removed, changed, unchanged}` |
| TC-REP-11 | Sửa rule → snapshot cũ không đổi | Sửa rule rồi mở snapshot cũ; vẫn hiển thị đúng `reportJson` cũ |
| TC-REP-12 | Xuất Excel snapshot | File đa sheet: thông tin + thống kê + danh sách văn bản |

---

### 6.5 Quy tắc phân loại (Rules) — ADMIN

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-RUL-01 | Tạo rule với keyword rỗng | Form `required` block; backend trả 400 |
| TC-RUL-02 | Tạo rule keyword trùng | Cho phép (không unique), trừ khi trùng id seed |
| TC-RUL-03 | Tạo rule với priority tuỳ chọn | Mặc định 50 |
| TC-RUL-04 | Sửa rule | Update keyword + documentGroup |
| TC-RUL-05 | Xoá rule | Hỏi confirm; nếu rule đang được dùng → import mới áp dụng quy tắc còn lại |
| TC-RUL-06 | **Áp dụng lại cho các import đã có** | Gọi `/imports/reprocess-all`, đếm ok/err |

---

### 6.6 Chuẩn hoá đơn vị (Unit Mappings) — ADMIN

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-UM-01 | Tạo mapping mới | Lưu DB; ảnh hưởng import mới |
| TC-UM-02 | Sửa mapping | Không thay đổi dữ liệu lịch sử (đã snapshot hoá trong import) |
| TC-UM-03 | Tìm kiếm | `?search=` lọc theo `sourceName` / `normalizedName` (insensitive) |
| TC-UM-04 | Reprocess sau khi sửa mapping | Chạy **Đọc lại file gốc** hoặc reprocess-all để áp dụng |

---

### 6.7 Người ký chính (Signers) — ADMIN

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-SIG-01 | Thêm người ký | Bắt buộc `username`, `fullName`, `position` |
| TC-SIG-02 | Trùng `username` | HTTP 409, code `SIGNER_EXISTS` |
| TC-SIG-03 | Lọc theo chức danh / tìm kiếm | Dropdown + ô search client |
| TC-SIG-04 | Sửa / Xoá | Toast thành công; refetch danh sách |

---

### 6.8 Người dùng & phân quyền (Users) — ADMIN

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-USR-01 | Tạo user | Username ≥ 3, password ≥ 8, role mặc định `USER` |
| TC-USR-02 | Trùng username | HTTP 409, code `USERNAME_EXISTS` |
| TC-USR-03 | Đổi role → USER | Nếu là admin cuối → 400 `LAST_ADMIN` |
| TC-USR-04 | Đặt lại mật khẩu | Prompt mật khẩu mới (≥ 8 ký tự); hash `bcrypt` |
| TC-USR-05 | Xoá chính mình | 400 `CANNOT_DELETE_SELF` |
| TC-USR-06 | Xoá admin cuối | 400 `LAST_ADMIN` |
| TC-USR-07 | Xoá user đã có import/snapshot | 400 `USER_HAS_DATA` |

---

### 6.9 Trợ lý AI (Assistant) — nếu `OPENAI_API_KEY` được cấu hình

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-AI-01 | Mở `/assistant` không có key | Hiển thị thông báo "AI chưa được kích hoạt" hoặc nút bị ẩn (xem frontend) |
| TC-AI-02 | Hỏi đáp bình thường | Response trả về, lưu session và turn |
| TC-AI-03 | Xem lịch sử chat | Session sắp theo `updatedAt desc` |
| TC-AI-04 | Rate limit | Giới hạn 30 req/phút; quá → HTTP 429 |
| TC-AI-05 | Bảo mật | Không thấy OPENAI_API_KEY trong response |

> Nếu không bật AI: chỉ cần đảm bảo route `/assistant` truy cập được mà không lộ key.

---

### 6.10 Xác thực & Phân quyền

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-AUTH-01 | Đăng nhập đúng | Token 8h, lưu `localStorage('ioffice.token')` |
| TC-AUTH-02 | Sai mật khẩu | Toast lỗi từ `INVALID_CREDENTIALS` |
| TC-AUTH-03 | Token hết hạn | API trả 401; frontend tự xoá token, đẩy về `/login` |
| TC-AUTH-04 | Refresh trang khi đã login | `useAuth` gọi `/auth/me` → user còn hợp lệ |
| TC-AUTH-05 | Truy cập `/rules` với USER | Link ẩn trong sidebar; nếu vào URL thủ công → backend 403 |
| TC-AUTH-06 | Rate limit `/api/auth/login` | > 20 req/phút → 429 |

---

### 6.11 Xuất / Tải file

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-EXP-01 | Xuất báo cáo theo filter | Đúng các văn bản khớp `from`, `to`, `importId`, `group` |
| TC-EXP-02 | Xuất import | Sheet "Summary", "By Unit", "Văn bản"; cột tiếng Việt có dấu |
| TC-EXP-03 | Xuất snapshot | Sheet "Thông tin kết quả", "Kết quả thống kê", "Văn bản" |
| TC-EXP-04 | Tên file xuất | Theo đúng `Content-Disposition: filename=...` |

---

## 7. Kiểm thử bảo mật & biên

| TC | Mô tả | Expected |
| --- | --- | --- |
| TC-SEC-01 | SQL/NoSQL injection qua query string | Tham số `search`/`unit`/`from` được sanitize (Zod + Prisma) |
| TC-SEC-02 | Upload file có script macro | Vẫn parse được vì chỉ đọc XLSX, nhưng không thực thi |
| TC-SEC-03 | Upload file Excel có header injection (`=cmd...`) | Không ảnh hưởng server; kiểm tra hiển thị trên UI |
| TC-SEC-04 | Path traversal trong file name | `sanitizeFileName` loại bỏ ký tự đặc biệt |
| TC-SEC-05 | CORS sai origin | Request bị browser chặn; backend log origin |
| TC-SEC-06 | Helmet headers | Có `X-Content-Type-Options`, `Strict-Transport-Security` (prod) |
| TC-SEC-07 | Helmet CSP | Không có CSP nghiêm ngặt (cân nhắc bổ sung nếu khách hàng yêu cầu) |
| TC-SEC-08 | Token giả mạo | Verify fail → 401 `UNAUTHORIZED` |
| TC-SEC-09 | Truy cập admin API bằng user thường | 403 `FORBIDDEN` |
| TC-SEC-10 | Replay token sau khi đổi mật khẩu | Token vẫn hợp lệ (chưa có blacklist — ghi nhận để cải tiến) |

---

## 8. Kiểm thử UI/UX

- Mỗi trang có đủ 3 trạng thái: **Loading / Empty / Error**.
- Toàn bộ thông báo lỗi hiển thị qua `sonner` (toast).
- Bảng có thanh cuộn ngang khi nhiều cột (mobile/tablet).
- Tiếng Việt có dấu hiển thị đúng (font hỗ trợ Unicode).
- Responsive sidebar (mobile thu gọn, desktop luôn hiện).
- Phím tắt: Enter trong input ngày → áp dụng filter.
- Cảnh báo `confirm()` trước khi xoá/bật lại quy tắc.

---

## 9. Kiểm thử tự động (đã có)

```bash
pnpm test    # chạy tất cả test
pnpm lint    # typecheck
pnpm build   # production build
```

Bộ test hiện tại (xem `backend/tests/`):

- `classificationService.test.ts` — BC/TTr/CV/UQ/mặc định/NHNo/Agribank/NHNo-ALCO.
- `normalizationService.test.ts` — khoảng trắng, rỗng, ngày, mapping, ký số.
- `excelService.test.ts`, `snapshotService.test.ts`, `signerRoutes.test.ts`, `api.test.ts`.

> Khi QC phát hiện lỗi mới, **bổ sung test case tự động** tương ứng để tránh hồi quy.

---

## 10. Checklist nghiệm thu trước release

- [ ] Toàn bộ test case ở mục 6 PASS.
- [ ] Bảo mật (mục 7) không có finding mức Critical/High.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` đều xanh.
- [ ] `JWT_SECRET` đã được đổi ở môi trường production (khác default).
- [ ] `ADMIN_PASSWORD` đã được đổi sau khi seed.
- [ ] Backup script `scripts/backup.sh` chạy thành công; `scripts/restore.sh` đã dry-run.
- [ ] Volume `app_storage` được mount persistent trên Docker.
- [ ] CORS chỉ cho phép origin đã khai báo.
- [ ] Không còn file log chứa stack trace ở môi trường production (xem `errorHandler`).
- [ ] Pass tải file Excel mẫu `>= 10.000 dòng` (benchmark thời gian parse + lưu).
- [ ] Tài liệu README + QC_TEST cập nhật nếu có thay đổi nghiệp vụ.

---

## 11. Known Limitations (từ README)

- Docker build chưa chạy hoàn chỉnh trong session phát triển (Corepack certificate). QC nên kiểm tra lại khi dựng Docker.
- Frontend chưa có component test riêng (chỉ backend service tests).
- Snapshot comparison dùng semantics MVP (`referenceNumber + issueDate + summary`).
- Token JWT **chưa bị thu hồi** khi đổi mật khẩu (ghi nhận để cải tiến, mục TC-SEC-10).
- AI Assistant chỉ khả dụng khi có `OPENAI_API_KEY`; mọi response streaming/tool-event đều lưu vào DB.

---

## 12. Báo cáo lỗi mẫu (Bug Report Template)

```
Tiêu đề:   [Module] Mô tả ngắn gọn
Môi trường: dev / staging / prod
Người thực hiện: <tên QC>
Bước tái tạo:
  1.
  2.
  3.
Kết quả thực tế:
Kết quả mong đợi:
Ảnh chụp / log:
Mức độ: Critical / High / Medium / Low
Ghi chú:
```

---

*Happy testing! Mọi câu hỏi liên quan đến business rule, vui lòng liên hệ BA/PM trước khi tạo bug.*
