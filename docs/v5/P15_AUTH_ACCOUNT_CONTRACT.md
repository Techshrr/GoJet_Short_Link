# GoJet V5 P15 — Auth / OAuth / Account Contract

P15 completes browser authentication and account security on top of the existing Identity and social-provider services. It keeps the legacy Bearer path for non-browser clients while making the V5 browser contract server-side-session first.

## Auth shell
- `/login` and `/register` use the frozen 46/54 desktop Auth Shell and collapse to one column below 1024px.
- Login fields are Email, Password, **Remember this session**, Turnstile when enabled, and Forgot password. Only providers returned by `/api/public/auth/providers` are rendered.
- Register fields are Email, Password, Confirm password, optional Display name, Terms/Privacy acceptance and Turnstile when enabled.
- Forgot/reset render Turnstile when their corresponding server surfaces are enabled.
- Turnstile configuration comes from `/api/public/turnstile`; the official Cloudflare explicit widget supplies `turnstile_token`, while the server remains authoritative for verification.
- Password login, OAuth handoff and OAuth registration establish the same server-side `user_sessions` truth. The login request carries the explicit `remember_session` preference, and Identity exposes bounded TTL-aware session issuance primitives for the session policy boundary.
- OAuth handoff cannot bypass MFA: an MFA-enabled user receives a short-lived secondary challenge before a browser session is accepted.
- Registration keeps existing registration policy, email verification/code rules and social-registration collision protections.
- `/verify-email`, `/forgot-password` and `/reset-password` use existing verification/reset service truth. Legacy `/verifyemail` and `/resetpassword` aliases remain available.

## Browser session boundary
- Browser sessions use an HttpOnly, SameSite=Lax `gojet_session` cookie. Secure is enabled when TLS (or trusted HTTPS forwarding) is present.
- Unsafe cookie-authenticated requests require the double-submit `gojet_csrf` cookie and `X-CSRF-Token` header.
- `/api/session` exposes only identity state and the CSRF token; V5 packages never persist auth tokens in Local/Session Storage.
- Authorization Bearer remains accepted for existing API clients.

## Security and sessions
- `/app/settings/security` provides password change, TOTP setup/enable/disable and backup-code regeneration.
- TOTP secrets are encrypted by the existing Settings Store AES-GCM sensitive-setting path. Backup codes are persisted only as SHA-256 hashes and plaintext is returned only at generation time.
- MFA login challenges expire after ten minutes and are single-use.
- `/app/settings/sessions` displays server-side session metadata and supports one-session or all-other-session revocation.

## Connected Accounts and Admin OAuth
- `/app/settings/connected-accounts` consumes the existing provider binding/unbinding APIs and their last-credential protections.
- `/admin/oauth` consumes the production provider registry and Settings Center. Client secrets are write-only; masked stored values are never copied into an editable secret field.
- Rainbow remains constrained by its configured login-type allowlist.

## Gate
P15 requires P01–P15 source/type/build gates, Go Identity/platform tests, and fixed desktop/tablet/mobile Browser Gates for Auth, Settings/Sessions/Connected Accounts and Admin OAuth, plus every P04–P14 Browser Gate regression. The frozen Auth Gate explicitly covers Confirm Password, Terms, Remember Session, and Turnstile wiring. Capability Matrix rows remain non-DONE until an exact-current-HEAD P15 workflow succeeds.
