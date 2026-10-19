# Public ERIS navigation and detail pages

Add a shared public header with an orange active state and a wide hover/click disclosure for Giải pháp, Vai trò, Quy trình and Bảo mật. Preserve the landing animations, screenshot fan, four actors and authenticated routes.

Content is grounded in the current ERIS role policy, frontend workflows and previously reviewed ERD/BPMN/UseCase mapping. Separate the current browser demo from future backend/PostgreSQL authentication and server authorization. Do not claim live inference, OTP or database security is implemented.

Public routes: /giai-phap, /vai-tro, /quy-trinh, /bao-mat. Avoid /roles, which belongs to Admin. Menu links lead to matching sections on these pages. Hover, click, keyboard focus, Escape, outside click and mobile navigation must work. Keep focusable links in an open panel; never use hover as the only way to open it.

Slices: content contract → shared header → public pages and routes → tests/typecheck/build/render review. No backend or remote changes. Browser interaction checks depend on available browser tools; report the limit if unavailable.
