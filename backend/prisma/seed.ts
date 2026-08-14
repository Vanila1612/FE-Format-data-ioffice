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
    { sourceName: 'ALCO', normalizedName: 'ALCO' },
    { sourceName: 'Văn phòng Trụ sở chính', normalizedName: 'Trụ sở chính' },
    { sourceName: 'Trụ sở chính Agribank', normalizedName: 'Trụ sở chính' },
    { sourceName: 'Phòng Tổng hợp', normalizedName: 'Trụ sở chính' },
    { sourceName: 'Ban Kiểm soát', normalizedName: 'Ban Kiểm soát' },
    { sourceName: 'KIỂM TOÁN NỘI BỘ - BAN KIỂM SOÁT', normalizedName: 'Ban Kiểm soát' },
    { sourceName: 'Đảng Ủy Agribank', normalizedName: 'Đảng ủy Agribank' },
    { sourceName: 'Công đoàn cơ sở Trung tâm Thẻ', normalizedName: 'Trung tâm Thẻ' },
    { sourceName: 'Chi bộ Trung tâm PCRT', normalizedName: 'Trung tâm Phòng, chống rửa tiền' },
    { sourceName: 'TTKH', normalizedName: 'Trung tâm Dịch vụ thanh toán và kiều hối' },
    { sourceName: 'Ban Khách hàng doanh nghiệp', normalizedName: 'Ban Khách hàng Doanh nghiệp' }
  ];

  for (const mapping of mappings) {
    await prisma.unitMapping.upsert({
      where: { sourceName: mapping.sourceName },
      update: mapping,
      create: mapping
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
