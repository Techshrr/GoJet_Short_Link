# Authentication credential contract

This file records invariants that must remain true for GoJet social authentication and account recovery. It is documentation, not a migration, and must never be added to `database/migrations/migrationcatalog.txt`.

- Password-created accounts have a usable password credential.
- Social-created accounts begin with `password_login_enabled = FALSE` even though a random non-user password hash exists internally.
- Any real password hash replacement enables password login through the `userspasswordcredentialenable` database trigger.
- A social identity is unique by `(provider, provider_subject)` and a user may bind at most one identity per provider.
- Unbinding must fail when it would remove the user's final usable login credential.
- Provider email must never silently merge or bind an existing GoJet account.
- Provider secrets remain encrypted at rest and masked on administrative reads.
- Login and bind attempts remain one-time, browser-bound and expiring; provider disablement blocks outstanding callbacks before the attempt is consumed.
- Google and GitHub use provider PKCE S256. Providers that do not expose compatible PKCE support still use GoJet's independent state plus browser-secret binding and must not pretend to send provider PKCE.
- Provider access tokens are transient server-side values and are never persisted as GoJet identity data.
- Post-authentication GoJet bearer tokens are delivered only through the one-time handoff exchange, never in callback query parameters or browser history.
