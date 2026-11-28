# ERIS role contract

ERIS currently supports three active product roles:

| Role | Product responsibility |
| --- | --- |
| HR | Workforce records, attendance and leave, surveys, AI analysis, and retention decisions |
| System Administrator | Accounts, access control, configuration, and audit review |
| Employee / ESS | Own profile, attendance, requests, and assigned surveys |

`Data / AI Analyst` is a legacy compatibility role. It remains in ERD fixtures, historical routes, and regression tests so the existing demo dataset stays stable. It is not mapped from backend authentication, has no login portal, is not shown in public role content, and must not receive new product features.

New functionality must target one or more active roles from `src/domain/roleContract.ts`. Removing the legacy role is a separate migration that requires updating ERD fixtures, route policies, translations, and regression tests together.
