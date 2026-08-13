# iOffice - Rà soát văn bản đi

Internal web application for uploading Excel exports from iOffice, validating and parsing outgoing-document data, classifying documents, reviewing dashboards/reports, exporting Excel files, and preserving immutable snapshots.

## Features

- React + Vite frontend with login, sidebar layout, dashboard, import, documents, reports, rules, unit mappings, import history, snapshots, and settings pages.
- Express + TypeScript backend with REST APIs, centralized error handling, upload validation, JWT auth, and admin-only rule/mapping management.
- PostgreSQL + Prisma schema, migration, seed data, indexes, relations, and transactions for import and snapshot creation.
- Server-side Excel upload and parsing with SheetJS.
- Required Excel header validation.
- Backend classification engine with editable rules, priority, enabled status, and NHNo/Agribank special handling.
- Server-side document search, filter, sort, and pagination.
- Excel export for reports/import documents and snapshots.
- Immutable snapshot storage in `snapshot_documents`.
- Docker Compose for frontend, backend, and PostgreSQL with persistent volumes.
- Backup/restore scripts for PostgreSQL plus uploaded/snapshot storage.

## Architecture

```text
frontend/ React 19 + Vite + TypeScript
    -> REST /api
backend/ Express + TypeScript + Prisma
    -> PostgreSQL
    -> storage/uploads, storage/exports, storage/snapshots
```

## Requirements

- Node.js 22+
- pnpm
- Docker Desktop / Docker Compose for PostgreSQL and container deployment

## Environment

Copy `.env.example` to `.env` for local development if you want custom values.

Important variables:

```env
DATABASE_URL=postgresql://ioffice:ioffice@localhost:5432/ioffice
JWT_SECRET=change-me-to-a-long-random-secret
CORS_ORIGIN=http://localhost:5173
MAX_UPLOAD_SIZE_MB=50
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123456
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Run migrations and seed:

```bash
pnpm prisma:migrate
pnpm seed
```

Start frontend and backend:

```bash
pnpm dev
```

Frontend: `http://localhost:5173`

Backend health: `http://localhost:3001/api/health`

## Local Import Without Database

For the current quick-check workflow, you can validate the Excel import and see normalized/classified results without PostgreSQL or backend storage:

```bash
pnpm --filter @ioffice/frontend dev
```

Open `http://localhost:5173`, choose `Dùng chế độ local`, then go to Import and select an `.xlsx` or `.xls` file.

This mode:

- reads the Excel file in the browser,
- validates required columns,
- trims and normalizes document fields,
- applies the default classification rules,
- applies the NHNo/Agribank special case,
- shows the normalized result table,
- does not save anything to the database.

Default dev login:

```text
admin / admin123456
```

## Docker

Development stack:

```bash
docker compose up -d --build
```

Production stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Persistent volumes:

- `postgres_data`
- `app_storage`

## Excel Format

Required columns:

- `Trích yếu`
- `Số ký hiệu`
- `Văn bản ký số`
- `Ngày ban hành`
- `Đơn vị ban hành`

If required columns are missing, the API returns `MISSING_REQUIRED_COLUMNS` and does not insert invalid document rows.

Generate a sample Excel fixture:

```bash
pnpm --filter @ioffice/backend fixture
```

Sample file:

```text
backend/fixtures/sample-ioffice.xlsx
```

## Classification Rules

Default seeded rules:

- `BC` -> `Báo cáo / Tờ trình`
- `TTr` -> `Báo cáo / Tờ trình`
- `CV` -> `Công văn / Ủy quyền`
- `UQ` -> `Công văn / Ủy quyền`
- No match -> `Thư công tác`

Deterministic behavior:

- NHNo/Agribank special case runs before normal keyword rules.
- Lower numeric `priority` wins.
- Disabled rules are ignored.
- Keyword matching is token-based, so `BC` does not match `ABC`.

NHNo/Agribank special case:

```text
referenceNumber = 12969/NHNo-ALCO
issuingUnit = NHNo
```

Result:

```text
normalizedUnit = ALCO
documentGroup = Công văn / Ủy quyền
```

## Snapshot Mechanism

Snapshots are immutable. Creating a snapshot copies the current documents into `snapshot_documents` and stores the active rule set in `rule_versions`. Later changes to documents, rules, or mappings do not modify existing snapshot data.

Snapshot comparison uses document identity:

```text
referenceNumber + issueDate + summary
```

Changed fields:

- document group
- normalized unit
- signed status

## API Overview

All JSON responses use:

```json
{ "success": true, "data": {} }
```

or:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Message" } }
```

Main endpoints:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/imports/preview`
- `POST /api/imports`
- `GET /api/imports`
- `GET /api/imports/:id`
- `GET /api/imports/:id/documents`
- `GET /api/imports/:id/export`
- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/rules`
- `POST /api/rules`
- `PUT /api/rules/:id`
- `DELETE /api/rules/:id`
- `GET /api/unit-mappings`
- `POST /api/unit-mappings`
- `PUT /api/unit-mappings/:id`
- `DELETE /api/unit-mappings/:id`
- `GET /api/snapshots`
- `POST /api/snapshots`
- `GET /api/snapshots/:id`
- `GET /api/snapshots/:id/documents`
- `GET /api/snapshots/:id/export`
- `GET /api/snapshots/compare?leftId=...&rightId=...`
- `GET /api/reports/summary`
- `GET /api/reports/export`
- `GET /api/health`

## Backup

```bash
scripts/backup.sh
```

Output:

```text
backup/<timestamp>/database.sql
backup/<timestamp>/storage.tar.gz
```

## Restore

```bash
scripts/restore.sh backup/<timestamp>
```

Restore replaces storage volume contents and restores the PostgreSQL dump.

## Testing

Run all tests:

```bash
pnpm test
```

Run typecheck:

```bash
pnpm lint
```

Run production build:

```bash
pnpm build
```

Current automated coverage includes:

- classification: BC, TTr, CV, UQ, default, NHNo, Agribank, NHNo-ALCO
- normalization: spaces, empty, date, unit mapping, signed status

## Folder Structure

```text
backend/
  prisma/
  src/
  tests/
  fixtures/
frontend/
  src/
storage/
  uploads/
  exports/
  snapshots/
scripts/
docker-compose.yml
docker-compose.prod.yml
```

## Troubleshooting

- If Prisma binary download fails with a local certificate error, run generate with `NODE_TLS_REJECT_UNAUTHORIZED=0` only for that local install step, then restore normal shell settings.
- If Docker commands fail with `dockerDesktopLinuxEngine`, start Docker Desktop first.
- If `pnpm install` warns about blocked builds, run `pnpm rebuild @prisma/client @prisma/engines prisma esbuild` and then `pnpm prisma:generate`.

## Known Limitations

- Docker Compose config validates, but full Docker build/start was not completed in this session. Docker Desktop initially was not running; after starting it, `docker compose build` was interrupted because the build remained slow/stuck around registry/Corepack certificate handling in this machine environment.
- Frontend has no dedicated component tests yet; backend business logic tests are present.
- Snapshot comparison is implemented with deterministic MVP semantics documented above.
