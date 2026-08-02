# GoJet V4 Validation Report

Last updated: 2026-08-02

This report records only evidence that is reproducible from the current repository. Historical claims from the production archive have been removed because that archive excluded `tests/`, `.github/`, and `redirector/`.

## Executed in the current workspace

- Archive integrity and path safety: **passed** (12,171 entries; no absolute or parent-traversal paths).
- Frontend dependency install: **passed** with `npm ci`.
- Production frontend build: **passed** with Vite 7.3.6 (692 modules transformed).
- Shell syntax: **passed** for `scripts/*.sh`, `install.sh`, `upgrade.sh`, and `rollback.sh`.
- JSON parsing: **passed** for `package.json` and `package-lock.json`.
- Release archive defect confirmed: the received production package intentionally excluded `tests/`, `.github/`, and `redirector/`, while its validation script required those paths.

## Not executable in the current workspace

- PHP syntax, Laravel routes, Blade compilation, PHPUnit, and Pint: **not run** because PHP is not installed in this workspace.
- Go redirector source has now been independently rebuilt from the documented Laravel/Redis/spool contract. Formatting, tests, race detector, vet, and binary rebuild are **pending GitHub Actions** because Go is not installed in the current recovery container.
- Database-backed flows: **not run** because the required PHP runtime and database drivers are unavailable.
- Browser and responsive acceptance: **not run** pending an executable Laravel environment and stable fixture data.

## Restored repository gates

- `tests/` now contains an initial Laravel test harness, public-route coverage, locked-route compatibility checks, and URL safety checks.
- `.github/workflows/ci.yml` defines PHP 8.3, MySQL 8.4, Redis 7.4, PHPUnit, Pint, Vite, Compose, and Go gates.
- The Go CI job is enabled and is the acceptance gate for the reconstructed source. The received prebuilt binary is retained only as a historical production artifact and is not accepted as source evidence.

## Production-only acceptance

Real SMTP delivery, DNS/custom-domain validation, Cloudflare certificate lifecycle, proxy headers, systemd/Supervisor survival, backup/restore, rollback, and responsive visual review must be executed on the target server using `ACCEPTANCE_CHECKLIST.md`.
