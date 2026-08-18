# P10 — Text Vertical Slice Contract

Status target: exact-head acceptance only.

## Frozen sources

This phase is subordinate to `GoJet_V5_MASTER_PLAN.md`, `GoJet_V5_BRAND_DESIGN_SYSTEM.md`, `GoJet_V5_PAGE_LEVEL_IA.md`, and `CAPABILITY-MATRIX.md`.

## User surface

Route: `/app/text`.

The V5 Workspace must provide:

- real Text list with Title, Type, Views, Expiry, Created and Status;
- create/edit flow for plain text, Markdown and code/log content;
- live editor preview without injecting user HTML in the Workspace;
- optional password, expiry and one-time controls backed by the Go service;
- custom public code backed by the persisted `slug` contract;
- public `/t/{slug}` access and explicit custom-domain handoff to the Domains pipeline;
- read-only presentation for roles without edit permission;
- terminal `consumed` and `expired` presentation without fake reactivation;
- explicit Permission Denied, Quota Exceeded, Rate Limited, Disabled/service unavailable, Empty and Error states;
- destructive delete confirmation;
- responsive layouts at 1440x900, 1024x768 and 390x844 without primary-page horizontal scrolling.

The frozen page IA mentions a code-language control. The inherited V4 Text schema persists `format` but has no language column. V5 must display this boundary rather than fabricating persistence. Likewise, Text does not invent a per-share custom-domain binding that the backend does not store.

## Security and server truth

- Workspace RBAC, quota, content-size validation, password hashing, expiry, one-time consumption and view counts remain Go backend truth.
- Public Text rendering remains server-owned. Plain/code content is escaped; Markdown uses the constrained escaped renderer rather than arbitrary HTML.
- Public Text pages remain `noindex,nofollow`, `no-store`, `nosniff` and CSP constrained.
- Browser code must not use `dangerouslySetInnerHTML` for Text preview.
- Browser code must not persist auth/session or Text resource state in Web Storage.
- A one-time share is consumed only after a successful server-side read.

## Gate

P10 is complete only when the exact branch HEAD passes:

- P01–P09 regression verifiers;
- `verify:text`;
- strict TypeScript and independent app build;
- Go tests for resources/platform API plus existing fileworker and analytics runtime regressions;
- P04–P09 browser regressions;
- P10 Text browser gate at all three frozen viewports;
- fixed browser checks for CRUD request wiring, read-only RBAC, empty/disabled/quota states, terminal-state presentation and no horizontal overflow.

Only after exact-head success may the Text sharing row in `CAPABILITY-MATRIX.md` be changed to `DONE` and P11 begin.
