# GoJet architecture

GoJet is delivered as three clearly separated product surfaces backed by a
shared platform API and a high-performance redirect data plane:

- **Public site** — product pages, authentication, legal pages, abuse reporting
  and public resource pages.
- **Customer console** — authenticated workspace, link, QR code, file, billing,
  analytics and support operations.
- **Administrator console** — platform administration, security, settings,
  billing, mail, support and operational controls.

The production web root is `public/`. Customer and administrator applications
are published at `public/app/` and `public/admin/`. Runtime-generated brand
assets use `public/assets/images/`; generated QR images use
`public/generated/qr/`. These paths are part of the production contract and are
shared consistently by the API, Nginx and deployment definitions.

## Runtime services

The production package contains eight Go executables:

1. `redirectengine` — resolves short links and records realtime visit events.
2. `analyticsworker` — persists visit events and aggregate analytics.
3. `analyticsreconciler` — reconciles realtime and persisted counters.
4. `platformapi` — serves customer, administrator and public product APIs.
5. `mailworker` — renders and sends queued branded transactional mail.
6. `fileworker` — processes file scanning and retention work.
7. `operationsmonitor` — evaluates operational state and platform alerts.
8. `logreceiver` — receives structured service logs.

MySQL is the durable business store. Redis provides realtime redirect state,
rate limiting, streams and short-lived application data. ClamAV provides file
malware scanning. Nginx serves the published web tree and routes API, public
resource and redirect traffic to the correct service.

## Redirect and analytics contract

1. `GET /{code}` resolves an active link from Redis.
2. One Redis Lua transaction increments the realtime counter, updates the
   HyperLogLog unique-visitor estimate and appends the complete visit event to
   `gojet:analytics:events`.
3. A redirect is returned only after Redis acknowledges the stream append. If
   the analytics store is unavailable, the request fails explicitly instead of
   silently losing the visit.
4. The analytics worker consumes the stream through a consumer group, writes
   idempotent events and daily aggregates to MySQL, and acknowledges only
   successful transactions. Abandoned pending events are reclaimed and
   permanent parsing failures remain recoverable.
5. The analytics reconciler compares realtime Redis counters with MySQL,
   repairs counters only upward and records lag/recovery state for operations.

`GET /api/links/{id}/stats` reads realtime values so a delayed worker cannot
make a visited link appear unused. `GET /api/system/analytics` exposes stream
state for operational monitoring.

The same atomic visit operation maintains UTC daily clicks plus source, device
and browser dimensions. Bot traffic has its own counter and is excluded from
unique visitors. A per-link/per-visitor minute window rejects excess traffic
before it can pollute analytics.

## Privacy and source semantics

Visitor identifiers are SHA-256 hashes derived from a secret key, client
address and user agent; raw client IP addresses are not persisted in analytics
events. An empty Referer is classified as `direct`; a present and parseable host
is `referer`; malformed or hostless values are `unknown`. Bot events remain
separately marked so dashboards can exclude them without destroying audit
history.

## Public-resource routing

Public product resources are owned by the platform API rather than the short
link redirect fallback:

- `/t/{slug}` — text shares
- `/p/{slug}` — public profile pages
- `/f/{slug}` — file shares

All supported Nginx deployment definitions preserve this routing contract.
Short-link codes continue to use the redirect engine as the final fallback.

## Brand and generated asset contract

Brand uploads and generated QR images are durable runtime data, not source
files. The API writes them to their configured storage directories while Nginx
serves the corresponding public namespaces:

- `/assets/images/...` — logos and other managed brand images
- `/generated/qr/...` — generated QR images

Production package validation verifies these namespaces, their mount points and
their Nginx aliases together so an upload cannot succeed while the public URL
points at a different directory.

## Release integrity

A production archive is fresh-install only. It contains compiled service
binaries, database migrations, published web assets, deployment definitions,
installer components and runtime documentation. Development source trees and
test harnesses are intentionally excluded. `MANIFEST.sha256` verifies every
packaged file and the archive itself is distributed with a separate SHA-256
checksum.