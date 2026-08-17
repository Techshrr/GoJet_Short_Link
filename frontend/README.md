# GoJet V5 Frontend

This directory is in a controlled V4 → V5 migration.

## V5 applications

- `apps/site` — Website + Auth engineering boundary. Public SSG is a later gate and must not be inferred from the P01 Vite placeholder.
- `apps/docs` — static Astro Starlight documentation application.
- `apps/workspace` — `/app/*` React SPA.
- `apps/admin` — `/admin/*` React SPA.

## Shared packages

P01 starts with `api-client`, `auth` and `tokens`. GJ-V5-001/002 require the remaining shared packages (`ui`, `charts`, `icons`, `domain`, `motion`, `utils`) to be introduced before their owning phases need them.

## Legacy V4 directories

`adminconsole`, `publicsite`, `shared` and `userconsole` are frozen V4 migration inputs. Do not add new V5 features to them. Do not delete them until the Capability Matrix proves their functionality has been remapped and accepted.

## Authentication invariant

V5 browser authentication is session/cookie oriented. `@gojet/api-client` uses `credentials: include` and optional CSRF injection. Do not introduce auth-token persistence in `localStorage` or `sessionStorage`.

## Commands

From `frontend/`:

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm build
```

A dedicated GitHub Actions workflow runs the same foundation checks on the V5 branch.
