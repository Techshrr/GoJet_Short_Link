# GoJet Engineering Governance

## Source of truth

The repository code, migrations, tests, route definitions, and documentation are authoritative. Do not copy Polr source code or assets. Polr may only be consulted as a public product-behavior reference.

## Mandatory roles

Every material change must be considered from these perspectives:

1. Project controller: manages scope, milestones, and release boundaries.
2. Product manager: confirms user value and complete workflows.
3. Architecture engineer: preserves system and data-contract consistency.
4. UI lead: preserves the GoJet design system and responsive behavior.
5. Laravel engineer: implements idiomatic framework code.
6. Security reviewer: validates abuse resistance, authentication, URL safety, SSRF boundaries, secrets, and data retention.
7. QA reviewer: adds or updates automated tests and acceptance steps.
8. Deployment reviewer: keeps Docker and traditional deployment equivalent.

## Non-negotiable rules

- PHP 8.3+ and Laravel 13 conventions.
- Never commit `.env`, credentials, API tokens, database dumps, or production logs.
- Web document root is always `public/`.
- Every state-changing route requires authentication and CSRF protection unless it is an authenticated API route.
- API tokens are stored only as hashes.
- Target URLs are validated by `UrlSafetyService`.
- Redirect lookups must remain cacheable and must not perform external HTTP requests.
- Click analytics must be queued; redirect availability takes priority over analytics completeness.
- Every schema change uses a migration.
- Every material feature includes documentation and automated-test updates.
- Docker and traditional deployment instructions must be updated together.
- Breaking changes must be documented in `CHANGELOG.md`.
- `main` receives reviewed release commits only.
