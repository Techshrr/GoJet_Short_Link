# P11 — Bio Vertical Slice Contract

Status target: exact-head acceptance only.

## Frozen sources

This phase is subordinate to `GoJet_V5_MASTER_PLAN.md`, `GoJet_V5_BRAND_DESIGN_SYSTEM.md`, `GoJet_V5_PAGE_LEVEL_IA.md`, and `CAPABILITY-MATRIX.md`.

## User surface

Route: `/app/bio`.

The V5 Workspace must provide:

- Bio list with phone preview, title, public address/domain handoff, views and status;
- desktop Builder with a frozen 420px control column and live phone preview;
- exactly seven builder tabs: Content, Appearance, Social, Domain, Analytics, SEO and Settings;
- Content controls for title, bio and validated HTTP(S) link blocks;
- Appearance controls backed by persisted Theme JSON;
- Social quick-add behavior that uses the existing validated link-block collection instead of inventing a parallel social schema;
- Domain handoff to the existing Domains pipeline instead of inventing a Bio-domain database binding;
- Analytics using the real persisted `views` counter and a handoff to Workspace Analytics instead of fabricated chart data;
- SEO safety that visibly documents the server-enforced `noindex,nofollow` default and does not expose an unsafe client override;
- Settings for draft / published / paused lifecycle, save and destructive delete;
- create flow that persists a draft through the Go API;
- read-only presentation for roles without edit permission;
- explicit Permission Denied, Quota Exceeded, Rate Limited, Disabled/service unavailable, Empty and Error states;
- responsive layouts at 1440x900, 1024x768 and 390x844 without primary-page horizontal scrolling.

## Server truth and security

- Workspace RBAC, quota, slug sanitation, Bio validation, lifecycle and view counts remain Go backend truth.
- Theme and Blocks remain the existing JSON persistence contract. The backend validates theme colors, a maximum of 50 blocks, non-empty labels and complete HTTP(S) URLs.
- Only `published` pages are publicly readable from `/p/{slug}`.
- Public Bio pages are user-generated content and must render `noindex,nofollow` by default.
- Public Bio output remains `no-store`, `nosniff`, CSP constrained and server-filtered for safe HTTP(S) links.
- Workspace preview uses React text/attributes only and must not inject arbitrary user HTML.
- Browser code must not persist auth/session or Bio resource state in Web Storage.

## Gate

P11 is complete only when the exact branch HEAD passes:

- P01–P10 regression verifiers;
- `verify:bio`;
- strict TypeScript and independent application build;
- dynamic-entry assertion for `BioPage.tsx`;
- Go tests for resources/platform API plus inherited fileworker and analytics runtime regressions;
- P04–P10 Browser Gate regressions;
- P11 Bio Browser Gate at all three frozen viewports;
- fixed browser checks for create/update wiring, seven tabs, 420px/live-preview layout, read-only RBAC, empty/disabled/quota states and no horizontal overflow;
- public Bio noindex and unsafe-URL Go regressions.

Only after exact-head success may the `Link in Bio` row in `CAPABILITY-MATRIX.md` be changed to `DONE` and P12 unlock.
