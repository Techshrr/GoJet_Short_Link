# GoJet V4 Product Hardening Audit

> Branch: `rebuild/v4-product-hardening`
>
> RC9 is treated only as a runnable technical baseline. This branch is not release-ready until every user-visible product and every administrator operation passes the lifecycle checks below.

## Acceptance rule

A feature is **not complete** merely because an API exists or returns 2xx. Every resource must pass:

1. Create from the real UI.
2. Receive a usable canonical public URL or result.
3. One-click copy/share from the UI.
4. Open the result in a fresh unauthenticated browser context.
5. Verify password / expiry / one-time / status rules where applicable.
6. Edit and confirm the public result changes correctly.
7. Verify analytics/counters where promised.
8. Delete/disable and confirm public access stops.
9. Verify administrator can inspect and operate on the resource.
10. Verify mobile + desktop UI and failure states.

A feature missing any required lifecycle step remains **UNVERIFIED**.

## P0 — Installation and runtime integrity

- [ ] Fresh install stops every existing `gojet@*.service` before applying the new instance.
- [ ] Installer restarts current binaries; it must not rely on `enable --now` against already-active old services.
- [ ] `/proc/<pid>/exe` for every GoJet service resolves inside the current installation root.
- [ ] Fresh database is required. Existing GoJet business data causes a hard install failure.
- [ ] Fresh super administrator is actually created in the selected database.
- [ ] Fresh super administrator invariants: expected email, `super_admin`, `active`, `totp_enabled=0`.
- [ ] Installer does not write `installed.lock` before all above checks pass.
- [ ] Admin CSS/JS, user console CSS/JS and public auth pages are fetched over the actual site origin before install success.
- [ ] Restart/reboot restores all eight services from the current installation root.

## P0 — Short links

Confirmed defect on RC9: list presents only `/<code>` and no canonical share URL/copy action.

- [ ] Create link.
- [ ] Result shows canonical short URL, not merely a code fragment.
- [ ] One-click copy button.
- [ ] Open public URL in clean browser and redirect successfully.
- [ ] Custom domain canonical URL.
- [ ] Edit destination without changing public URL.
- [ ] Pause/resume/delete lifecycle.
- [ ] Password, expiry, max clicks, one-time and routing behaviour.
- [ ] QR action available directly from a link.
- [ ] Analytics link from each row/card.
- [ ] Bulk actions.
- [ ] Responsive list/card presentation.

## P0 — QR codes

RC9 generates PNG server-side, but there is no verified real scan lifecycle.

- [ ] Create QR from an active short link.
- [ ] Display PNG in UI.
- [ ] Show encoded target URL.
- [ ] Copy target URL.
- [ ] Download PNG.
- [ ] Real decode/scan test resolves to the expected short-link target.
- [ ] QR visit attribution increments separately from normal redirects.
- [ ] Custom domain QR target.
- [ ] Delete QR without deleting source link.
- [ ] Clear errors for unavailable/paused source links.

## P0 — File sharing

RC9 backend accepts a single file and exposes a direct public download endpoint after a clean scan, but the UI does not present the file as a first-class shareable resource.

- [ ] Upload an individual file from UI.
- [ ] Clear upload progress and scan states.
- [ ] ClamAV pending/scanning/clean/infected/error lifecycle.
- [ ] Once clean, show canonical public download URL.
- [ ] One-click copy/share action.
- [ ] Download in a clean browser without dashboard authentication.
- [ ] Correct filename, MIME type and content length.
- [ ] Expiry and max-download limits.
- [ ] Password protection if product promises it.
- [ ] Download analytics.
- [ ] Delete immediately removes public access.
- [ ] Large-file/resumable upload decision explicitly implemented or explicitly removed from product claims.

## P0 — Text sharing

RC9 currently models only `plain`, `markdown`, and `code`; editor UX is still an engineering form.

- [ ] Plain text mode.
- [ ] Markdown mode with safe rendered preview.
- [ ] Code mode with language selection and syntax highlighting.
- [ ] Canonical public URL shown after creation.
- [ ] One-click copy/share action.
- [ ] Public page has copy/raw actions.
- [ ] Password protection.
- [ ] Expiry.
- [ ] One-time view.
- [ ] View counter.
- [ ] Edit and delete lifecycle.
- [ ] Explicit size and supported-content documentation in UI.

## P1 — Link in Bio

- [ ] Create/edit/publish/pause/delete.
- [ ] Canonical public URL and one-click copy.
- [ ] Drag/drop block ordering.
- [ ] Link/icon/color editing.
- [ ] Real theme gallery rather than two color inputs.
- [ ] Desktop/mobile live preview.
- [ ] Tap analytics.
- [ ] Custom domain support decision.

## P1 — Analytics

- [ ] Dashboard numbers match persisted redirect events.
- [ ] 30-day chart is readable and correctly scaled.
- [ ] Per-link clicks/unique/bot/referrer/country/device/browser.
- [ ] Date range selection.
- [ ] Empty/loading/error states.
- [ ] QR attribution.
- [ ] File/text/bio analytics where promised.

## P1 — Custom domains

- [ ] Add hostname.
- [ ] Copy DNS verification record.
- [ ] Verify/retry.
- [ ] HTTPS state.
- [ ] Use verified domain in link creation.
- [ ] Public redirect works.
- [ ] Disable/delete lifecycle.
- [ ] Clear failure diagnostics.

## P1 — Accounts and authentication

- [ ] `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.
- [ ] Registration policy settings actually affect runtime behaviour.
- [ ] Email verification lifecycle.
- [ ] Password reset lifecycle.
- [ ] User password change revokes old sessions.
- [ ] User logout.
- [ ] Admin login has no operation-level step-up.
- [ ] Admin TOTP is opt-in after login; fresh admin starts with MFA disabled.

## P0 — Administrator console

Every resource page must have the operations appropriate to that resource. Only audit logs are intentionally read-only.

- [ ] Users: create/edit/verify email/suspend/unsuspend/reset password/revoke sessions/delete.
- [ ] Workspaces: inspect/edit/freeze where defined.
- [ ] Links: inspect/pause/resume/delete.
- [ ] Files: inspect/retry scan/quarantine/restore/delete policy.
- [ ] Domains: inspect/disable/enable/delete/recheck.
- [ ] Abuse reports: resolve/reopen/record disposition.
- [ ] Security events: actionable triage.
- [ ] Announcements: Markdown editor + preview + draft/publish/unpublish/delete.
- [ ] Mail: SMTP readback/save/test + template edit/preview/test send.
- [ ] Billing/plans: real editable lifecycle.
- [ ] Administrators: super-admin full permissions; custom permissions; no privilege escalation.
- [ ] Operations: cache clear/reconcile/maintenance without mandatory reason text.
- [ ] Settings: every visible control has a real runtime consumer; no decorative toggles.

## P0 — UI/UX rebuild

Current RC9 admin/user surfaces are engineering-console layouts and are rejected as product UI.

Reference direction: S.EE public information architecture and interaction density, while using GoJet's own brand, code, assets and copy.

- [ ] Shared design tokens: typography, spacing, radii, borders, shadows, motion.
- [ ] Marketing site rebuilt around immediate URL creation and product demonstrations.
- [ ] User console rebuilt around resource creation and shareable results, not database tables.
- [ ] Admin console rebuilt around operational workflows, not debug forms.
- [ ] Auth pages visually consistent with public product.
- [ ] Empty/loading/error/success states designed.
- [ ] Desktop/tablet/mobile responsive acceptance.
- [ ] Keyboard/focus/accessibility baseline.
- [ ] Versioned or content-hashed static assets to prevent stale CSS/JS after deployment.

## Release gates

No new RC package until:

1. Static/unit checks pass.
2. MySQL 8 + Redis integration tests pass from empty databases.
3. Browser lifecycle tests pass for each P0 resource.
4. Fresh-install package verifier passes.
5. Real aaPanel/Debian installation is performed with a new directory and a new empty database.
6. Real-host smoke tests verify public URLs, files, QR, text, admin operations and reboot persistence.
