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
  "Confirm password",
  "Keep me signed in on this device for 30 days",
  "remember_session",
  "turnstile_token",
  "localizedError",
  "Terms of Service",
  "Privacy Policy",
  "Acceptable Use Policy",
  'href="/legal/terms/"',
  'href="/legal/privacy/"',
  'href="/legal/acceptable-use/"'
]);

has("apps/site/src/TurnstileField.tsx", [
  "/api/public/turnstile",
  "challenges.cloudflare.com/turnstile",
  "data-turnstile-surface"
]);
has("packages/ui/src/locale.tsx", ["localizedError", "gojet_locale", '"zh-CN"', '"en"']);

has("../services/platformapi/cmd/server/identity.go", [
  "TurnstileToken",
  "enforceTurnstile(w, r, \"registration\"",
  "enforceTurnstile(w,r,\"login\"",
  "enforceTurnstile(w,r,\"forgot_password\"",
  "enforceTurnstile(w,r,\"reset_password\""
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
  "Authenticator app",
  "backup codes",
  "Revoke all other sessions",
  "Connected Accounts",
  "/api/me/social-identities"
]);

matches("apps/admin/src/router.tsx", [/path\s*:\s*"\/oauth"/]);
has("apps/admin/src/routes/OAuthPage.tsx", [
  "data-p15-admin-oauth",
  "Write-only secret",
  "/api/admin/auth/providers",
  "/api/admin/settings/socialauth"
]);

has("packages/auth/src/index.ts", ["gojet_csrf", "cookieCsrf", "getCsrfToken"]);
has("packages/api-client/src/index.ts", ['credentials: "include"', "X-CSRF-Token"]);
has("../services/platformapi/cmd/server/accountsecurity.go", [
  "gojet_session",
  "HttpOnly:true",
  "validCookieCSRF",
  "verifyTOTP",
  "user_backup_codes",
  "/api/me/sessions"
]);
has("../services/platformapi/cmd/server/p15social.go", [
  "p15SocialAuthHandoff",
  "userMFAEnabled",
  "setUserSessionCookies",
  "p15SocialRegistrationComplete"
]);
has("../database/migrations/useraccountsecurity.sql", [
  "CREATE TABLE user_mfa",
  "CREATE TABLE user_backup_codes",
  "CREATE TABLE user_mfa_challenges"
]);

for (const file of [
  "apps/site/src/routes/AuthPage.tsx",
  "apps/workspace/src/routes/SettingsPage.tsx",
  "apps/admin/src/routes/OAuthPage.tsx",
  "packages/auth/src/index.ts"
]) lacks(file, ["localStorage.setItem", "sessionStorage.setItem", "localStorage.getItem", "sessionStorage.getItem"]);
lacks("apps/admin/src/routes/OAuthPage.tsx", ['value={String(values[prefix+"client_secret"]', 'value="********"']);

console.log("P15 Auth/Account contract verified: bilingual sign-in/register/recovery/legal links, locale-safe API errors, Turnstile, remember-session, OAuth handoff, cookie+CSRF sessions, TOTP/backup codes, session revocation, connected accounts and write-only OAuth secrets.");
