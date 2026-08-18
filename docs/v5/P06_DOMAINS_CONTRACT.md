# P06 Domains / URL System Contract

Status: implementation gate for Issue #8 P06 on `rebuild/v5-specification-rebuild`.

## 1. Frozen-source interpretation

P06 implements the Workspace `Domains` surface defined by the V5 Master Plan and Page-Level IA. V4 frontend code is capability evidence only; V5 presentation must reuse the P02 brand foundation, P03 design system, P04 Workspace shell, and P05 cookie-session/API/RBAC conventions.

## 2. Product scope

P06 owns two existing URL-system capabilities without changing their backend truth:

1. **Official short-link domains** — read-only platform-provided domains that the backend exposes through the workspace link-domain endpoint.
2. **Custom domains** — creation, DNS ownership verification, verification-record rotation, TLS/HTTPS readiness, error state, and last-check metadata.

A custom domain is presented as usable only when both ownership status and HTTPS status are `active`. The browser must never infer readiness from DNS or TLS on its own.

## 3. API contract

V5 consumes the existing Platform API through the shared cookie/session transport:

- `GET /api/workspaces/:workspace/domains`
- `POST /api/workspaces/:workspace/domains` with `{ "hostname": "..." }`
- `POST /api/workspaces/:workspace/domains/:domain/verify`
- `POST /api/workspaces/:workspace/domains/:domain/verify?rotate=1`
- `GET /api/workspaces/:workspace/link-domains`
- `GET /api/workspaces/:workspace/links/capabilities`

Creation and rotation responses expose the one-time TXT record as `dns_record { type, name, value }`. V5 may display that record but must not persist the verification token in browser Web Storage.

## 4. RBAC

Backend authorization remains authoritative:

- workspace members may list domain state;
- only roles allowed for `manage` may create domains, rotate TXT verification records, or execute verification;
- the V5 UI consumes the existing capability endpoint and removes write controls when `can_manage !== true`;
- frontend gating is UX only and does not replace backend authorization.

## 5. Required states

The P06 route must cover:

- workspace loading / workspace API failure / no workspace;
- domain list loading / empty / API failure;
- capability read-only state;
- add-domain validation and server failure;
- pending, active, and error ownership states;
- pending, active, and error HTTPS states;
- server-supplied `last_error` and `last_checked_at`;
- generated / regenerated DNS record presentation;
- responsive desktop, tablet, and mobile layouts with no horizontal overflow.

## 6. Verification Gate

P06 is accepted only on the exact branch HEAD when all of the following are green together:

- P02 brand verification;
- P03 design-system verification;
- P04 shell verification and browser regression;
- P05 Links verification and browser regression;
- P06 static contract verification;
- strict TypeScript typecheck and independent application builds;
- Go tests for `app/domains` and `services/platformapi/cmd/server`;
- P06 Playwright tests at 1440×900, 1024×768, and 390×844 plus RBAC/empty/error states;
- the workflow confirms the tested SHA still equals the current V5 branch HEAD before posting Issue #8 evidence.

A stale or failed workflow run cannot mark P06 complete and cannot unlock P07.
