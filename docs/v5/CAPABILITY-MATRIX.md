# GoJet V5 Capability Matrix

**Baseline:** `rebuild/v4-rc12-real-install-fixes@43c49f8bcf761c88dfd27e94a69fba7756bd8486`  
**V5 branch:** `rebuild/v5-specification-rebuild`  
**Rule:** a row is DONE only when Backend + API + UI + RBAC + States + Browser + Security + Release are all accepted on the same V5 exact HEAD.

Accepted phase evidence:

- **P05 Links:** `c934f3bffc79859d4396506b441bbc68d2f77c78` / Actions `32098269807` success.
- **P06 Domains:** `747cfac87616c5751280927045036b22c862402b` / Actions `32100295633` success. This exact HEAD also re-ran the P05 regression gates.

Legend:

- `V4` — capability exists in the frozen V4 baseline and is a migration obligation.
- `PENDING` — V5 implementation/verification not yet accepted.
- `N/A` — column is not applicable to that capability.
- `DONE` — accepted by the corresponding V5 gate; do not use before evidence exists.

| Capability | Backend | API | UI | RBAC | States | Browser | Security | Release |
|---|---|---|---|---|---|---|---|---|
| Link create/list/detail/edit/delete | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Custom short code | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Official short-link domains | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Custom domains / DNS verification | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Redirect status 301/302/307/308 | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Password-protected links | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Link expiration | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Click limit | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| One-time access | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| UTM | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Geo routing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Device routing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Language routing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Source routing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| A/B testing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Link version history / reason / restore | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Bulk link operations | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| QR create/style/download | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| QR tracking / analytics | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Text sharing | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| File upload/share/download | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| File quarantine / ClamAV / publish state | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Link in Bio | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Analytics overview | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Resource analytics | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Workspace | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Members / invitations | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Roles / permissions / RBAC | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Campaigns | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Folders | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Tags | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Plans / quotas | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Billing | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Orders / invoices | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Payment channels / callbacks | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| FX / rate history / override | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Support tickets | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Ticket attachments | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Mail queue / delivery | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Mail templates / variables / preview | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Register / email verify / login | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Forgot / reset password | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| OAuth / social login / binding | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Session management / revoke | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| TOTP / backup codes | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Turnstile policy / verification | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Destination Risk | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Abuse reports | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Security events | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Audit log | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Admin users | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Admin workspaces | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Admin resource governance | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Admin roles / permissions | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Announcements | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| System settings | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Service status / operations monitor | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Storage configuration | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| API keys | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Webhooks | V4 | V4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Redirect engine | V4 | V4 | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| Analytics worker | V4 | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| Analytics reconciler | V4 | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| File worker | V4 | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| Mail worker | V4 | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| Operations monitor | V4 | N/A | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Log receiver | V4 | V4 | N/A | PENDING | PENDING | PENDING | PENDING | PENDING |
| PHP 8.3 web installer | V4 | N/A | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| Native systemd deployment | V4 | N/A | N/A | PENDING | PENDING | PENDING | PENDING | PENDING |
| Nginx production routing | V4 | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| MySQL migration catalog | V4 | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| Authenticated Redis production runtime | PENDING | N/A | N/A | N/A | PENDING | PENDING | PENDING | PENDING |
| Website SSG / SEO | PENDING | N/A | PENDING | N/A | PENDING | PENDING | PENDING | PENDING |
| Docs static build / Pagefind | PENDING | N/A | PENDING | N/A | PENDING | PENDING | PENDING | PENDING |

## Phase ownership

- P05 is the first phase allowed to turn the Links rows from `PENDING` into evidence-backed V5 states.
- P06–P17 own the corresponding product/admin capability rows.
- P18 owns Docs.
- P19 owns final Website exact-HEAD product visuals and final public SSG acceptance.
- P20–P22 own whole-product, package and fresh-install closure.

Historical V4 CI success never converts a `PENDING` V5 cell to `DONE`.
