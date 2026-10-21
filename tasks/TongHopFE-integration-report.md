# TongHopFE integration — 2026-10-21

## Inputs and conflict resolution

- Base: `origin/frontend/role-workflows` at `d90313c`.
- Merged: `origin/HuyFE` at `80d9e06`.
- The only textual conflict was `src/screens/ErdAccounts.tsx`.
- Preserved the shared branch's account filtering/pagination, HR-only invitation form, Excel import and address suggestions.
- Preserved HuyFE's VI/EN translations, API error handling, same-origin proxy and configuration documentation.
- Restored the missing account-lock confirmation dialog; Cancel sends no update.
- Normalize nested `role.id` to `roleId` so saving a status does not accidentally change the role.
- Keep JSON headers for JSON requests and let the browser supply the multipart boundary for Excel uploads.
- Updated DEPT contract tests to canonical routes from the current team backend.
- The four actor definitions are unchanged. Neither source branch was rewritten or pushed.

## Checks

- `npm test`: 61 passed; 0 failed, skipped or cancelled.
- `npm run typecheck`: passed.
- `npm run build`: passed; existing Vite configuration and bundle-size warnings remain.
- `git diff --check` and conflict-marker scan: passed.
- Local backend HTTP regression suite: 6 groups passed, including the comprehensive merged-contract scenario.
- Chrome: actual FE served by Vite, proxied to the actual backend handlers against an isolated PGlite database.

## API coverage

| Area | Methods / resources exercised |
| --- | --- |
| Authentication | Login, current user, refresh cookie, logout, HR registration, change-password OTP, change password, forgot password, reset password |
| Accounts and roles | GET users with search/role/status/pagination, GET user detail, PATCH role, PATCH status, GET roles |
| Departments | GET/POST `/api/departments`, GET/PATCH/DELETE `/api/departments/:id` |
| Positions | GET/POST `/api/positions`, GET/PATCH/DELETE `/api/positions/:id` |
| Employees | GET/POST `/api/employees`, GET/PATCH/DELETE `/api/employees/:id` |
| Excel import | POST `/api/employees/import`, multipart `.xlsx`, mixed success/failure rows and authorization rejection |
| Address suggestions | GET `/api/distance/places?query=...`, query validation and HR authorization |

The HTTP checks cover 401/403 authorization, invalid inputs, missing records, duplicate email/name,
protected fields, pagination, distance failures without saving an employee, OTP reuse rejection,
transactional audit rollback, and soft deletion with linked-account deactivation.

Chrome checks cover HR login, DEPT/POS creation, address selection, employee creation and partial PATCH,
employee deactivation, Excel import, Admin HR creation, cancellation/confirmation of a lock,
unchanged-role preservation, VI/EN switching and reload persistence.

## Local backend and verification limits

Backend services remain outside this FE repository. The local integration adapter was updated to expose
canonical DEPT routes while retaining the old routes, accept HR invitations without a supplied full name,
and load the current employee/import/distance modules from the separate backend checkout via
`TEAM_BACKEND_ROOT`. Its parameterized employee pagination query is retained because the team module
still contains the old LIMIT/OFFSET placeholder bug. No files in the separate `D:/ERIS-BE` checkout were modified.

These local backend adapter changes are not included in an FE commit. Other machines need a backend
implementing the contracts in the table; pushing FE alone does not distribute a backend or its configuration.

All create/update/delete/password tests used disposable data in an isolated database. Email delivery and
map responses were stubbed in those tests. They do not prove real inbox delivery or third-party map availability.
The running local service was separately checked for database readiness and frontend proxy connectivity.
No shared application records, real account passwords or database schema were changed by the tests.

Frontend is running at `http://127.0.0.1:5174`; backend at port `3001`. `.env.local` remains ignored;
use `.env.example` and `README-LOCAL.md` for machine-specific configuration. Never commit credentials.
