# Security Specification

## URL controls

- Accept only absolute `http` and `https` URLs.
- Reject embedded credentials, malformed hosts, control characters, localhost names, and private/reserved IP literals when configured.
- Reject redirects back into a GoJet host to prevent loops.
- Never perform metadata previews or remote fetches in the redirect request path.

## Authentication

- Passwords use Laravel's configured adaptive hash.
- Sessions are encrypted, secure, HTTP-only, and SameSite=Lax in production.
- API tokens are random 64-character secrets; only SHA-256 hashes are stored.
- Administrative routes require both authentication and `is_admin=true`.

## Abuse resistance

- Login, registration, link creation, domain verification, API calls, and redirect-password attempts are rate limited.
- Administrators can disable links and domains.
- Abuse reports and audit logs provide an evidence trail.
- Cloudflare Turnstile can be integrated before public registration is enabled at scale.

## Privacy

- Store a keyed HMAC of client IP rather than the raw IP.
- Retain raw click events only for the configured number of days.
- Do not log authorization headers, passwords, tokens, or target URL credentials.

## Secrets

- `.env` is never committed.
- Production secrets must be long, unique, and rotated after suspected exposure.
- Backups must be encrypted and access controlled.
