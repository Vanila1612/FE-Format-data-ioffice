# Tài liệu kiểm thử (QC) - iOffice Rà soát văn bản đi

## 1. Mục đích hệ thống
Ứng dụng nội bộ dùng để: tải file Excel xuất từ iOffice, kiểm tra/chuẩn hóa dữ liệu văn bản đi,
phân loại văn bản, xem dashboard/báo cáo, xuất Excel, và lưu "kết quả đã lưu" (snapshot) bất biến.

## 2. Môi trường test
- Node.js 22+, pnpm, Docker Desktop.
- Khởi động: `docker compose up -d mongo` → `pnpm prisma:push` → `pnpm seed` → `pnpm dev`.
- Frontend: http://localhost:5173
- Backend health: http://localhost:3001/api/health (kỳ vọng `{"success":true,...}`)
- Tài khoản mặc định: `admin / admin123456` (quyền ADMIN).
- File Excel mẫu: `pnpm --filter @ioffice/backend fixture` → `backend/fixtures/sample-ioffice.xlsx`.

## 3. Phân quyền (rất quan trọng khi test)
| Chức năng | USER | ADMIN |
|---|---|---|
| Đăng nhập, Dashboard, Văn bản, Báo cáo, Xuất Excel | Có | Có |
| Import file Excel | Có | Có |
| Xem Rules / Unit mappings / Signers | Có | Có |
| Thêm/sửa/xóa Rules, Unit mappings, Signers | Không (403 FORBIDDEN) | Có |
| Xóa văn bản, xóa import, đọc lại file gốc (reprocess) | Không (403) | Có |
| Quản lý người dùng | Không | Có |

Mỗi lần test chức năng quản trị, phải test lại bằng tài khoản USER để xác nhận bị chặn (403), kể cả gọi API trực tiếp.

## 4. Danh sách màn hình
- `/login` Đăng nhập
- `/` Dashboard tổng quan
- `/import` Tải file Excel (preview trước khi lưu)
- `/documents` Danh sách văn bản (tìm kiếm, lọc, sắp xếp, phân trang)
- `/reports` Báo cáo + xuất Excel
- `/assistant` Trợ lý AI (chỉ hoạt động khi cấu hình `OPENAI_API_KEY`)
- `/rules` Quy tắc phân loại
- `/unit-mappings` Ánh xạ tên đơn vị
- `/signers` Danh mục người ký
- `/imports` Lịch sử import
- `/snapshots` Kết quả đã lưu
- `/users` Người dùng

## 5. Quy tắc nghiệp vụ QC cần nắm

### 5.1 Cột bắt buộc trong Excel
`Trích yếu`, `Số ký hiệu`, `Văn bản ký số`, `Ngày ban hành`, `Đơn vị ban hành`.
Thiếu bất kỳ cột nào → API trả lỗi `MISSING_REQUIRED_COLUMNS` và KHÔNG lưu dòng nào.

### 5.2 Phân loại văn bản (mặc định sau seed)
- `BC` → Báo cáo / Tờ trình
- `TTr` → Báo cáo / Tờ trình
- `CV` → Công văn / Ủy quyền
- `UQ` → Công văn / Ủy quyền
- Không khớp → Thư công tác

Hành vi xác định (deterministic), cần test đúng thứ tự ưu tiên:
1. Trường hợp đặc biệt NHNo/Agribank chạy TRƯỚC các rule từ khóa.
2. `priority` số nhỏ hơn thắng.
3. Rule bị tắt (disabled) bị bỏ qua.
4. So khớp theo token: `BC` KHÔNG khớp với `ABC`.

Ví dụ NHNo: `Số ký hiệu = 12969/NHNo-ALCO`, `Đơn vị ban hành = NHNo`
→ đơn vị chuẩn hóa lấy theo hậu tố `-ALCO`, nhóm = Công văn / Ủy quyền.

### 5.3 Chuẩn hóa dữ liệu
- Text: gộp nhiều khoảng trắng thành một, cắt khoảng trắng đầu/cuối, chuẩn Unicode NFC.
- Ngày: nhận `dd/mm/yyyy`, `dd-mm-yyyy`, số serial Excel, ISO. Không parse được → để trống.
- Ký số: coi là ĐÃ KÝ nếu giá trị chứa `đã ký số`, `da ky so`, `signed`, `true`, `yes`, `1`, `x`. Rỗng → chưa ký.
- Ánh xạ đơn vị: so khớp bỏ dấu, không phân biệt hoa/thường (`Trụ Sở Chính` = `tru so chinh`).

### 5.4 Snapshot (Kết quả đã lưu) là BẤT BIẾN
Khi lưu snapshot, hệ thống copy dữ liệu văn bản hiện tại và bộ rule đang áp dụng.
Sau đó sửa văn bản / rule / mapping đều KHÔNG được làm thay đổi snapshot cũ. Đây là điểm QC phải test kỹ.
So sánh 2 snapshot dựa trên định danh: `Số ký hiệu + Ngày ban hành + Trích yếu`; các trường so sánh là nhóm văn bản, đơn vị chuẩn hóa, trạng thái ký số.

### 5.5 Định dạng phản hồi API
Thành công: `{ "success": true, "data": {...} }`
Lỗi: `{ "success": false, "error": { "code": "...", "message": "..." } }`
Mã lỗi thường gặp: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `*_NOT_FOUND` (404), `SIGNER_EXISTS`/`*_EXISTS` (409), `AI_DISABLED` (503), `INTERNAL_ERROR` (500).

## 6. Test case

Ký hiệu: P = Pass mong đợi. Mỗi case ghi rõ Tiền điều kiện / Bước / Kỳ vọng.

### 6.1 Đăng nhập & phân quyền (AUTH)
| ID | Bước | Kỳ vọng |
|---|---|---|
| AUTH-01 | Đăng nhập `admin/admin123456` | Vào Dashboard, menu hiển thị đầy đủ |
| AUTH-02 | Đăng nhập sai mật khẩu | Thông báo lỗi, không vào được hệ thống |
| AUTH-03 | Để trống username/password rồi submit | Báo lỗi validate, không gọi API thành công |
| AUTH-04 | Chưa đăng nhập, mở trực tiếp `/documents` | Bị chuyển về `/login` |
| AUTH-05 | Gọi `GET /api/documents` không có token | 401 `UNAUTHORIZED` |
| AUTH-06 | Đăng nhập USER, mở `/users` | Không được phép quản lý người dùng |
| AUTH-07 | USER gọi `DELETE /api/documents/:id` | 403 `FORBIDDEN` |
| AUTH-08 | Đăng xuất rồi Back trên trình duyệt | Không xem được dữ liệu, yêu cầu đăng nhập lại |

### 6.2 Import Excel (IMP)
| ID | Bước | Kỳ vọng |
|---|---|---|
| IMP-01 | Import file mẫu hợp lệ | Preview hiển thị đúng số dòng, sau khi lưu tạo import mới |
| IMP-02 | Xem preview trước khi lưu | Chỉ hiển thị dữ liệu, chưa lưu vào hệ thống (Lịch sử import chưa có bản ghi) |
| IMP-03 | Import file thiếu cột `Ngày ban hành` | Lỗi `MISSING_REQUIRED_COLUMNS`, không tạo văn bản nào |
| IMP-04 | Submit không chọn file | Lỗi `FILE_REQUIRED` |
| IMP-05 | Import file không phải Excel (.txt, .pdf) | Báo lỗi rõ ràng, không crash |
| IMP-06 | Import file Excel rỗng (chỉ có header) | Import 0 văn bản, không lỗi hệ thống |
| IMP-07 | Import file > `MAX_UPLOAD_SIZE_MB` (mặc định 50MB) | Báo lỗi vượt kích thước |
| IMP-08 | Import file có dòng trùng lặp hoàn toàn | Các dòng gốc được giữ lại (không tự ý loại bỏ) |
| IMP-09 | Import file có ngày sai định dạng (`32/13/2025`) | Văn bản vẫn tạo, ngày ban hành trống, không crash |
| IMP-10 | Import 2 lần cùng 1 file | Tạo 2 import riêng biệt, không ảnh hưởng nhau |

### 6.3 Lịch sử import (HIS)
| ID | Bước | Kỳ vọng |
|---|---|---|
| HIS-01 | Mở `/imports` | Danh sách sắp xếp mới nhất trước, có người tải lên, số văn bản, số kết quả đã lưu |
| HIS-02 | Mở chi tiết 1 import | Hiển thị đúng danh sách văn bản của import đó |
| HIS-03 | Nhấn "Đọc lại file gốc" (ADMIN) | Import được dựng lại từ file Excel đã lưu, số văn bản cập nhật đúng |
| HIS-04 | USER nhấn/gọi API reprocess | 403 `FORBIDDEN` |
| HIS-05 | ADMIN xóa 1 import | Import, các văn bản và kết quả đã lưu liên quan bị xóa; các import khác không đổi |
| HIS-06 | Mở import với id không tồn tại | 404 `IMPORT_NOT_FOUND` |
| HIS-07 | Xuất Excel của 1 import | Tải được file .xlsx, mở được, dữ liệu khớp màn hình |
| HIS-08 | ADMIN chạy "phân loại lại tất cả" sau khi sửa rule | Văn bản cũ được phân loại lại theo rule mới, báo cáo số bản xử lý |

### 6.4 Danh sách văn bản (DOC)
| ID | Bước | Kỳ vọng |
|---|---|---|
| DOC-01 | Tìm kiếm theo trích yếu / số ký hiệu | Chỉ trả kết quả khớp |
| DOC-02 | Tìm kiếm có dấu và không dấu, hoa/thường | Kết quả tương đương |
| DOC-03 | Lọc theo đơn vị | Chỉ còn văn bản của đơn vị đã chọn |
| DOC-04 | Lọc theo nhóm văn bản | Chỉ còn nhóm đã chọn |
| DOC-05 | Lọc khoảng ngày `from`–`to` | Chỉ văn bản trong khoảng, bao gồm 2 mốc biên |
| DOC-06 | Lọc `from` > `to` | Trả 0 kết quả, không lỗi hệ thống |
| DOC-07 | Sắp xếp theo Ngày ban hành / Số ký hiệu / Trích yếu / Đơn vị / Nhóm, cả tăng và giảm | Thứ tự đúng |
| DOC-08 | Phân trang: sang trang 2, đổi số dòng/trang | Dữ liệu không trùng lặp giữa các trang, tổng số đúng |
| DOC-09 | `pageSize=0` hoặc `pageSize=101` qua API | 400 `VALIDATION_ERROR` (hợp lệ: 1–100) |
| DOC-10 | Kết hợp nhiều điều kiện lọc + sắp xếp + phân trang | Kết quả đúng và giữ nguyên khi đổi trang |
| DOC-11 | ADMIN xóa 1 văn bản | Văn bản mất khỏi danh sách, số liệu báo cáo cập nhật |
| DOC-12 | Mở văn bản với id không tồn tại | 404 `DOCUMENT_NOT_FOUND` |

### 6.5 Dashboard & Báo cáo (RPT)
| ID | Bước | Kỳ vọng |
|---|---|---|
| RPT-01 | Mở Dashboard khi chưa có dữ liệu | Hiển thị trạng thái trống, không lỗi |
| RPT-02 | Mở Dashboard sau import | Số liệu tổng khớp với danh sách văn bản |
| RPT-03 | Kiểm tra bảng theo đơn vị | Tổng số, số đã ký, tỷ lệ ký của từng nhóm tính đúng |
| RPT-04 | Kiểm tra tỷ lệ khi tổng = 0 | Hiển thị 0% (không lỗi chia cho 0, không `NaN`) |
| RPT-05 | Kiểm tra bảng theo người ký | Sắp xếp theo tổng số văn bản giảm dần; văn bản không có người ký bị loại khỏi bảng này |
| RPT-06 | Áp bộ lọc rồi xem báo cáo | Số liệu đổi theo bộ lọc |
| RPT-07 | Xuất Excel báo cáo | Tên file dạng `ioffice-report-YYYY-MM-DD.xlsx`, nội dung khớp bộ lọc đang áp |
| RPT-08 | Đối chiếu tay 1 đơn vị (đếm thủ công từ file gốc) | Trùng khớp với số liệu hệ thống |

### 6.6 Quy tắc phân loại (RUL)
| ID | Bước | Kỳ vọng |
|---|---|---|
| RUL-01 | Xem danh sách rule sau seed | Có đủ BC, TTr, CV, UQ |
| RUL-02 | Tạo rule mới với từ khóa mới, import lại | Văn bản khớp được phân đúng nhóm mới |
| RUL-03 | Tạo 2 rule cùng khớp, khác `priority` | Rule có `priority` nhỏ hơn thắng |
| RUL-04 | Tắt (disable) 1 rule rồi phân loại lại | Rule bị bỏ qua, văn bản chuyển sang nhóm khác/Thư công tác |
| RUL-05 | Văn bản có số ký hiệu `123/ABC` | KHÔNG bị khớp rule `BC` (khớp theo token) |
| RUL-06 | Văn bản NHNo/Agribank + rule từ khóa cùng khớp | Ưu tiên xử lý NHNo/Agribank |
| RUL-07 | Tạo rule với từ khóa rỗng | 400 `VALIDATION_ERROR` |
| RUL-08 | USER thử tạo/sửa/xóa rule | 403 `FORBIDDEN` |
| RUL-09 | Xóa rule đang dùng rồi phân loại lại | Văn bản rơi về nhóm mặc định Thư công tác |

### 6.7 Ánh xạ đơn vị (MAP)
| ID | Bước | Kỳ vọng |
|---|---|---|
| MAP-01 | Tạo mapping `TTKH` → tên đầy đủ, import lại | Đơn vị chuẩn hóa hiển thị tên đầy đủ |
| MAP-02 | Nhập nguồn khác dấu/khác hoa thường | Vẫn khớp mapping |
| MAP-03 | Tắt mapping | Đơn vị giữ nguyên tên gốc |
| MAP-04 | Đơn vị không có mapping | Giữ nguyên tên gốc (đã chuẩn hóa khoảng trắng) |
| MAP-05 | USER thử thêm/sửa/xóa mapping | 403 `FORBIDDEN` |

### 6.8 Người ký (SGN)
| ID | Bước | Kỳ vọng |
|---|---|---|
| SGN-01 | Tạo người ký mới (ADMIN) | Tạo thành công, xuất hiện trong danh sách |
| SGN-02 | Tạo trùng `username` | 409 `SIGNER_EXISTS` |
| SGN-03 | Bỏ trống `fullName` hoặc `position` | 400 `VALIDATION_ERROR` |
| SGN-04 | Tìm kiếm theo username / họ tên / chức vụ | Kết quả khớp, không phân biệt hoa thường |
| SGN-05 | Lọc theo chức vụ | Chỉ còn người ký đúng chức vụ |
| SGN-06 | Sửa, xóa người ký | Cập nhật đúng; USER bị chặn 403 |

### 6.9 Kết quả đã lưu / Snapshot (SNP)
| ID | Bước | Kỳ vọng |
|---|---|---|
| SNP-01 | Lưu 1 kết quả từ dữ liệu hiện tại | Tạo snapshot kèm bảng kết quả và bản copy văn bản nguồn |
| SNP-02 | Sau khi lưu, sửa rule rồi phân loại lại, mở lại snapshot | Snapshot KHÔNG đổi (bất biến) |
| SNP-03 | Sau khi lưu, xóa văn bản gốc, mở lại snapshot | Snapshot vẫn đủ dữ liệu |
| SNP-04 | Xem danh sách văn bản trong snapshot | Khớp thời điểm lưu |
| SNP-05 | Xuất Excel snapshot | Tải được file, dữ liệu khớp snapshot |
| SNP-06 | So sánh 2 snapshot khác nhau | Chỉ ra thay đổi về nhóm văn bản, đơn vị chuẩn hóa, trạng thái ký số |
| SNP-07 | So sánh snapshot với chính nó | Không có thay đổi |
| SNP-08 | So sánh thiếu `leftId`/`rightId` | 400 `VALIDATION_ERROR` |
| SNP-09 | Xóa snapshot | Snapshot và bản copy văn bản bị xóa; văn bản gốc KHÔNG bị xóa |
| SNP-10 | Mở snapshot id không tồn tại | 404 |

### 6.10 Người dùng (USR)
| ID | Bước | Kỳ vọng |
|---|---|---|
| USR-01 | Tạo user mới role USER | Đăng nhập được, chỉ thấy quyền hạn chế |
| USR-02 | Tạo user trùng username | Báo lỗi trùng (409) |
| USR-03 | Đổi role USER → ADMIN | Sau khi đăng nhập lại có đủ quyền quản trị |
| USR-04 | Đổi mật khẩu user rồi đăng nhập | Mật khẩu cũ không dùng được, mật khẩu mới dùng được |
| USR-05 | Xóa user | Không đăng nhập được nữa |
| USR-06 | Xem chi tiết bản ghi user qua API | Không trả về mật khẩu/hash |

### 6.11 Trợ lý AI (AI)
| ID | Bước | Kỳ vọng |
|---|---|---|
| AI-01 | Mở `/assistant` khi chưa cấu hình `OPENAI_API_KEY` | Thông báo chức năng chưa bật (503 `AI_DISABLED`), không crash |
| AI-02 | Mở `/assistant` khi đã cấu hình khóa | Chat trả lời được, hiển thị dần (streaming) |
| AI-03 | Gửi tin nhắn rỗng hoặc dài hơn 8000 ký tự | 400 `VALIDATION_ERROR` |
| AI-04 | Gửi hội thoại nhiều hơn 40 tin nhắn | 400 `VALIDATION_ERROR` |
| AI-05 | Đổi tên và xóa phiên chat | Cập nhật đúng trong danh sách phiên |

## 7. Test dữ liệu biên (bảng gợi ý tạo file Excel test)
| Trường hợp | Giá trị đưa vào | Kỳ vọng |
|---|---|---|
| Trích yếu rất dài (>1000 ký tự) | chuỗi dài | Lưu được, giao diện không vỡ layout |
| Trích yếu nhiều khoảng trắng | `  Báo   cáo   quý  ` | Lưu thành `Báo cáo quý` |
| Ngày dạng serial Excel | ô định dạng Date | Hiển thị đúng ngày |
| Ngày `2025-03-01` | ISO | Hiển thị đúng ngày |
| Ngày rỗng | trống | Ngày ban hành trống |
| Ký số = `Đã ký số` / `x` / `1` | | Tính là đã ký |
| Ký số rỗng / `Chưa ký` | | Tính là chưa ký |
| Số ký hiệu có ký tự đặc biệt | `12/QĐ-NHNo (bổ sung)` | Không lỗi, phân loại theo token |
| Đơn vị viết hoa toàn bộ | `TRỤ SỞ CHÍNH` | Ánh xạ đúng về `Trụ sở chính` |
| Số ký hiệu NHNo có hậu tố lạ | `999/NHNo-XYZ` | Không crash, giữ hậu tố làm đơn vị |

## 8. Kiểm tra phi chức năng
- Hiệu năng: import file ~5.000 dòng hoàn tất trong thời gian chấp nhận được; danh sách và báo cáo vẫn phản hồi.
- Bảo mật: mọi API (trừ `/api/health`, `/api/auth/login`) yêu cầu token; token sai/hết hạn → 401; USER không vượt quyền được bằng cách gọi API trực tiếp.
- Không rò rỉ dữ liệu: phản hồi lỗi ở môi trường production không chứa stack trace.
- CORS: chỉ origin cấu hình trong `CORS_ORIGIN` gọi được API.
- Trình duyệt: Chrome, Edge, Firefox bản mới.
- Trạng thái giao diện: mọi màn hình đều có trạng thái đang tải / trống / lỗi rõ ràng.
- Tải file: file Excel tải về mở được bằng Excel và LibreOffice, không lỗi định dạng.

## 9. Quy trình báo lỗi
Mỗi bug cần có: ID test case liên quan, môi trường, tài khoản/role, file Excel đầu vào (đính kèm),
các bước tái hiện, kết quả thực tế, kết quả mong đợi, ảnh chụp màn hình, và phản hồi API (mã lỗi + `error.code`) nếu có.
Mức độ: Blocker (không dùng được chức năng chính), Critical (sai số liệu báo cáo, sai phân quyền),
Major (sai nghiệp vụ ở nhánh phụ), Minor (giao diện, chính tả).

## 10. Điều kiện nghiệm thu
- 100% test case Blocker/Critical Pass: đăng nhập, phân quyền, import, phân loại, số liệu báo cáo, tính bất biến của snapshot, xuất Excel.
- Số liệu báo cáo đối chiếu tay với file Excel gốc trùng khớp trên ít nhất 3 đơn vị.
- Không còn bug Blocker/Critical mở.
