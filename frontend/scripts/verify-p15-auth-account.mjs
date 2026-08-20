import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P15 missing required file: ${file}`); };
const has = (file, tokens) => { const source = read(file); for (const token of tokens) if (!source.includes(token)) throw new Error(`P15 ${file} missing contract token: ${token}`); };
const matches = (file, patterns) => { const source = read(file); for (const pattern of patterns) if (!pattern.test(source)) throw new Error(`P15 ${file} missing route contract: ${pattern}`); };
const lacks = (file, tokens) => { const source = read(file); for (const token of tokens) if (source.includes(token)) throw new Error(`P15 ${file} contains forbidden token: ${token}`); };

for (const file of [
  "apps/site/src/routes/AuthPage.tsx",
  "apps/site/src/TurnstileField.tsx",
  "apps/site/src/auth.css",
  "apps/workspace/src/routes/SettingsPage.tsx",
  "apps/workspace/src/settings.css",
  "apps/admin/src/routes/OAuthPage.tsx",
  "apps/admin/src/oauth.css",
  "packages/auth/src/index.ts",
  "packages/api-client/src/index.ts",
  "packages/ui/src/locale.tsx",
  "../services/platformapi/cmd/server/accountsecurity.go",
  "../services/platformapi/cmd/server/identity.go",
  "../services/platformapi/cmd/server/turnstilepublic.go",
  "../services/platformapi/cmd/server/p15social.go",
  "../app/identity/service.go",
  "../app/identity/sessionissue.go",
  "../database/migrations/useraccountsecurity.sql",
  "../docs/v5/P15_AUTH_ACCOUNT_CONTRACT.md"
]) exists(file);

matches("apps/site/src/router.tsx", [
  /path\s*:\s*"\/login"/,
  /path\s*:\s*"\/register"/,
  /path\s*:\s*"\/verify-email"/,
  /path\s*:\s*"\/forgot-password"/,
  /path\s*:\s*"\/reset-password"/
]);
has("apps/site/src/routes/AuthPage.tsx", [
  "data-p15-auth",
  "social_handoff",
  "social_registration",
  "two_factor_required",
  "/api/auth/login/2fa",
  "/api/public/email-code",
  "remember_session",
  "turnstile_token",
  "localizedError",
  'href="/legal/terms/"',
  'href="/legal/privacy/"',
  'href="/legal/acceptable-use/"',
  "useLocale"
]);
has("apps/site/src/TurnstileField.tsx", ["/api/public/turnstile", "challenges.cloudflare.com/turnstile", "data-turnstile-surface", "useLocale"]);
has("packages/ui/src/locale.tsx", ["localizedError", "gojet_locale", '"zh-CN"', '"en"']);

has("../services/platformapi/cmd/server/identity.go", [
  "TurnstileToken",
  'enforceTurnstile(w, r, "registration"',
  'enforceTurnstile(w,r,"login"',
  'enforceTurnstile(w,r,"forgot_password"',
  'enforceTurnstile(w,r,"reset_password"'
]);
has("../app/identity/service.go", ["LoginWithMetadataTTL", "登录会话有效期无效"]);
has("../app/identity/sessionissue.go", ["IssueSessionWithTTL"]);

matches("apps/workspace/src/router.tsx", [
  /path\s*:\s*"\/settings"/,
  /path\s*:\s*"\/settings\/security"/,
  /path\s*:\s*"\/settings\/sessions"/,
  /path\s*:\s*"\/settings\/connected-accounts"/
]);
has("apps/workspace/src/routes/SettingsPage.tsx", [
  "data-p15-settings",
  "/api/me/security",
  "/api/me/totp/setup",
  "/api/me/totp/enable",
  "/api/me/totp/backup-codes",
  "/api/me/sessions",
  "/api/me/social-identities",
  "clearClientSessionState",
  "useLocale"
]);

matches("apps/admin/src/router.tsx", [/path\s*:\s*"\/oauth"/]);
has("apps/admin/src/routes/OAuthPage.tsx", [
  "data-p15-admin-oauth",
  "/api/admin/auth/providers",
  "/api/admin/settings/socialauth",
  'if (draft.secret.trim()) body[prefix + "client_secret"] = draft.secret',
  "provider.configured",
  "useLocale",
  "localizedError"
]);

has("packages/auth/src/index.ts", [
  'cookieValue("gojet_csrf")',
  'cookieValue("gojet_admin_csrf")',
  "requestCsrf",
  "getCsrfToken",
  "currentCsrfToken",
  "currentAdminCsrfToken"
]);
has("packages/api-client/src/index.ts", ['credentials: "include"', "X-CSRF-Token"]);
has("../services/platformapi/cmd/server/accountsecurity.go", ["gojet_session", "HttpOnly:true", "validCookieCSRF", "verifyTOTP", "user_backup_codes", "/api/me/sessions"]);
has("../services/platformapi/cmd/server/p15social.go", ["p15SocialAuthHandoff", "userMFAEnabled", "setUserSessionCookies", "p15SocialRegistrationComplete"]);
has("../database/migrations/useraccountsecurity.sql", ["CREATE TABLE user_mfa", "CREATE TABLE user_backup_codes", "CREATE TABLE user_mfa_challenges"]);

for (const file of ["apps/site/src/routes/AuthPage.tsx", "apps/workspace/src/routes/SettingsPage.tsx", "apps/admin/src/routes/OAuthPage.tsx", "packages/auth/src/index.ts"]) lacks(file, ["localStorage.setItem", "sessionStorage.setItem", "localStorage.getItem", "sessionStorage.getItem"]);
lacks("apps/admin/src/routes/OAuthPage.tsx", ['value={String(values[prefix+"client_secret"]', 'value="********"']);

console.log("P15 Auth/Account contract verified: localized account flows, Turnstile, remember-session, cookie/CSRF sessions, TOTP backup codes, session revocation, connected accounts and write-only external sign-in credentials.");
