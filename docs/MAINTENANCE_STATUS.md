# GoJet Release Validation Status

The temporary corrective-maintenance workflow has been retired. The authoritative release gate is `.github/workflows/ci.yml`, which fails normally when any required check fails.

## Last completed strict validation

- Workflow: `CI`
- Run: `#9`
- Source commit: `a932d112cf642a210a4de96e2a46055df0b5b439`
- Result: **PASS**

### Application job — PASS

- Composer metadata validation
- Locked PHP dependency installation
- Application key generation
- Locked frontend dependency installation
- Vite production build
- Shell-script syntax validation
- Laravel Pint formatting check
- Clean MySQL migration
- PHPUnit: 17 tests, 42 assertions
- Redis-backed `php artisan gojet:check --json`

### Docker deployment job — PASS

- Docker Compose configuration validation
- Multi-stage production image build
- MySQL and Redis health checks
- PHP-FPM application health check
- Production migrations and seeders
- Public storage link
- Laravel production optimization
- Container installation self-check
- Nginx HTTP `/up` health response
- Controlled service shutdown and volume cleanup

## Release rule

PR #1 may be marked ready only while both strict CI jobs are green on its current head. Production-specific manual checks in `ACCEPTANCE_CHECKLIST.md` remain mandatory after deployment and are not replaced by CI.
