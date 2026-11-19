# Insight & Policy engine

Frontend only. No database writes, backend changes, model execution or outgoing messages in this feature.

## Source and selection

- `insight-copy.json` preserves the supplied 40 insight/policy pairs verbatim (10 features × 4 sign/strength variants). Age and Gender use their separately supplied review rules in `insight-engine.ts`.
- Inputs come from the currently displayed result: `model.contributions` and `preview.features`. Switching historical result rebuilds the output and resets draft actions.
- All 12 explicit threshold pairs use raw Explainable SHAP contributions. Zero, non-finite and below-threshold values are excluded. Boundaries are inclusive at moderate and strong. Eligible factors are split by sign, sorted by absolute SHAP magnitude descending and limited independently to three positive factors and two negative factors. Policies reuse exactly those selected signals.
- Age and Gender remain profile data and do not consume the three risk or two retention explanation slots.
- No model contributions produces a missing-information message; valid contributions with no eligible factor produce the requested zero-state.

## Missing evidence

The existing frontend result contract contains snapshots and contributions, not contextual evidence for planned overtime, salary benchmarks, development commitments, onboarding completion, performance, feedback or comparable survey periods.

`Evidence` accepts source-backed per-feature variables, an explicit verified-context flag and period-history availability. It is not populated with guesses from prediction history. Every unresolved placeholder logs the required warning containing only variable name and feature, never employee data.

Direct snapshot references are resolved before optional evidence: `Age`, `Overtime_Hours`, `Work_Hours_Per_Week`, `Employee_Satisfaction_Score`, `Years_At_Company` and `Sick_Days` provide `{x}`; `Hire_Date` plus the snapshot date provides elapsed calendar days. Because `Overtime_Hours` is explicitly year-to-date in this frontend contract, its `{kỳ}` is rendered as `từ đầu năm đến {snapshot date}`. The snapshot does not provide planned overtime, so it cannot provide `{d}`. When a selected template still lacks variables, the card shows the actual direct feature value and names the missing references instead of inventing them.

Templates without unresolved placeholders display verbatim when their SHAP condition is selected. When a template needs unavailable business variables, the engine logs every missing reference and uses only one of the explicitly supplied single-record Insight sentences where available. Policy remains the verbatim policy paired with the selected feature, sign and strength. Missing values are never replaced with zero or invented.

Integration needed for full contextual wording: a verified API source for those variables and comparable reporting/survey periods. A list of repeated prediction runs is not that evidence.

Currently unresolved variables by feature:

- Overtime_Hours: `kỳ`, `d`, `n`.
- Work_Hours_Per_Week: `d`, `n`, `công việc tồn/phản ánh quá tải`.
- Employee_Satisfaction_Score: `a`, `b`, `a–b`, `n`.
- Monthly_Salary: `d`, `trách nhiệm bổ sung`, `thời điểm`, `ngày`.
- Promotions: `mốc`, `ngày`.
- Years_At_Company: `hướng phát triển`, `thời điểm`, `mục tiêu`.
- Hire_Date: `hạng mục`, `nhiệm vụ`; `x` is derived from hire date and snapshot capture time.
- Department: `vướng mắc`, `bàn giao/phê duyệt/phân công`, `vấn đề`, `n`.
- Education_Level: `kỹ năng`, `nhiệm vụ`, `minh chứng`.
- Sick_Days: `kỳ`, `d`, `lịch làm/nhiệm vụ/bàn giao`.
- Age: `mục tiêu` (uses the exact supplied missing-goal fallback).
- Gender: `cơ hội/hỗ trợ` (uses the exact supplied profile-only wording until feedback exists).

## UI and actions

Tab 2 has amber risk and emerald retention groups, strength badges and exact resolved text. The risk-card link opens Tab 3 and focuses/scrolls to the matching feature policy. Tab 3 shows the exact policies only. Scheduling, checklist, task creation and recommendation-send controls are intentionally absent.

## Verification

Tests cover every threshold boundary in both signs, independent top-three-positive/top-two-negative ordering, missing/invalid contributions, Age/Gender exclusion, exact warning format, verbatim interpolation, approved single-record Insight fallbacks, verified context, removal of task controls, and SSR rendering of both tabs. No live employee records are modified to test.

Live visual inspection was attempted but the computer-use host timed out and browser access was unavailable. Browser layout and click-to-scroll verification remain pending.
