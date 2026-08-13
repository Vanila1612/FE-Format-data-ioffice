CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "DocumentGroup" AS ENUM ('REPORT_PROPOSAL', 'LETTER_AUTHORIZATION', 'WORK_LETTER');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "imports" (
  "id" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "storedFileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "signedDocument" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3),
  "issuingUnit" TEXT NOT NULL,
  "normalizedUnit" TEXT NOT NULL,
  "documentGroup" "DocumentGroup" NOT NULL,
  "rawData" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classification_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "documentGroup" "DocumentGroup" NOT NULL,
  "priority" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unit_mappings" (
  "id" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "unit_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rule_versions" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "rulesJson" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "snapshots" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "ruleVersionId" TEXT NOT NULL,
  "mappingVersion" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "description" TEXT,
  CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "snapshot_documents" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "originalDocumentId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "signedDocument" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3),
  "issuingUnit" TEXT NOT NULL,
  "normalizedUnit" TEXT NOT NULL,
  "documentGroup" "DocumentGroup" NOT NULL,
  "rawData" JSONB NOT NULL,
  CONSTRAINT "snapshot_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "imports_status_idx" ON "imports"("status");
CREATE INDEX "imports_createdAt_idx" ON "imports"("createdAt");
CREATE INDEX "documents_importId_idx" ON "documents"("importId");
CREATE INDEX "documents_referenceNumber_idx" ON "documents"("referenceNumber");
CREATE INDEX "documents_issuingUnit_idx" ON "documents"("issuingUnit");
CREATE INDEX "documents_normalizedUnit_idx" ON "documents"("normalizedUnit");
CREATE INDEX "documents_documentGroup_idx" ON "documents"("documentGroup");
CREATE INDEX "documents_issueDate_idx" ON "documents"("issueDate");
CREATE INDEX "classification_rules_enabled_priority_idx" ON "classification_rules"("enabled", "priority");
CREATE UNIQUE INDEX "unit_mappings_sourceName_key" ON "unit_mappings"("sourceName");
CREATE INDEX "unit_mappings_enabled_idx" ON "unit_mappings"("enabled");
CREATE UNIQUE INDEX "rule_versions_version_key" ON "rule_versions"("version");
CREATE INDEX "snapshots_importId_idx" ON "snapshots"("importId");
CREATE INDEX "snapshots_createdAt_idx" ON "snapshots"("createdAt");
CREATE INDEX "snapshot_documents_snapshotId_idx" ON "snapshot_documents"("snapshotId");
CREATE INDEX "snapshot_documents_originalDocumentId_idx" ON "snapshot_documents"("originalDocumentId");
CREATE INDEX "snapshot_documents_documentGroup_idx" ON "snapshot_documents"("documentGroup");

ALTER TABLE "imports" ADD CONSTRAINT "imports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snapshot_documents" ADD CONSTRAINT "snapshot_documents_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
