# P16 Trust & Safety Contract

Status target: P16 acceptance gate for `rebuild/v5-specification-rebuild`.

## Frozen surfaces

- `/admin/destination-risk` and `/admin/destination-risk/:linkId`: compact review queue, Admin-only assessment detail, manual `allow/review/block` override, override removal and rescan.
- `/admin/file-security`: compact scan queue with MIME, size, scan attempts and controlled retry for scanner errors. Infected files are never restored by the retry action and the console never embeds uploaded content in an iframe.
- `/admin/abuse`: report triage with `investigating/resolved/rejected` outcomes and a mandatory resolution reason.
- `/admin/security-events`: platform security-event queue and explicit resolution workflow.
- `/admin/audit`: read-only normalized governance timeline without raw metadata/secrets in the table.

## Server contracts

P16 consumes the existing RBAC-protected Go handlers for `/api/admin/destination-risks`, `/api/admin/files`, `/api/admin/abuse`, `/api/admin/security`, and `/api/admin/audit`. Destination-risk overrides are authoritative database decisions with fail-closed redirect-cache synchronization and audit records. Public abuse submission remains `/api/abuse-reports`.

## Information boundary

Customer-facing workspace link-risk state exposes only link id, automatic/effective decision, score, timestamps and pending/manual state. Risk provider identity, evidence, administrator identity and manual review notes are Admin-only. This closes the V5 IA requirement that internal risk-provider/evidence detail must not leak onto user-facing risk surfaces.

## Gate

P16 may be marked `DONE` only after the exact branch HEAD passes `pnpm check`, Go tests for destination-risk/platform API code, the complete P01–P15 browser regression set, and `pnpm test:trust-safety`. The exact-head workflow writes its evidence back to Issue #8.
