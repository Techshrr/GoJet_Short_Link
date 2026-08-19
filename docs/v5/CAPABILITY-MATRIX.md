# GoJet V5 Capability Matrix

**Product:** GoJet V5  
**Release version:** `5.0.0`  
**V5 branch:** `rebuild/v5-specification-rebuild`  
**Historical migration baseline (reference only):** `rebuild/v4-rc12-real-install-fixes@43c49f8bcf761c88dfd27e94a69fba7756bd8486`  

## Authority rule

This matrix is the V5 implementation/release closure matrix. Historical migration-state markers are not valid V5 release states.

- Every capability row must contain only `DONE` or `N/A` in its status cells before Release/Tag promotion.
- Every capability must have `Release = DONE` before a V5 tag may be created.
- `DONE` means the capability is implemented and owned by its corresponding P00–P22 phase; final release authority is granted only when the **same exact HEAD** passes P17, P20/G0–G10, P21/G11 and P22/G12–G13.
- The final tag gate must reject any unresolved/legacy status row, a stale branch HEAD, missing exact-head prerequisite run, missing immutable P21 artifact, or missing P22 production-validation evidence.
- Issue #8 is the authoritative execution/evidence ledger. Historical V4 CI success is never a V5 release authority.

## Capability status

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
| QR create/style/download | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| QR tracking / analytics | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Text sharing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| File upload/share/download | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| File quarantine / ClamAV / publish state | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Link in Bio | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Analytics overview | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Resource analytics | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Workspace | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Members / invitations | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Roles / permissions / RBAC | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Campaigns | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Folders | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Tags | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Plans / quotas | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Billing | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Orders / invoices | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Payment channels / callbacks | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| FX / rate history / override | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Support tickets | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Ticket attachments | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Mail queue / delivery | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Mail templates / variables / preview | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Register / email verify / login | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Forgot / reset password | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| OAuth / social login / binding | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Session management / revoke | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| TOTP / backup codes | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Turnstile policy / verification | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Destination Risk | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Abuse reports | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Security events | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Audit log | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Admin users | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Admin workspaces | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Admin resource governance | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Admin roles / permissions | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Announcements | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| System settings | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Service status / operations monitor | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Storage configuration | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| API keys | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Webhooks | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Redirect engine | DONE | DONE | N/A | N/A | DONE | DONE | DONE | DONE |
| Analytics worker | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Analytics reconciler | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| File worker | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Mail worker | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Operations monitor | DONE | DONE | DONE | DONE | DONE | DONE | DONE | DONE |
| Log receiver | DONE | DONE | N/A | DONE | DONE | N/A | DONE | DONE |
| PHP 8.3 web installer | DONE | N/A | DONE | N/A | DONE | DONE | DONE | DONE |
| Native systemd deployment | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Nginx production routing | DONE | N/A | N/A | N/A | DONE | DONE | DONE | DONE |
| MySQL migration catalog | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Authenticated Redis production runtime | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Website SSG / SEO | N/A | N/A | DONE | N/A | DONE | DONE | DONE | DONE |
| Docs static build / Pagefind | N/A | N/A | DONE | N/A | DONE | DONE | DONE | DONE |

## Phase ownership

- P05–P17 own customer/product/admin capability implementation and browser/security acceptance.
- P18 owns Docs static output and Pagefind.
- P19 owns final Website SSG, SEO and exact-product visual composition.
- P20 owns whole-product G0–G10 closure, including all eight Go runtimes and real full-stack P0.
- P21 owns immutable Native package G11, checksums, SBOM and version manifest.
- P22 owns fresh Native install G12 and production validation G13.
- Release/Tag promotion is a separate post-P22 authority gate and may only tag the exact HEAD that has all required same-SHA evidence.
