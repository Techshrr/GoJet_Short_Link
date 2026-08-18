# GoJet V5 P12 — Workspace / Members / Organization Contract

## Scope

P12 closes the workspace collaboration and organization surfaces required by the frozen V5 Master Plan without inventing new backend schemas.

### Members

- `/app/members`
- Real `/api/workspaces/{id}/members` data.
- Five server roles: `owner`, `admin`, `editor`, `analyst`, `viewer`.
- Owner/Admin can invite, resend/revoke invitations, change non-owner roles and remove non-owner members.
- Viewer/editor/analyst presentation remains read-only for member administration.
- Owner is never assignable from the invitation UI and is never removable/demotable from the P12 surface.
- Invitation expiry/status remains server authoritative.

### Organization

- `/app/campaigns` and `/app/tags` expose the same workspace organization model; folders are included in the organization surface because the frozen Workspace IA has no separate folder route.
- Real `/api/workspaces/{id}/organization` snapshot.
- Campaign create and status lifecycle (`active`, `paused`, `completed`).
- Folder create.
- Tag creation is restricted by the V5 UI to a fixed GoJet Design Token palette; arbitrary browser color-picker values are forbidden. The selected token is persisted through the existing server-validated `#RRGGBB` contract.
- Campaign links/clicks/conversions are rendered from the server snapshot and are never fabricated client counters.
- Owner/Admin/Editor receive edit actions; Analyst/Viewer remain read-only.

## Backend authority

P12 reuses the existing Go domain services:

- `app/workspace`
- `app/organization`
- `app/billing` member quota checks
- `services/platformapi/cmd/server`

Authorization, workspace tenancy, invitation validity, quota enforcement and audit records remain server-side authority. The browser must not persist auth tokens in Web Storage.

## UI / Browser Gate

Fixed viewports:

- 1440×900
- 1024×768
- 390×844

Hard failures include horizontal overflow, page errors, console errors, broken navigation, clipped controls, arbitrary Tag color pickers and permission actions exposed to read-only roles.

## Completion rule

P12 is DONE only when:

1. P01–P11 regression verifiers remain green.
2. P12 static contract verifier is green.
3. Strict TypeScript and all frontend builds are green.
4. Go workspace/organization/billing/platform API tests are green.
5. P04–P12 browser gates are green at the required fixed viewports.
6. The tested SHA is still the exact branch HEAD.
7. The matching capability-matrix rows are marked DONE only against successful exact-head evidence.

P13 remains locked until these conditions are satisfied.
