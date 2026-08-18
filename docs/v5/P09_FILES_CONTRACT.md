# P09 — Files Vertical Slice Contract

Status target: exact-head acceptance only.

## Frozen sources

This phase is subordinate to `GoJet_V5_MASTER_PLAN.md`, `GoJet_V5_BRAND_DESIGN_SYSTEM.md`, `GoJet_V5_PAGE_LEVEL_IA.md`, and `CAPABILITY-MATRIX.md`.

## User surface

Route: `/app/files`.

The V5 Workspace must provide:

- file list with File, Size, Status, Downloads, Expiry, Created and Actions;
- upload sheet supporting browser file browse plus drag/drop and clipboard file paste;
- explicit 100 MB maximum and one-file-per-request backend boundary;
- expiry, maximum-download and optional 6–128 character password controls;
- authoritative file presentation states: Uploading, Processing, Scanning, Safe, Review, Blocked and Failed;
- read-only presentation for roles without edit permission;
- explicit Permission Denied, Quota Exceeded, Rate Limited, Disabled/service unavailable, Empty, Error and Partial Safety states;
- destructive delete confirmation;
- responsive layouts at 1440x900, 1024x768 and 390x844 without primary-page horizontal scrolling.

Folder ingestion must not be simulated. The current backend accepts one file per multipart request; the UI must state that limitation until a real folder-capable backend contract exists.

## Security and server truth

- Upload is accepted with HTTP 202 into the file resource pipeline; 202 is never a browser safety decision.
- Maximum payload remains enforced by `MaxFileSize` and `http.MaxBytesReader` on the Go API.
- New objects are stored below the quarantine prefix with `scan_status=pending` and `status=quarantined`.
- `fileworker` is the scan consumer. If `GOJET_CLAMD_ADDR` is not configured, files remain quarantined rather than being auto-published.
- ClamAV clean results move the object from `quarantine/` to `clean/` and persist `scan_status=clean,status=active`.
- Infected files remain quarantined and are persisted as `scan_status=infected`; repeated scanner failures may become `scan_status=error`.
- Public download remains server-enforced by `OpenDownload`: only `scan_status=clean` plus `status=active` may open the clean object. Expiry and download limits remain server truth.
- Browser code may expose `/f/{slug}` only for a record whose API state is exactly clean + active; this is presentation defense in depth, not the security boundary.
- Public file pages retain `noindex,nofollow`, `no-store`, `nosniff` and CSP headers.
- Workspace RBAC remains server-enforced for list/upload/delete.
- `created_at` is supplied by the Go resource/API contract and must not be fabricated in the browser.

## Gate

P09 is complete only when the exact branch HEAD passes:

- P01–P08 regression verifiers;
- `verify:files`;
- strict TypeScript and independent app build;
- Go tests for resources, platform API, fileworker and analytics runtime regressions;
- P04–P08 browser regressions;
- P09 Files browser gate at all three frozen viewports;
- fixed browser checks for safe-only public actions, read-only RBAC, empty/error/partial states and upload-to-processing behavior.

Only after exact-head success may the Files rows in `CAPABILITY-MATRIX.md` be changed to `DONE` and P10 begin.
