# P05 — Links Vertical Slice Contract

Status: implementation contract for GJ-V5-001/002/003. This document does not redefine the frozen specifications; it records how P05 binds them to the existing Go platform API and the exact gaps P05 must close.

## Scope boundary

P05 finishes Links only. It covers `/app/links`, create, detail, edit, analytics, Routing, A/B, UTM, Access, QR, Settings, History, delete, bulk actions, states, RBAC, and mobile behavior. It does not advance P06 or any later phase.

## Frozen UI contract

### `/app/links`

- Page header: title, count, `Create link`.
- Toolbar: search, domain, status, campaign, tag, date, view, columns.
- Desktop table: Link, Destination, Domain, Clicks, Status, Updated, Actions.
- Row identity: favicon/icon, short URL, title, destination secondary text.
- Bulk actions: pause, activate, tag, export, delete.
- Mobile row: short URL, title, status, clicks, menu.

### Create link

Desktop uses a right Sheet of 520–560 px; mobile is full-screen. Default fields are destination, domain, code, title. Advanced fields are expiration, password, click limit, one-time, campaign, and tags. Routing/A-B stay collapsed from initial creation and are configured after creation. Footer actions remain sticky.

### `/app/links/:id`

Header: short URL, copy, visit, status, edit, more. Summary: destination, clicks, created, domain. Tabs are `Overview / Analytics / Routing / A/B Test / UTM / Access / QR / Settings / History`.

History restore and any edit that mutates the existing link must collect a change reason because the backend requires one.

## Existing authenticated API surface

All workspace routes are authenticated through `s.user(...)`; the service layer applies workspace membership/read access and `edit` permission for mutation.

| Capability | Method | Route |
| --- | --- | --- |
| list/filter | GET | `/api/workspaces/{id}/links` |
| create custom/default-domain link | POST | `/api/workspaces/{id}/links` |
| get | GET | `/api/workspaces/{id}/links/{link}` |
| update | PUT | `/api/workspaces/{id}/links/{link}` |
| versions | GET | `/api/workspaces/{id}/links/{link}/versions` |
| restore version | POST | `/api/workspaces/{id}/links/{link}/versions/{revision}/restore` |
| analytics | GET | `/api/workspaces/{id}/links/{link}/analytics` |
| bulk status | PATCH | `/api/workspaces/{id}/links/bulk-status` |
| bulk move | PATCH | `/api/workspaces/{id}/links/bulk-move` |
| bulk tags | PATCH | `/api/workspaces/{id}/links/bulk-tags` |
| bulk delete | DELETE | `/api/workspaces/{id}/links/bulk` |
| CSV export | GET | `/api/workspaces/{id}/links/export.csv` |
| organization choices | GET | `/api/workspaces/{id}/organization` |
| destination-risk presentation | GET | `/api/workspaces/{id}/link-risks` |

Canonical Link JSON is snake_case and includes `id`, `workspace_id`, `created_by`, `code`, `domain`, `destination`, `title`, `status`, `redirect_status`, `password`, `clear_password`, `expires_at`, `max_clicks`, `one_time`, `folder_id`, `campaign_id`, `tag_ids`, organization labels, `utm`, `routing_rules`, `ab_destinations`, `created_at`, `clicks`, and `visitors`. Password hashes are never exposed.

## P05 backend gaps that must be closed

These are implementation requirements, not optional polish:

1. **Updated column** — `short_links.updated_at` already exists in the schema but the Link service/wire contract does not currently expose it. P05 adds `updated_at` to the real model, list and detail reads.
2. **Date filter** — the frozen Links toolbar requires a date filter while V4 List only accepts search/status/domain/folder/campaign/tag. P05 adds validated `from`/`to` filters against real link timestamps.
3. **Official short-domain path** — `workspaceLinkDomains` and `createOfficialLink` handlers exist, but P05 must ensure they are registered and consumed. Official-domain creation uses `CreateOfficialWithPolicy`; custom-domain creation remains subject to workspace DNS/HTTPS validation.
4. **Link QR** — existing `/share-qr` supports text/bio/file only. P05 extends the existing resource QR handler with `kind=link` and generates the actual short URL. It does not implement the later full QR vertical slice.
5. **RBAC presentation** — read-only workspace roles may read links but mutation controls must be disabled/hidden according to the real workspace role/capability result; no optimistic fake permission state.
6. **Real states** — loading, empty, error, partial-error, permission denied/read-only, quota/rate-limit/disabled responses and destructive confirmation must render from real API outcomes rather than demo fixtures.

## Mutation semantics

- Create and all bulk mutations require workspace `edit` permission.
- Standard create validates custom domains as active and HTTPS-ready.
- Official-domain create validates against active `official_short_domains`.
- Existing-link updates require a non-empty change reason (max 255 chars), write a new version snapshot, and resync the Redis redirect plane.
- Status values are `active`, `paused`, or `expired`; redirects are 301/302/307/308.
- Password minimum is 6 characters and plaintext is cleared before output.
- Bulk delete is a soft delete and may be used with a one-item `ids` array for the detail danger zone.
- Bulk operations accept at most 100 link ids where enforced by the service/handler.

## Acceptance

P05 is complete only when its exact branch HEAD passes repository verification, strict TypeScript/build checks, P05 browser coverage at the frozen viewport matrix, and relevant Go/backend tests. Completion is recorded on issue #8 against the exact tested SHA. P06+ remains untouched after P05 completion per the execution boundary for this work session.
