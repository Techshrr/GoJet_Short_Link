# P07 Analytics Contract

Status: implementation gate for Issue #8 P07 on `rebuild/v5-specification-rebuild`.

## 1. Frozen-source interpretation

P07 implements the Workspace `/app/analytics` surface defined by GJ-V5-001/GJ-V5-003 while preserving V4 analytics truth. The page reuses the P02 brand foundation, P03 components/tokens, P04 Workspace shell, P05 cookie-session API transport and analytics RBAC, and P06 sequential exact-head gate.

V5 must not invent a generic analytics backend that does not exist. The existing backend provides:

- workspace overview from Redis realtime + MySQL history;
- per-link analytics for an explicit date range;
- workspace link presentation filters for domain and campaign;
- QR, File Share, Text Share and Bio Page counters as legacy resource activity.

## 2. Analytics surfaces

### Workspace overview

`GET /api/workspaces/:workspace/overview` is the source of truth for today clicks, month clicks, unique visitors, active links, the 30-day trend, recent activity and anomalies. Its backend source marker is displayed when supplied; V5 does not relabel this fixed overview as an arbitrary date-range report.

### Resource analytics

Selecting a Link switches to the existing canonical link analytics path:

`GET /api/workspaces/:workspace/links/:link/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD`

The UI treats the selected To date as inclusive and sends the following day as the API's exclusive upper bound, matching the backend `occurred_at >= from AND occurred_at < to` contract.

The page renders clicks, unique visitors, bot visits, derived human visits, sources, countries, devices, browsers, operating systems and UTM sources. Zero-event responses remain valid zero-valued analytics rather than errors.

## 3. Filter semantics — no fake filtering

The frozen IA calls for Resource / Domain / Campaign / Country / Device filters. P07 implements only semantics supported by the real backend:

- **Resource** chooses Workspace overview or one concrete Link.
- **Domain** and **Campaign** are sent to the real P05 link-presentation list endpoint and narrow the Link resources available for analysis.
- **Date range** re-queries the selected Link analytics endpoint.
- **Compare** queries the exact previous equal-length period through the same Link analytics endpoint and calculates KPI deltas client-side from two real server payloads.
- **Country** and **Device** focus the corresponding aggregate dimension returned by the backend. They deliberately do **not** claim to recompute cross-filtered KPI totals because the frozen V4 API has no country/device predicate for the aggregate query.

This distinction must remain visible in the UI. A future backend cross-filter endpoint may upgrade Country/Device semantics, but P07 must not fabricate such results in the browser.

## 4. Legacy resource activity

To preserve V4 capability coverage, Workspace overview also reads:

- `GET /api/workspaces/:workspace/qr-codes` → Visits
- `GET /api/workspaces/:workspace/fileshares` → Downloads
- `GET /api/workspaces/:workspace/text-shares` → Views
- `GET /api/workspaces/:workspace/bio-pages` → Views

These four reads are independent (`Promise.allSettled`). One failing resource produces an explicit Partial Error while healthy resource counters remain visible; no failed resource is silently converted into a successful measurement.

## 5. RBAC and security

- `/links/capabilities` remains the V5 presentation capability source.
- When `can_analytics !== true`, P07 renders Permission Denied/Unavailable UI and must not issue overview, resource-counter, or link-analytics requests.
- Backend `AnalyticsSafe` remains authoritative and separately requires `workspace.Allowed(role, "analytics")`.
- All requests use the shared cookie/session client; P07 adds no browser Web Storage token persistence.
- CSV export contains only the analytics payload already authorized and loaded into the current browser view; it does not call a privileged hidden endpoint.

## 6. Required states

P07 browser and contract gates cover:

- workspace loading / workspace error / no workspace;
- analytics capability loading / error / permission denied;
- workspace overview loading / success / rate-limited or API error;
- resource activity success / partial error;
- link analytics loading / success / zero-event dimensions / API error path;
- previous-period comparison;
- desktop 1440×900 / tablet 1024×768 / mobile 390×844 with no page-level horizontal overflow.

Read-only analytics is intentional: P07 has no destructive mutation to confirm, and quota/disabled product mutations are not fabricated onto this reporting surface.

## 7. Exact-head Gate

P07 is accepted only when the exact current branch HEAD passes together:

- P02/P03/P04/P05/P06 regression verifiers;
- P07 static analytics contract verifier;
- strict TypeScript and all independent application builds;
- P01 static/dynamic split regression including `AnalyticsPage` as a dynamic Workspace entry;
- Go tests for Links/Domains/platform API plus analytics worker/reconciler packages;
- P04/P05/P06 browser regressions;
- P07 Playwright overview at all three fixed viewports plus resource/compare/RBAC/partial-error/rate-limit/empty cases;
- exact-head guard before Issue #8 evidence is persisted.

P08 remains locked until this P07 exact-head result is successful.
