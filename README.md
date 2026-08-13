# iOffice · Rà soát văn bản đi

Web app tổng hợp dữ liệu văn bản đi từ file Excel iOffice. Ứng dụng chạy hoàn toàn trên trình duyệt: file nguồn không được gửi đến máy chủ.

## Chức năng hiện có

- Nhập file `.xlsx` / `.xls` nguồn từ iOffice.
- Kiểm tra các cột bắt buộc: `Trích yếu`, `Số ký hiệu`, `Văn bản ký số`, `Ngày ban hành`, `Đơn vị ban hành`.
- Xem trước dữ liệu trước khi tạo báo cáo.
- Tổng hợp theo đơn vị ban hành, với tổng số văn bản, số văn bản đã ký số và tỷ lệ ký.
- Tìm kiếm, sắp xếp bảng kết quả và tải bảng tổng hợp về Excel.
- Điều chỉnh các từ khóa phân loại ngay trên giao diện.

## Quy tắc mặc định

| Điều kiện | Nhóm đầu ra |
| --- | --- |
| `Số ký hiệu` có `BC` hoặc `TTr` | Báo cáo / Tờ trình |
| `Số ký hiệu` có `CV` hoặc `UQ` | Công văn / Ủy quyền |
| Không thuộc hai nhóm trên | Thư công tác |
| `Đơn vị ban hành` là `NHNo` hoặc tên đầy đủ Agribank | Luôn là Công văn / Ủy quyền; đơn vị lấy mã sau dấu `-` trong `Số ký hiệu` |

Ví dụ: `12969/NHNo-ALCO` được ghi nhận cho đơn vị `ALCO` và nhóm Công văn / Ủy quyền.

## Chạy dự án

Yêu cầu: Node.js 22+.

Cài dependency một lần:

```bash
npm install
```

Chạy môi trường phát triển (frontend và API đồng thời):

```bash
npm run dev
```

Mở [http://localhost:5173](http://localhost:5173).

Chạy theo chế độ production:

```bash
npm run build
npm start
```

Mở [http://localhost:3001](http://localhost:3001).

## Công nghệ

- Frontend: React 19 + Vite.
- Backend: Express.
- Database: SQLite (`data/ioffice.db`), lưu lịch sử import, văn bản đã nhập và rule phân loại.
- Excel: SheetJS ở cả backend (đọc) và frontend (xuất báo cáo).

Các bước phát triển tiếp nên gồm:

1. Bổ sung màn hình quản lý mapping tên đơn vị và các ngoại lệ.
2. Thêm đối chiếu với file kết quả chuẩn và danh sách dòng chênh lệch.
3. Nếu có nhiều người sử dụng, thêm đăng nhập và phân quyền.

## Cấu trúc thư mục

```text
.
├── src/            # React frontend
├── server/         # Express API và SQLite
├── data/           # Database local (tự tạo, không commit)
├── index.html      # Điểm khởi động Vite
├── package.json
└── README.md
```
