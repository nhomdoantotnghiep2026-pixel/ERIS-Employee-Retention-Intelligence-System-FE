# Public ERIS navigation and detail pages

Add a shared public header with an orange active state and a wide hover/click disclosure for Giải pháp, Vai trò, Quy trình and Bảo mật. Preserve the landing animations, screenshot fan, four actors and authenticated routes.

Content is grounded in the current ERIS role policy, frontend workflows and previously reviewed ERD/BPMN/UseCase mapping. Separate the current browser demo from future backend/PostgreSQL authentication and server authorization. Do not claim live inference, OTP or database security is implemented.

Public routes: /giai-phap, /vai-tro, /quy-trinh, /bao-mat. Avoid /roles, which belongs to Admin. Menu links lead to matching sections on these pages. Hover, click, keyboard focus, Escape, outside click and mobile navigation must work. Keep focusable links in an open panel; never use hover as the only way to open it.

Slices: content contract → shared header → public pages and routes → tests/typecheck/build/render review. No backend or remote changes. Browser interaction checks depend on available browser tools; report the limit if unavailable.

## Vietnamese / English public-site preview

Use the existing LanguageProvider and eris-language preference for landing, public topic pages and login. Translate visible copy, validation messages, accessible names and page titles; keep paths and four actor identities stable. Dashboard screenshots remain original images. Add a compact VI/EN control shared across these pages. Validate both locales and existing role/navigation contracts. Per user request, do not stage, commit or push this preview.

## Four-role dashboard language fixes (uncommitted preview)

Audit HR, Data/AI, Admin and Employee dashboard content plus shared navigation, help, notifications and status labels. Fill missing dictionaries and replace raw copy/dynamic concatenation with translated templates. Preserve actor, route, enum and user-entered values. Cover both languages, count-dependent/empty/ready states and populated rows; run all tests, TypeScript and build. Do not stage, commit or push.

## Complete feature-page language preview

Audit every routed screen and shared feature component, not just home dashboards. Translate visible text, table labels/reference labels, form steps, dialogs, accessible labels, status/error messages and formatted messages. Keep option values, field bindings, storage, user identities and technical ERD identifiers unchanged. Check every role route in VI/EN, static copy in conditional UI, populated analysis states and translation templates. No staging, commit or push.
