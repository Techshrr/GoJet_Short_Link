# GoJet V5 P14 — Support / Mail Contract

P14 productizes the existing server truth; it does not fork or replace the V4-compatible support and mail services.

## Workspace support
- `/app/support` lists only tickets owned by the authenticated user.
- Creation uses the active server department registry and server-validated priority values.
- Detail renders the persisted message timeline; administrator internal notes are excluded by the API.
- Reply, close and reopen actions are non-optimistic and refresh from server truth.

## Admin tickets
- `/admin/tickets` uses the production queue filters: status, department and search.
- Administrator customer replies and internal notes are distinct operations on the same endpoint.
- Status, priority and department changes are server validated and audited by the existing handler.

## Admin mail operations
- `/admin/mail` exposes queue/delivery status, attempt counts, errors and retry for failed messages.
- Retry returns a failed message to the worker queue; it does not fabricate a sent state.
- `/admin/mail-settings` reads SMTP secrets only as `password_configured`. Saving an empty password preserves the existing secret.
- SMTP test uses the production provider path and mail health state.
- `/admin/templates` edits only subject/content fragments; shared brand wrapper markup remains centrally generated.

## Gate
P14 requires source-contract verification, TypeScript/build checks, existing Go support/mail tests, and desktop/tablet/mobile Browser Gate coverage for Workspace Support and Admin Tickets/Mail. No browser Web Storage token persistence is permitted.
