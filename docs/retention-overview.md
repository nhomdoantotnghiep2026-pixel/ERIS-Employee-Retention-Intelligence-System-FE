# Retention overview

The HR home remains `/dashboard`. Navigation displays a single Overview item; `/org-overview` redirects to it for existing bookmarks.

## Data sources (read-only)

- Employee profiles: existing `/employees` contract, full directory returned by BE; scope uses ACTIVE employment status.
- AI eligibility: `/ai/employees`, intersected with active employee IDs and the department filter.
- Departments: existing `/departments` catalogue.
- Surveys: `/surveys`, counted by server status; always organization-wide.
- Saved policy recommendations: `/policy-recommendations`. Only STORED records from `mexwell-` model versions are considered; DEMO_FIXED records are excluded.

The review list selects the highest prediction ID per active employee with a saved AI recommendation, then sorts by descending score. This is a subset, not coverage of all AI predictions: the current BE exposes result detail but has no list of all AI results. A saved result without a saved recommendation cannot appear here. Counts represent suggestions, not completed interventions. No thresholds, high-risk labels, attrition rates, or trends are invented. The Mexwell model remains a demo without validated risk classifications.

Department filters affect employee metrics, recommendation counts and the review list; survey metrics remain global. Failed data sources show unavailable values rather than zero, while successful sources remain usable. Refresh is manual. The page performs no writes and never creates predictions.

Review links open the existing `/ai-analysis` screen. The overview displays the saved result ID for manual lookup using the original screen; it does not modify AI analysis or add query-parameter handling. The four login actors and server authorization remain unchanged.

## Report layout

The overview uses a left filter rail and a ten-metric report canvas inspired by the supplied Data Studio attendance report. Blue chart accents, a department headcount bar chart, readiness matrix, eligibility donut and numeric score histogram use only the existing ERIS sources.

Department, gender, employment type, AI eligibility and employee-name/code search apply together to the active employee scope. Reset clears them. Survey counts remain organization-wide. Date, shift, work-mode and office-location filters from the reference are intentionally absent because these sources do not provide the matching report metrics. Histogram bands are numeric intervals, not risk labels; the final interval includes 100%.
