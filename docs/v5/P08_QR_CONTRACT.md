# P08 — QR Vertical Slice Contract

Status target: exact-head acceptance only.

## Frozen sources

This phase is subordinate to `GoJet_V5_MASTER_PLAN.md`, `GoJet_V5_BRAND_DESIGN_SYSTEM.md`, `GoJet_V5_PAGE_LEVEL_IA.md`, and `CAPABILITY-MATRIX.md`.

## User surface

Route: `/app/qr`.

The V5 Workspace must provide:

- QR list with preview, name, destination, scan count, and update/create time;
- create sheet with destination, size, foreground/background and an explicit export format;
- live preview from the real Link QR endpoint;
- detail presentation with QR preview, target, status, scan analytics and downloads;
- PNG/SVG/PDF exports through the already accepted P05 Link QR endpoint;
- read-only presentation for roles without edit permission;
- explicit permission, quota, rate-limit and disabled/service-unavailable states;
- responsive layouts at 1440x900, 1024x768, and 390x844 without primary-page horizontal scrolling.

Logo and editable error-correction controls are not rendered until a backend capability actually supports them. Unsupported controls must not be simulated in the browser.

## Security and server truth

- QR CRUD remains on the Go API.
- QR creation must call `requireQRLinkRiskAllow`; a browser-filtered link list is presentation only.
- Only an active link with an effective destination-risk decision of `allow` may be used to create a QR.
- QR tracking remains signed by `QR_TRACKING_KEY` and scan counts remain derived from backend analytics events with `visit_type='qr'`.
- Workspace RBAC remains enforced by `resources.Service.canEdit` / workspace role checks.
- Browser code must not invent scans, risk status, quota state or stored QR resources.

## Gate

P08 is complete only when the exact branch HEAD passes:

- P01-P07 regression verifiers;
- `verify:p08-qr`;
- strict TypeScript and independent app build;
- Go tests covering resource/platform QR behavior;
- P04-P07 browser regressions;
- P08 QR browser gate at all three frozen viewports.

Only after exact-head success may the QR rows in `CAPABILITY-MATRIX.md` be changed to `DONE` and P09 begin.
