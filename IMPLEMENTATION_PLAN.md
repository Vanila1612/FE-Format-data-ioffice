# iOffice MVP Implementation Plan

## Current State

- Repository is a small single-package Vite + React JavaScript application.
- Backend lives in `server/index.js` and uses Express, Multer, SheetJS, and `better-sqlite3`.
- Frontend lives in `src/main.jsx` and `src/styles.css`.
- Existing workflow imports Excel immediately after file selection and stores parsed rows in SQLite.
- README describes the desired product direction but does not match a production-ready PostgreSQL implementation yet.
- `README.md` is already modified in the worktree and must be handled carefully.

## Main Gaps

- No `frontend/` and `backend/` monorepo split.
- No TypeScript backend/frontend structure.
- No PostgreSQL, Prisma schema, migrations, or seed.
- No authentication, users, role-based access, or password hashing.
- No persistent server-side original file storage structure.
- No consistent API envelope.
- No import preview/confirm separation.
- No document pagination API.
- No snapshot tables or immutable snapshot creation.
- No export endpoints on the backend.
- No backup/restore scripts.
- No Docker Compose stack for frontend/backend/postgres.
- Tests only run `node --check` and do not cover business logic.

## Target Architecture

```text
frontend/
  React 19 + Vite + TypeScript
  React Router
  TanStack Query
  Enterprise app shell with sidebar/header

backend/
  Node.js 22 + Express + TypeScript
  Prisma ORM
  PostgreSQL
  Multer + SheetJS
  Zod validation
  JWT auth
  Controller/service/repository-style modules

storage/
  uploads/
  exports/
  snapshots/

docker-compose.yml
docker-compose.prod.yml
```

## Files To Create

- Root workspace files: `package.json`, `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`.
- Backend: `backend/package.json`, `backend/tsconfig.json`, `backend/Dockerfile`, `backend/prisma/schema.prisma`, seed and migration files, `backend/src/**`.
- Frontend: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/src/**`.
- Storage folders: `storage/uploads`, `storage/exports`, `storage/snapshots`.
- Scripts: `scripts/backup.sh`, `scripts/restore.sh`.
- Tests and fixtures: backend service tests and sample Excel fixture generation.

## Files To Modify

- Replace the current root single-package setup with npm workspaces.
- Move frontend implementation from `src/` into `frontend/src/`.
- Replace SQLite backend in `server/` with the new `backend/` app.
- Update README to reflect the actual implementation after the build is functional.
- Keep old source only if needed during migration, then remove stale implementation files once replaced.

## Database Changes

- Add Prisma models:
  - `User`
  - `Import`
  - `Document`
  - `ClassificationRule`
  - `UnitMapping`
  - `RuleVersion`
  - `Snapshot`
  - `SnapshotDocument`
- Add enums for user role, import status, and document group.
- Add indexes for import, document group, issuing unit, normalized unit, reference number, and issue date.
- Use transactions for import completion and snapshot creation.

## API Changes

- Add consistent response format:
  - `{ success: true, data }`
  - `{ success: false, error: { code, message, details } }`
- Implement endpoints:
  - Auth: `/api/auth/login`, `/api/auth/me`
  - Imports: `/api/imports`, `/api/imports/:id`, `/api/imports/:id/documents`, `/api/imports/:id/export`
  - Documents: `/api/documents`, `/api/documents/:id`
  - Rules: `/api/rules`
  - Unit mappings: `/api/unit-mappings`
  - Snapshots: `/api/snapshots`, `/api/snapshots/:id`, `/api/snapshots/:id/documents`, `/api/snapshots/:id/export`, comparison if feasible
  - Reports: `/api/reports/summary`
  - Health: `/api/health`

## UI Changes

- Build app shell with sidebar and header.
- Pages:
  - Login
  - Dashboard
  - Import
  - Documents
  - Reports
  - Rules
  - Unit Mapping
  - Import History
  - Snapshot
  - Settings/Users placeholder only if backed by real auth data.
- All pages need loading, empty, error states and responsive tables.

## Risks And Assumptions

- Existing files contain mojibake Vietnamese text. The implementation will use UTF-8 source files and keep API field handling compatible with the required Vietnamese Excel headers.
- Snapshot comparison semantics are under-specified. MVP will compare document identity by `referenceNumber + issueDate + summary`, and changed state by normalized unit, document group, and signed status.
- Rule priority is deterministic: lower numeric `priority` wins after the Agribank/NHNo special case. This is documented and editable.
- Signed status is interpreted by common truthy Vietnamese values such as `Da ky so`, `Đã ký số`, `true`, `yes`, `1`, or a non-empty signed marker.
- Authentication is MVP JWT with bcrypt-hashed passwords and seeded admin credentials for development only.
