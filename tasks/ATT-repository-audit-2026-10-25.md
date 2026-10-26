# ATT audit — 2026-10-25

Repository: https://github.com/nhomdoantotnghiep2026-pixel/ERIS-Employee-Retention-Intelligence-System-BE

All remote branch heads were fetched into an isolated temporary mirror. The working BE checkout and database were not modified.

## Second audit: both repositories, 2026-10-25

Fetched both remotes again after the user's request, rather than relying on the earlier checkout.

- BE repository: all 8 heads remain at the commits below. `main` and `attendnce` contain the ATT implementation but neither imports or mounts it in `src/app.js`.
- Other repository: https://github.com/nhomdoantotnghiep2026-pixel/ERIS-Employee-Retention-Intelligence-System-
- All 18 heads checked: audit_logs, auth, backend-maintenance, departments, distancefromhome, employee_outcomes, employee_snapshots, employees, frontend/standalone, main, model_versions, module, positions, prediction_factors, predictions, retention_actions, roles, users.
- Other-repo main is `06217b0`; backend-maintenance is `da6102b`. No server ATT implementation or registration exists in these 18 heads. A broader search across tracked file types found attendance UI in main/frontend/standalone, but that UI saves check-in/out in sessionStorage and renders a static attendanceHistory array. It is not an alternate working ATT API.
- Existing local port-3001 app explicitly mounts team departments, positions and employees adapters, plus user management. Its registered resource list contains no attendance resource. This explains why those APIs can work while ATT remains missing.
- FE calls match the ATT service contract: versioned today/check-in/check-out paths, authenticated self, three GPS fields, persisted=false rejection, server-supplied time/minutes. Changing the FE URL to an unversioned path is not supported by either server.

Fresh read-only HTTP probes:

| Target | Result without token | Meaning |
| --- | --- | --- |
| 3000 /health | 200 | Canonical BE is running |
| 3000 /api/v1/attendance/today | 404 Cannot GET | ATT route is not mounted |
| 3001 /health/live | 200 | Integrated BE is running |
| 3001 /api/v1/attendance/today | 401 Bearer token required | General /api/v1 authentication runs before route lookup; this does not establish ATT registration |
| 5173 /api/v1/attendance/today | Same 401 format | FE proxy reaches the integrated BE |

These probes did not issue POSTs or manufacture a token. The earlier authenticated UI failure is consistent with the missing route demonstrated by source inspection. Local D:/ERIS-BE remains clean at 6ebe867. No BE source, SQL, database row, credentials, or running service configuration was changed during this second audit.

## Branch inventory

| Branch | Commit | Attendance implementation | Application registration |
| --- | --- | --- | --- |
| main | 6ebe867 | config, repository, routes, service, Swagger definitions | Not registered in app/server |
| attendnce | 857fc5d | config, repository, routes, service, Swagger definitions | Not registered in app/server |
| employess | bff45c3 | browser demo and attendance tests; required attendance modules are absent at this head | Not registered |
| auth | 1cc47ed | Absent | Absent |
| departments | 20d3b41 | Absent | Absent |
| module | 80f625d | Absent; no src/app.js | Absent |
| positions | c2ebabe | Absent | Absent |
| user | a9277be | Absent | Absent |

Case-insensitive searches included attendance, check-in, check-out, checkIn, checkOut, scripts, tests and demo files. No call site registering createAttendanceRouter was found in an application entry point across these heads. Searching all fetched history for createAttendanceRouter in src/app.js/src/server.js also found no registration. Tests that mount their own temporary Express application do not register the production application.

The main Swagger configuration does not incorporate the exported attendancePaths object either.

## Real database verification

Read-only queries through the existing BE connection reached the talentguard database:

- public.attendance exists with all columns used by AttendanceRepository.
- Unique index on (employee_id, work_date) exists, as required by the check-in upsert.
- One row currently exists: employee_id 2, work_date 2026-10-22, working_minutes 9, overtime_minutes 0, attendance_status LATE. This matches the pgAdmin screenshot.
- The account currently being tested has an ACTIVE linked employee profile, but zero attendance rows.
- ATT-01 queries the authenticated employee and current Vietnam work date. The row for another employee on October 22 must not be displayed as that account's attendance today.

No row was inserted, updated or deleted. No password, token, connection credential, GPS coordinate or private account detail is included in this report.

## Runtime mismatch

Update after the user's explicit restart request (20:55 local): FE `.env.local` now targets port 3000. Stopped the previous 3001 integrated process and duplicate FE instance; restarted canonical D:/ERIS-BE with node --watch src/server.js and D:/ERIS-FE on port 5173. Through the FE proxy, /api/auth/me now returns the canonical BE's 401 message; /api/v1/attendance/today still returns Cannot GET 404. No BE source was changed. The following bullets describe the earlier configuration that caused confusion, not the current target.

- FE .env.local points /api to http://127.0.0.1:3001.
- Port 3001 runs the older integrated local backend under the Codex visualizations directory, not D:/ERIS-BE/src/server.js.
- Another BE process is listening on port 3000.
- The port-3001 integrated application also lacks an attendance mount. Its general /api/v1 authentication middleware can return 401 even for an unregistered path; an unauthenticated 401 is not proof that ATT exists.
- Consequently a pull into D:/ERIS-BE does not automatically update the port-3001 application's routes.

## Existing FE integration

- GET /api/v1/attendance/today.
- POST /api/v1/attendance/check-in and /check-out with latitude, longitude and accuracyMeters captured by the browser on demand.
- Uses the existing session bearer token; does not supply another employee ID or a fabricated timestamp.
- Server decides office radius, saved state, workday, check-in/out times and minutes. HTTP 200 with persisted=false is treated as not saved.
- No mock attendance is substituted when the real endpoint fails.
- The existing API does not expose an attendance-history listing. A general history table cannot be added by calling ATT-01 alone.

## Required backend handoff (not applied)

For the canonical main/attendnce application, instantiate and mount the existing implementation before the final error handler:

```js
const { attendanceConfig } = require('./modules/attendance/attendance.config');
const { AttendanceRepository } = require('./modules/attendance/attendance.repository');
const { createAttendanceService } = require('./modules/attendance/attendance.service');
const { createAttendanceRouter } = require('./modules/attendance/attendance.routes');

const attendanceService = createAttendanceService(
  attendanceConfig(),
  new AttendanceRepository(databasePool)
);

app.use('/api/v1/attendance', createAttendanceRouter({
  service: attendanceService,
  authenticate,
  databasePool
}));
```

This snippet is a reviewable handoff, not a change to BE files. If keeping the port-3001 integrated backend, its authentication middleware must first verify its own token and provide the req.auth.userId expected by the existing attendance router. Do not switch FE between incompatible token implementations or disable authentication to make the endpoint appear to work.

After a backend owner enables the route, verify an authenticated GET against the real database. Check-in/out writes should use a legitimate active employee and real GPS, respecting server workday and radius checks. October 25 is a Sunday: the current module does not permit a normal workday check-in that day. Do not bypass that rule, change the clock or insert attendance to force a successful demonstration.

## Boundary

The user instructed that BE source must not be modified or pushed. Therefore this audit does not apply the backend registration or claim that live check-in/out is working. FE cannot safely replace a missing authenticated server route with direct PostgreSQL access.
