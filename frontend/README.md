# GoJet V5 Frontend

This directory is in a controlled V4 → V5 migration governed by `docs/v5/GoJet_V5_MASTER_PLAN.md`, `GoJet_V5_BRAND_DESIGN_SYSTEM.md` and `GoJet_V5_PAGE_LEVEL_IA.md`.

## V5 applications

- `apps/site` — Website + Auth engineering boundary. Public Website SSG is a later gate and must not be inferred from the P01 Vite engineering placeholder.
- `apps/docs` — static Astro Starlight documentation application. P01 verifies real static EN and zh-CN output; the full documentation IA belongs to P18.
- `apps/workspace` — `/app/*` React SPA with TanStack Router + Query.
- `apps/admin` — `/admin/*` React SPA with TanStack Router + Query.

## Shared packages

P01 establishes all frozen package boundaries:

- `api-client` — same-origin/session API transport, CSRF injection and typed API errors.
- `auth` — client session snapshot/CSRF lifecycle without browser Web Storage token persistence.
- `tokens` — frozen GoJet semantic brand/surface/status tokens.
- `ui` — P03 Design System implementation boundary.
- `charts` — chart wrapper boundary.
- `icons` — Lucide/product/brand asset boundary.
- `domain` — shared product-domain types and schemas.
- `motion` — GJ-V5-002 motion-system boundary.
- `utils` — genuinely cross-surface utilities only.

The last six packages intentionally contain only P01 boundaries until their owning phase starts. Do not smuggle unfinished P03/P05 work into P01 to make the repository look more complete than it is.

## Code splitting

Workspace and Admin include lazy route boundaries at P01. Their Vite manifests are generated during CI and the foundation workflow verifies that:

- `workspace/src/routes/LinksBoundary.tsx`
- `admin/src/routes/UsersBoundary.tsx`

are emitted as dynamic entries. P05/P17 replace these engineering boundaries with real product routes without regressing the split contract.

## Legacy V4 directories

`adminconsole`, `publicsite`, `shared` and `userconsole` are frozen V4 migration inputs. Do not add new V5 features to them. Do not delete them until `docs/v5/CAPABILITY-MATRIX.md` proves their functionality has been remapped and accepted.

## Authentication invariant

V5 browser authentication is session/cookie oriented. `@gojet/api-client` uses `credentials: include`, `cache: no-store` and optional CSRF injection. Do not introduce auth-token persistence in `localStorage` or `sessionStorage`.

## Reproducible dependencies

`pnpm-lock.yaml` is committed. CI must install with `pnpm install --frozen-lockfile`; dependency drift is a failing condition rather than an implicit lockfile rewrite.

## Commands

From `frontend/`:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

`V5 Frontend Foundation` additionally verifies first-party Web Storage policy, Docs static output, and Workspace/Admin route-level code splitting on the exact branch HEAD.
