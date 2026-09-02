import { DocumentGroup, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';

async function main() {
  await prisma.user.upsert({
    where: { username: env.ADMIN_USERNAME },
    update: {
      displayName: env.ADMIN_DISPLAY_NAME,
      role: UserRole.ADMIN
    },
    create: {
      username: env.ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
      displayName: env.ADMIN_DISPLAY_NAME,
      role: UserRole.ADMIN
    }
  });

  const rules = [
    { name: 'BC report', keyword: 'BC', documentGroup: DocumentGroup.REPORT_PROPOSAL, priority: 20 },
    { name: 'TTr proposal', keyword: 'TTr', documentGroup: DocumentGroup.REPORT_PROPOSAL, priority: 20 },
    { name: 'CV letter', keyword: 'CV', documentGroup: DocumentGroup.LETTER_AUTHORIZATION, priority: 30 },
    { name: 'UQ authorization', keyword: 'UQ', documentGroup: DocumentGroup.LETTER_AUTHORIZATION, priority: 30 }
  ];

  for (const rule of rules) {
    await prisma.classificationRule.upsert({
      where: { id: `${rule.keyword.toLowerCase()}-default` },
      update: rule,
      create: { id: `${rule.keyword.toLowerCase()}-default`, ...rule }
    });
  }

  const mappings = [
    { sourceName: 'Văn phòng Trụ sở chính', normalizedName: 'Văn phòng TSC' },
    { sourceName: 'Trụ sở chính Agribank', normalizedName: 'Văn phòng TSC' },
    { sourceName: 'TRỤ SỞ CHÍNH', normalizedName: 'Văn phòng TSC' },
    { sourceName: 'Phòng Tổng hợp', normalizedName: 'Văn phòng TSC' },
    { sourceName: 'Ban Kiểm soát', normalizedName: 'Ban Kiểm soát Agribank' },
    { sourceName: 'KIỂM TOÁN NỘI BỘ - BAN KIỂM SOÁT', normalizedName: 'Ban Kiểm soát Agribank' },
    { sourceName: 'Đảng Ủy Agribank', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: 'Công đoàn cơ sở Trung tâm Thẻ', normalizedName: 'Trung tâm Thẻ' },
    { sourceName: 'Chi bộ Trung tâm PCRT', normalizedName: 'Trung tâm Phòng, chống rửa tiền' },
    { sourceName: 'TTKH', normalizedName: 'TTDV TT&KH' },
    { sourceName: 'Ban Khách hàng doanh nghiệp', normalizedName: 'Ban Khách hàng Doanh nghiệp' },
    { sourceName: 'Văn phòng đại diện khu vực Tây Nam Bộ', normalizedName: 'Văn phòng đại diện khu vực Tây Nam Bộ' },
    { sourceName: 'Văn phòng đại diện Tây Nam Bộ', normalizedName: 'Văn phòng đại diện khu vực Tây Nam Bộ' },
    { sourceName: 'TTCNTT', normalizedName: 'Trung tâm Công nghệ thông tin' },
    { sourceName: 'TT CNTT', normalizedName: 'Trung tâm Công nghệ thông tin' },
    { sourceName: 'CNTT', normalizedName: 'Trung tâm Công nghệ thông tin' },
    { sourceName: 'Trung tâm Công nghê thông tin', normalizedName: 'Trung tâm Công nghệ thông tin' },
    { sourceName: 'Trung tâm Công nghệ thông tin', normalizedName: 'Trung tâm Công nghệ thông tin' },
    { sourceName: 'TTT', normalizedName: 'Trung tâm Thẻ' },
    { sourceName: 'TT Thẻ', normalizedName: 'Trung tâm Thẻ' },
    { sourceName: 'Trung tâm thẻ', normalizedName: 'Trung tâm Thẻ' },
    { sourceName: 'TĐTCB', normalizedName: 'Trường đào tạo cán bộ' },
    { sourceName: 'TDT  CB', normalizedName: 'Trường đào tạo cán bộ' },
    { sourceName: 'Trường ĐTCB', normalizedName: 'Trường đào tạo cán bộ' },
    { sourceName: 'Trường đào tạo cán bộ', normalizedName: 'Trường đào tạo cán bộ' },
    { sourceName: 'Ban Thư ký HĐTV', normalizedName: 'Ban Thư ký Hội đồng thành viên' },
    { sourceName: 'Ban thư ký HDTV', normalizedName: 'Ban Thư ký Hội đồng thành viên' },
    { sourceName: 'Thư ký HĐTV', normalizedName: 'Ban Thư ký Hội đồng thành viên' },
    { sourceName: 'TK HĐTV', normalizedName: 'Ban Thư ký Hội đồng thành viên' },
    { sourceName: 'Ban Thư ký Hội đông thành viên', normalizedName: 'Ban Thư ký Hội đồng thành viên' },
    { sourceName: 'Ban Thư ký Hội đồng thành viên', normalizedName: 'Ban Thư ký Hội đồng thành viên' },
    { sourceName: 'Tổ chức Đảng Ủy', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: 'Ban Tổ chức Đảng ủy', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: '[TEST] Bản Tổ chức Đảng ủy', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: 'Văn phòng Đảng ủy', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: '[ĐU] Cơ quan Ủy ban Kiểm tra Đảng ủy', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: 'Đảng ủy', normalizedName: 'Tổ chức Đảng Ủy' },
    { sourceName: 'UB QLRR', normalizedName: 'Ủy ban quản lý rủi ro Agribank' },
    { sourceName: 'Ủy ban QLRR', normalizedName: 'Ủy ban quản lý rủi ro Agribank' },
    { sourceName: 'Ủy ban quản lý rủi ro', normalizedName: 'Ủy ban quản lý rủi ro Agribank' },
    { sourceName: 'UB Chính sách', normalizedName: 'Ủy ban Chính sách' },
    { sourceName: 'Ủy ban CS', normalizedName: 'Ủy ban Chính sách' },
    { sourceName: 'BKS', normalizedName: 'Ban Kiểm soát Agribank' },
    { sourceName: 'Ban Kiểm soát Agribank', normalizedName: 'Ban Kiểm soát Agribank' },
    { sourceName: 'BAN KIỂM SOÁT', normalizedName: 'Ban Kiểm soát Agribank' },
    { sourceName: 'PC', normalizedName: 'Ban Pháp Chế' },
    { sourceName: 'Ban Pháp chế', normalizedName: 'Ban Pháp Chế' },
    { sourceName: 'TKTH', normalizedName: 'Ban Thư ký tổng hợp' },
    { sourceName: 'Ban TKTH', normalizedName: 'Ban Thư ký tổng hợp' },
    { sourceName: 'TH', normalizedName: 'Ban Thư ký tổng hợp' },
    { sourceName: 'Ban Thư ký Tổng hợp', normalizedName: 'Ban Thư ký tổng hợp' },
    { sourceName: 'Ban Thậm định và phê duyệt tín dụng', normalizedName: 'Ban Thẩm định và phê duyệt tín dụng' },
    { sourceName: 'Ban Thẩm định và Phê duyệt tín dụng', normalizedName: 'Ban Thẩm định và phê duyệt tín dụng' },
    { sourceName: 'Ban Thẩm định phê duyệt tín dụng', normalizedName: 'Ban Thẩm định và phê duyệt tín dụng' },
    { sourceName: 'TD PDTD', normalizedName: 'Ban Thẩm định và phê duyệt tín dụng' },
    { sourceName: 'KTGS', normalizedName: 'Ban Kiểm tra, giám sát nội bộ' },
    { sourceName: 'KTGSNB', normalizedName: 'Ban Kiểm tra, giám sát nội bộ' },
    { sourceName: 'KTNB', normalizedName: 'Ban Kiểm tra, giám sát nội bộ' },
    { sourceName: 'QLĐT', normalizedName: 'Ban Quản lý đầu tư nội ngành' },
    { sourceName: 'QLDT', normalizedName: 'Ban Quản lý đầu tư nội ngành' },
    { sourceName: 'KHCL', normalizedName: 'Ban Kế hoạch chiến lược' },
    { sourceName: 'Ban KHCL', normalizedName: 'Ban Kế hoạch chiến lược' },
    { sourceName: 'ĐCTC', normalizedName: 'Ban Định chế tài chính' },
    { sourceName: 'DCTC', normalizedName: 'Ban Định chế tài chính' },
    { sourceName: 'ĐTCPH', normalizedName: 'Ban Đầu tư và Cổ phần hóa' },
    { sourceName: 'DTCPH', normalizedName: 'Ban Đầu tư và Cổ phần hóa' },
    { sourceName: 'TTTT', normalizedName: 'Trung tâm Thanh toán' },
    { sourceName: 'TT Thanh toán', normalizedName: 'Trung tâm Thanh toán' },
    { sourceName: 'Chi bộ TTTT', normalizedName: 'Trung tâm Thanh toán' },
    { sourceName: 'TTV', normalizedName: 'Trung tâm vốn' },
    { sourceName: 'Trung tâm vốn', normalizedName: 'Trung tâm vốn' },
    { sourceName: 'Trung tâm Dịch vụ thanh toán và kiều hối', normalizedName: 'TTDV TT&KH' },
    { sourceName: 'TTDV TT&KH', normalizedName: 'TTDV TT&KH' },
    { sourceName: 'TTDV TTKH', normalizedName: 'TTDV TT&KH' },
    { sourceName: 'TCKT', normalizedName: 'Ban Tài chính kế toán' },
    { sourceName: 'VPCĐ', normalizedName: 'Văn Phòng Công đoàn' },
    { sourceName: 'Văn phòng Công đoàn', normalizedName: 'Văn Phòng Công đoàn' },
    { sourceName: 'Cơ quan Công đoàn', normalizedName: 'Văn Phòng Công đoàn' },
    { sourceName: 'Ban QLDA ĐTXDKV', normalizedName: 'Ban QLDA ĐTXDKV' },
    { sourceName: 'QLDA ĐTXDKV', normalizedName: 'Ban QLDA ĐTXDKV' },
    { sourceName: 'Ban Quản lý Dự án Đầu tư Xây dựng khu vực', normalizedName: 'Ban QLDA ĐTXDKV' },
    { sourceName: 'VP TSC', normalizedName: 'Văn phòng TSC' },
    { sourceName: 'VPTSC', normalizedName: 'Văn phòng TSC' },
    { sourceName: 'UBĐT', normalizedName: 'Uỷ ban đầu tư' },
    { sourceName: 'Ủy ban đầu tư', normalizedName: 'Uỷ ban đầu tư' },
    { sourceName: 'QLNCVĐ', normalizedName: 'Trung tâm quản lý nợ có vấn đề' },
    { sourceName: 'QLNCVD', normalizedName: 'Trung tâm quản lý nợ có vấn đề' },
    { sourceName: 'Trung tâm QLNCVĐ', normalizedName: 'Trung tâm quản lý nợ có vấn đề' },
    { sourceName: 'TRUNG TÂM QUẢN LÝ NỢ CVĐ', normalizedName: 'Trung tâm quản lý nợ có vấn đề' },
    { sourceName: 'QLRRTD', normalizedName: 'Trung tâm Quản lý rủi ro tín dụng' },
    { sourceName: 'Trung tâm QLRRTD', normalizedName: 'Trung tâm Quản lý rủi ro tín dụng' },
    { sourceName: 'CSTD', normalizedName: 'Ban Chính sách tín dụng' },
    { sourceName: 'KHCN', normalizedName: 'Ban Khách hàng cá nhân' },
    { sourceName: 'KHDN', normalizedName: 'Ban Khách hàng Doanh nghiệp' },
    { sourceName: 'CN', normalizedName: 'Ban Công nghệ' },
    { sourceName: 'Ban Công nghệ', normalizedName: 'Ban Công nghệ' },
    { sourceName: 'Ban ALCO', normalizedName: 'Ban Quản lý Tài sản Nợ - Tài sản Có' },
    { sourceName: 'Ban Quản lý TS Nợ - TS Có', normalizedName: 'Ban Quản lý Tài sản Nợ - Tài sản Có' },
    { sourceName: 'QLTSN TSC', normalizedName: 'Ban Quản lý Tài sản Nợ - Tài sản Có' },
    { sourceName: 'TTTM', normalizedName: 'Trung tâm Tài trợ Thương Mại' },
    { sourceName: 'Trung Tâm Tài Trợ Thương Mại', normalizedName: 'Trung tâm Tài trợ Thương Mại' },
    { sourceName: 'Tài trợ thương mại', normalizedName: 'Trung tâm Tài trợ Thương Mại' },
    { sourceName: 'PDTD HCM', normalizedName: 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh' },
    { sourceName: 'PDTD TPHCM', normalizedName: 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh' },
    { sourceName: 'TTPD', normalizedName: 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh' },
    { sourceName: 'Trung tâm phê duyệt tín dụng tại TP.HCM', normalizedName: 'Trung tâm Phê duyệt tín dụng Tp Hồ Chí Minh' },
    { sourceName: 'UBNS', normalizedName: 'Ủy ban Nhân sự' },
    { sourceName: 'Ủy ban nhân sự', normalizedName: 'Ủy ban Nhân sự' },
    { sourceName: 'PCRT', normalizedName: 'Trung tâm Phòng, Chống rửa tiền' },
    { sourceName: 'Trung tâm PCRT', normalizedName: 'Trung tâm Phòng, Chống rửa tiền' },
    { sourceName: 'CQ Đoàn Thanh niên', normalizedName: 'Cơ quan Đoàn Thanh niên' },
    { sourceName: 'Đoàn Thanh niên', normalizedName: 'Cơ quan Đoàn Thanh niên' },
    { sourceName: 'Ban QLDA ĐTXD TSC', normalizedName: 'Ban Quản lý dự án ĐTXD TSC' },
    { sourceName: 'QLDA ĐTXD TSC', normalizedName: 'Ban Quản lý dự án ĐTXD TSC' },
    { sourceName: 'TTDL', normalizedName: 'Trung tâm quản lý dữ liệu' },
    { sourceName: 'Trung tâm QLDL', normalizedName: 'Trung tâm quản lý dữ liệu' },
    { sourceName: 'Trung tâm Quản lý dữ liệu', normalizedName: 'Trung tâm quản lý dữ liệu' },
    { sourceName: 'VPĐD miền Trung', normalizedName: 'Văn phòng đại diện Khu vực miền Trung' },
    { sourceName: 'VPĐD KV MIỀN TRUNG', normalizedName: 'Văn phòng đại diện Khu vực miền Trung' },
    { sourceName: 'Văn phòng đại diện Miền Trung', normalizedName: 'Văn phòng đại diện Khu vực miền Trung' },
    { sourceName: 'VPĐD miền Nam', normalizedName: 'Văn phòng đại diện Khu vực Miền Nam' },
    { sourceName: 'Văn phòng đại diện Miền Nam', normalizedName: 'Văn phòng đại diện Khu vực Miền Nam' },
    { sourceName: 'Đảng ủy Văn phòng đại diện Miền Nam', normalizedName: 'Văn phòng đại diện Khu vực Miền Nam' },
    { sourceName: 'QLRRPTD', normalizedName: 'Trung tâm Quản lý rủi ro phi tín dụng' },
    { sourceName: 'Trung tâm QLRR phi tín dụng', normalizedName: 'Trung tâm Quản lý rủi ro phi tín dụng' },
    { sourceName: 'Trung tâm Quản lý Rủi ro Phi tín dụng', normalizedName: 'Trung tâm Quản lý rủi ro phi tín dụng' },
    { sourceName: 'TCNS', normalizedName: 'Ban Tổ chức nhân sự' },
    { sourceName: 'CSKH', normalizedName: 'Chăm sóc khách hàng' },
    { sourceName: 'Trung tâm CSKH', normalizedName: 'Chăm sóc khách hàng' },
    { sourceName: 'TRUNG TÂM CHĂM SÓC KHÁCH HÀNG', normalizedName: 'Chăm sóc khách hàng' },
    { sourceName: 'NHS', normalizedName: 'Ban Ngân hàng số' }
  ];

  for (const mapping of mappings) {
    await prisma.unitMapping.upsert({
      where: { sourceName: mapping.sourceName },
      update: mapping,
      create: mapping
    });
  }

  const signers = [
    { username: 'phamtoanvuong', fullName: 'Phạm Toàn Vượng', position: 'Tổng Giám đốc' },
    { username: 'binhpt.tsc', fullName: 'Phùng Thị Bình', position: 'Phó Tổng Giám đốc' },
    { username: 'thanhpc', fullName: 'Phạm Chí Thành', position: 'Phó Tổng Giám đốc' },
    { username: 'hoangminhngoc', fullName: 'Hoàng Minh Ngọc', position: 'Phó Tổng Giám đốc' },
    { username: 'xuatlevan', fullName: 'Lê Văn Xuất', position: 'Phó Tổng Giám đốc' },
    { username: 'nguyenquanghung', fullName: 'Nguyễn Quang Hùng', position: 'Phó Tổng Giám đốc' },
    { username: 'luudn', fullName: 'Đoàn Ngọc Lưu', position: 'Phó Tổng Giám đốc' },
    { username: 'doducthanh', fullName: 'Đỗ Đức Thành', position: 'Phó Tổng Giám đốc' },
    { username: 'phuclh', fullName: 'Lê Hồng Phúc', position: 'Phó Tổng Giám đốc' },
    { username: 'linhvuonghong', fullName: 'Vương Hồng Lĩnh', position: 'Phó Tổng Giám đốc' }
  ];

  for (const signer of signers) {
    await prisma.signer.upsert({
      where: { username: signer.username },
      update: signer,
      create: signer
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
