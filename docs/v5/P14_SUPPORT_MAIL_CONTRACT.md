# GoJet V5 P14 — Support / Tickets / Mail Contract

P14 productizes the existing server truth without forking the V4-compatible support and mail services. The frozen page-level IA is authoritative.

## Workspace Support Center
- `/app/support` is titled **Support Center** and contains the create-ticket form, owned-ticket list, current ticket thread, recommended Help Center, and response-time explanation.
- New ticket fields are Department, Priority, Subject, Message, Attachments, and Turnstile when `ticket_create` bot protection is enabled.
- Replies expose optional Attachments and Turnstile when `ticket_reply` protection is enabled.
- Ticket create/reply Turnstile enforcement is server-side through the shared `turnstileGuard`; the browser only supplies the Cloudflare token.
- Attachments are limited to 5 per ticket and 10 MB each. They are stored through the configured object-storage driver and synchronously scanned with the configured ClamAV endpoint. Only `scan_status=clean` files receive a download URL; infected/failed/pending objects cannot be downloaded.
- Attachment downloads require the ticket owner session, use `private, no-store`, and `nosniff`; Admin receives separate permission-gated list/download routes.
- Detail renders persisted messages; administrator internal notes remain excluded from the customer API.
- Reply, close and reopen actions are non-optimistic and refresh from server truth.
- Mobile keeps the ticket list first and exposes a return-to-list affordance from the current-ticket section.

## Admin tickets
- `/admin/tickets` uses production queue filters: status, department and search.
- Customer replies and internal notes remain distinct operations on the same server-side ticket lifecycle.
- Status, priority and department changes are server validated.
- Clean customer attachments are visible/downloadable to administrators through `tickets.manage`; unsafe or incomplete scans are status-only.

## Admin mail operations
- `/admin/mail` exposes queue/delivery status, attempt counts, errors and retry for failed messages.
- Retry returns a failed message to the worker queue; it never fabricates a sent state.
- `/admin/mail-settings` reads SMTP secrets only as `password_configured`. Saving an empty password preserves the existing secret.
- SMTP test uses the production provider path and mail-health state.
- `/admin/templates` edits only subject/content fragments; shared brand wrapper markup remains centrally generated.

## Gate
P14 requires source-contract verification, strict TypeScript/build checks, Go support/mail/platform tests, and desktop/tablet/mobile Browser Gates for Workspace Support Center and Admin Tickets/Mail. The Gate explicitly verifies Turnstile IA, scanned attachments, Help Center/response-time sections, internal-note isolation, write-only SMTP secrets, and the no-Web-Storage authentication invariant.
