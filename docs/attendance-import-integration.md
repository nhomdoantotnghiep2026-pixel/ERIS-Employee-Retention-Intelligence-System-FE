# Attendance and Leave Records integration — BE main 255e068

Scope: frontend only. Backend main at 255e068 was read to reconcile the contracts. Survey work is excluded. No backend files, migrations, credentials, demo actors, or existing source records are modified.

## Fit with the project topic

The project predicts attrition risk and supports HR retention decisions. Attendance and leave are supporting source data, not an attrition classifier or an automatic HR decision.

The new attendance design is more appropriate for reliable data collection: persisted preview, explicit conflict decisions, shift snapshots, overnight work dates, version checks, and atomic audit. Missing timestamps are not interpreted as absence. Leave Records remains separate from Attendance and rejects overlaps with actual active attendance. The UI must preserve these distinctions.

The current BE AI integration still has three gaps, observed in src/modules/ai/ai.repository.js and ai.features.js:

1. Overtime_Hours uses attendance.overtime_minutes. New import calculates outside_shift_minutes separately and defaults overtime_minutes to 0. Outside-shift minutes must not be relabeled as overtime by FE.
2. Sick_Days still counts legacy attendance ON_LEAVE/ABSENT rows; the new employee_leave_records module does not write Attendance. New leave records therefore are not currently included in that feature. Even legacy absence is broader than medically confirmed sick days.
3. Work_Hours_Per_Week subtracts time-of-day end minus start in the current schedule SQL; overnight schedules require wraparound handling before that feature is reliable. FE supports valid overnight schedule creation but does not alter AI calculations.

These require decisions and changes by the BE/AI owners before claiming the new source flows fully feed the model. No fabricated feature values or risk conclusions are introduced in FE. Existing snapshots and predictions are unchanged.

## Test paths

With an ACTIVE HR session:

1. Work schedules → Schedules: assign a unique shift_type to existing schedules using Shift code & import windows. Old schedules may have no code; FE handles that state.
2. Work schedules → Create: create daytime, overnight, or no-break schedules. Assignment remains immediate for other features; attendance import itself chooses an ACTIVE schedule by file shift_type, independently of employee assignment.
3. Attendance history → Import: download the new five-column XLSX template. Upload employee_code, optional employee_name, shift_type, check_in, check_out. Use Vietnam local timestamps YYYY-MM-DD HH:mm:ss. File limit is 10 MiB and 10,000 rows.
4. Preview alone writes no Attendance. Choose ambiguous work dates, exclude errors/conflicts, review before/after values, explicitly select changed duplicates and supply update reasons, then acknowledge warnings and Confirm.
5. Reopen a persisted batch from history or download its issues as XLSX. Expired or stale batches require a new preview. Confirmed batches cannot be edited.
6. Filter attendance by work dates, employee ID and ACTIVE/CANCEL/ALL; use pagination. Summary counts ACTIVE source rows only and keeps outside-shift time separate from recorded overtime.
7. View a record to edit timestamps, cancel or restore with a reason. FE sends expected_version, never calculated metrics or a moved work_date. Legacy records without schedule snapshots can be cancelled; editing requires reconciliation through import. Inspect dedicated audit before/after values.
8. Leave records: select a real leave type from GET /leave-types (LTxxx code). Create/edit a whole-date record, cancel/restore, or import XLSX/CSV with preview then confirm using the exact file and returned fingerprint. Confirm saves valid rows and reports skipped duplicates, conflicts and failures.
9. Leave summary clips active dates to the selected range. Hours remain unavailable; no schedule or hourly conversion is invented. Only recorded_by/created_at/updated_at exist, not detailed leave audit history.

Employee sessions use /my-attendance and /my-requests to read the corresponding /me endpoints. No HR import or mutation controls are rendered. No employee_id filter is sent by these forms.

## Contract details

Attendance uses /api/v1/attendance:
- POST /import/preview (multipart file), GET /import/history, GET /import/:batchId.
- PATCH /import/:batchId/rows/:excelRow with work_date and/or exclude.
- POST /import/:batchId/confirm with duplicate_strategy=SKIP, confirm_warnings, and explicit updates.
- GET /import/:batchId/errors uses the shared authenticated client with a binary response.
- GET /, /me, /summary: snake_case fields and record_status=CANCEL (not CANCELLED), limit/offset pagination.
- PATCH /:id, /:id/cancel, /:id/restore: expected_version and reason.
- GET /:id/audit-logs returns old_values/new_values.
- No direct /import, DELETE record, GPS check-in/out, or close-day request is used by the new UI.

Leave uses /api/leave-records and /api/leave-types. It does not use legacy /v1/attendance/leave-requests. The existing page URLs /employee-requests and /my-requests now render Leave Records. Legacy source/API helpers remain independent compatibility code, not this module's workflow.

Deployment requires the BE attendance migration and the agreed leave_types and employee_leave_records tables. FE does not run them. Backend restart, API availability, and live persistence must be verified by the backend/database owner.

## Verification

Contract tests cover multipart file preservation, binary auth/export, explicit confirm decisions, versioned mutation payloads, conflict-code propagation, personal read routes, leave fingerprint and employee immutability, and overnight shift validation. Chrome checks use mocked APIs so no real data is imported or cancelled. Real database end-to-end persistence has not been claimed.
