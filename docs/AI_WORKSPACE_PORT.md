# Individual prediction workspace

This repository is now the working frontend. The dashboard repository was read as a design reference only; backend and database were not changed. No commit or push.

## Implementation

- Replaced the /ai-analysis screen content while retaining AppShell, navigation, header, role guard and the existing API/session client.
- Ported the agreed 39/61 desktop layout, equal-height panels, mobile Data/Result tabs, full-height input groups and donut probability display. Orange buttons, focus outlines and pale orange result surface match this application's theme. Styles are scoped to .ai-workspace.
- Removed the source-data accordion, duplicate employee header, snapshot-date result card, previous-evaluation/count cards and standalone save action, matching the latest reference.
- Save defaults to false. A native modal dialog provides keyboard focus trapping/Escape and separate confirmation wording. Prediction sends one existing request with explicit save; a synchronous lock prevents duplicate submission.
- Existing snapshot checks call the snapshot GET, not preview creation. Selection changes clear results and save choice. Snapshot identity guards reject stale loads.
- Removed SHAP and policy output from this individual screen. Existing unrelated screens remain unchanged.
- Optional response fields were added to frontend types only. No endpoint, auth behavior or response transformation changed.
- History uses only the saved record available in the current response. Full history and business sequence remain unavailable in the current contract; no fake count, sequence, dates or trend is generated.

## Files

src/screens/AiAnalysis.tsx; src/components/ai-workspace/*; optional AI types in src/services/api.ts; one loading-message translation in src/data/operationTranslations.ts; tests/ai-individual-save-api.test.ts.

## Verification

105 tests pass, including explicit save choices and a read-only result-detail request. npm run typecheck and npm run build pass. Build reports a large-chunk advisory. There is no lint script in this project. Used the repository formatter; its inline-type separator issue was repaired and typechecked. Existing package-lock.json changes were preserved.

Browser visual verification was not performed. The screen's port is checked through source, types, tests and production compilation; no real employee prediction/save was used for testing.

## Follow-up: visible history and probability color

History is now an always-visible select below the result cards. It retains only confirmed saved API responses in component memory, filters by employee, deduplicates by prediction ID and sorts by server creation time. Missing timestamps trigger a result-detail GET; failure leaves the timestamp unknown. It is explicitly labeled as session history, not the complete persisted employee history. Opening a result does not invoke the model.

The donut track is neutral gray (fixing the inherited all-orange ring). The probability arc uses an SVG gradient whose hue changes continuously from green through yellow to red as probability increases, with a 0–100% color legend. This is visual encoding only; risk classifications still come exclusively from recognized backend fields.
