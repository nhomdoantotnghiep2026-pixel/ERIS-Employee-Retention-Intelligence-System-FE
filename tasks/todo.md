# Public ERIS pages

- [x] Define truthful content for four public topics and four fixed actors.
- [x] Build shared desktop mega menu and mobile disclosure with keyboard dismissal.
- [x] Add four detail pages and section anchors without changing authenticated routes.
- [x] Verify navigation/content contracts, role boundaries, TypeScript, build and rendered pages.
- [ ] Browser interaction and responsive visual walkthrough when a browser is available.

Validation: 35 tests passed; TypeScript and production build passed. All four public URLs returned HTTP 200 from the local Vite server. Direct hover, keyboard and responsive visual checks remain pending because no connected browser is available.

## Public language preview (keep uncommitted)

- [x] Add shared VI/EN controls and persistent language selection.
- [x] Translate home, public topic pages and login, including accessibility copy.
- [x] Verify both languages, unchanged actors/routes, TypeScript, tests and build.
- [ ] Review browser interaction and mobile layouts when a connected browser is available.

Language preview validation: full suite 37/37 passed; final public-language/navigation checks 4/4 passed; TypeScript and production build passed. Six public routes returned HTTP 200. No connected browsers or apps are available for direct interaction/visual checks. All preview changes remain unstaged and uncommitted; HEAD is still ff0fa80.

## Dashboard language preview

- [x] Trace missing dictionary entries, raw text and dynamic-count failures.
- [x] Translate all four role dashboards and shared navigation/help.
- [x] Verify both languages and dynamic/empty/populated states; run full checks.
- [ ] Direct browser and responsive checks when connected surfaces are available.

Dashboard validation: 38/38 tests passed, including all four role dashboards and guides in both languages, preserved links/account identities/request enum values, populated audit rows, ready/invalid snapshot states, active models and open surveys. TypeScript and production build passed. Direct browser checks remain unavailable. No files staged; no commit or push; HEAD remains ff0fa80.

## Complete feature-page language preview

- [x] Inventory all routed feature screens and shared components.
- [x] Translate text and preserve input/select enum values.
- [x] Add feature dictionaries, field labels and known dynamic-message translation.
- [x] Verify all routes, conditional UI copy, populated states and regression checks.
- [ ] Direct browser walkthrough when connected browser tools are available.

Full feature-page validation: 42/42 tests passed; rendered 42 route/mode cases in VI and EN, plus populated prediction/survey/audit cases. Checked conditional form/dialog copy and unchanged href/option values. TypeScript and build passed. Browser inventory is empty, so direct interaction/responsive verification is pending. No staging, commit or push; HEAD remains ff0fa80.
