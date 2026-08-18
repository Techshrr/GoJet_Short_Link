# GoJet V5 Capability Matrix

**Baseline:** `rebuild/v4-rc12-real-install-fixes@43c49f8bcf761c88dfd27e94a69fba7756bd8486`  
**V5 branch:** `rebuild/v5-specification-rebuild`  
**Rule:** a row is DONE only when Backend + API + UI + RBAC + States + Browser + Security + Release are all accepted on the same V5 exact HEAD.

Accepted phase evidence:

- **P05 Links:** `c934f3bffc79859d4396506b441bbc68d2f77c78` / Actions `32098269807` success.
- **P06 Domains:** `747cfac87616c5751280927045036b22c862402b` / Actions `32100295633` success. This exact HEAD also re-ran the P05 regression gates.
- **P07 Analytics:** `2bae148abdb9abef169b1837cec19f39ae36c123` / Actions `32101231324` success. This exact HEAD re-ran P01–P06 regressions, analytics runtime tests, and the P04/P05/P06/P07 browser gates.
- **P08 QR:** `2bdd1ed44d959c9b13960c70dd66570f565b8837` / Actions `32103132651` success. This exact HEAD re-ran P01–P07 regressions, strict TypeScript/build, Go resource/platform/analytics tests, and the P04/P05/P06/P07/P08 fixed-viewport browser gates.
- **P09 Files:** `a44c85210dfef89a328e5cc093d3102d4dab0d96` / Actions `32104800662` success. This exact HEAD re-ran P01–P08 regressions, strict TypeScript/build, Go resources/platform/fileworker/analytics tests, and the P04/P05/P06/P07/P08/P09 fixed-viewport browser gates.
- **P10 Text:** `cceda41131e3ce1c2e260bd47198bb3f5b553972` / Actions `32108885612` success. This exact HEAD re-ran P01–P09 regressions, strict TypeScript/build, Go resources/platform/fileworker/analytics tests, and the P04/P05/P06/P07/P08/P09/P10 fixed-viewport browser gates.
- **P11 Bio:** `5360e141102b109000bc090ba9ab78fc485eba1f` / Actions `32110388330` success. This exact HEAD re-ran P01–P10 regressions, strict TypeScript/build, Bio dynamic-entry and public-UGC safety tests, Go resources/platform/fileworker/analytics tests, and the P04/P05/P06/P07/P08/P09/P10/P11 fixed-viewport browser gates.
- **P12 Workspace / Members / Organization:** `f0ff826c25916aaa6f38ba85fe3f500514b0ccd8` / Actions `32117185172` success. This exact HEAD re-ran P01–P11 regressions, strict TypeScript/build, Members/Organization dynamic entries, Go workspace/organization/billing/platform API tests, the frozen Tag token-palette contract, and the P04–P12 fixed-viewport browser gates.
- **P13 Billing / Payments / FX:** `e05e5af582153dae82dc8f4c695a75fb8d0be066` / Actions `32121771838` success. This exact HEAD re-ran P01–P12 regressions, strict TypeScript/build, Workspace Billing/Admin Commerce dynamic entries, Go billing/payments/platform API tests, redacted callback and audited FX invariants, and the P04–P13 fixed-viewport browser gates.
- **P14 Tickets / Mail:** `8412bca2c1d50b3a2f8dd9450ffce3196bdb4ff4` exact-head success persisted in Issue #8. This exact HEAD passed P01–P13 regressions, P14 support/mail contract, strict TypeScript/build, Go mail/platform tests, Workspace Support/Admin Tickets/Admin Mail three-viewport Browser Gates, scanned ticket attachments, Turnstile ticket surfaces, and write-only SMTP secret invariants.
- **P15 Auth / OAuth / Account:** `8412bca2c1d50b3a2f8dd9450ffce3196bdb4ff4` exact-head success persisted in Issue #8. This exact HEAD passed P01–P14 regressions, P15 auth/account contract, strict TypeScript/build, Go Identity/platform tests, Auth/Settings/Sessions/Connected Accounts/Admin OAuth three-viewport Browser Gates, cookie/CSRF, Turnstile, remembered-session UI contract, no-Web-Storage, MFA/backup-code and write-only OAuth secret invariants.

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
| File worker | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
| Mail worker | DONE | N/A | N/A | N/A | DONE | N/A | DONE | DONE |
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
