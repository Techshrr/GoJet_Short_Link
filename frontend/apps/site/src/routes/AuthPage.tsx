import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AuthShell } from "@gojet/ui/shells";
import TurnstileField from "../TurnstileField";
import "../auth.css";

type Mode = "login" | "register" | "verify" | "forgot" | "reset";
type LoginType = { id: string; label: string };
type Provider = { id: string; label: string; login_types?: LoginType[] };
type AuthResult = {
  two_factor_required?: boolean;
  challenge?: string;
  verification_required?: boolean;
  verification_queued?: boolean;
  redirect?: string;
};
type SocialRegistration = { code: string; provider: string; label: string };
type SocialInfo = {
  provider: string;
  provider_label: string;
  suggested_display_name?: string;
  provider_email?: string;
  password_min_length: number;
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new Error((data as { error?: string } | undefined)?.error ?? `Request failed (${res.status})`);
  return data as T;
}
const api = { get: <T,>(path: string) => request<T>(path), post: <T,>(path: string, body?: unknown) => request<T>(path, "POST", body) };
const errText = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");
function providerStart(provider: Provider, mode: Mode) {
  const params = new URLSearchParams({ redirect: "/app" });
  if (mode === "register") params.set("flow", "register");
  if (provider.id === "rainbow" && provider.login_types?.[0]) params.set("type", provider.login_types[0].id);
  return `/api/public/auth/${encodeURIComponent(provider.id)}/start?${params.toString()}`;
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [token, setToken] = useState(() => new URLSearchParams(location.search).get("token") ?? "");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [socialRegistration, setSocialRegistration] = useState<SocialRegistration | null>(null);
  const [postAuthRedirect, setPostAuthRedirect] = useState("/app");
  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    if (mode === "login" || mode === "register") {
      api.get<{ providers: Provider[] }>("/api/public/auth/providers").then((value) => active && setProviders(value.providers ?? [])).catch(() => active && setProviders([]));
    }
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
    const socialError = fragment.get("social_error");
    if (socialError) { setError(`OAuth sign-in failed (${socialError}).`); history.replaceState(null, "", location.pathname + location.search); }
    const handoff = mode === "login" ? fragment.get("social_handoff") : null;
    if (handoff) {
      history.replaceState(null, "", location.pathname + location.search); setBusy(true);
      api.post<AuthResult>("/api/public/auth/handoff", { code: handoff }).then((result) => {
        if (!active) return;
        if (result.two_factor_required && result.challenge) { setChallenge(result.challenge); setPostAuthRedirect(result.redirect || "/app"); setSuccess("Primary provider verified. Complete two-step verification."); }
        else location.assign(result.redirect || "/app");
      }).catch((ex) => active && setError(errText(ex))).finally(() => active && setBusy(false));
    }
    const registration = mode === "register" ? fragment.get("social_registration") : null;
    if (registration) {
      history.replaceState(null, "", location.pathname + location.search); setBusy(true);
      api.get<SocialInfo>(`/api/public/auth/social-registration?code=${encodeURIComponent(registration)}`).then((info) => {
        if (!active) return;
        setSocialRegistration({ code: registration, provider: info.provider, label: info.provider_label });
        if (info.suggested_display_name) setName(info.suggested_display_name);
        if (info.provider_email) setEmail(info.provider_email);
        setSuccess(`${info.provider_label} identity verified. Confirm your email to finish creating the GoJet account.`);
      }).catch((ex) => active && setError(errText(ex))).finally(() => active && setBusy(false));
    }
    return () => { active = false; };
  }, [mode]);

  const title = useMemo(() => ({ login: "Sign in to GoJet", register: "Create your GoJet account", verify: "Verify your email", forgot: "Reset your password", reset: "Choose a new password" })[mode], [mode]);
  const turnstileSurface = mode === "login" ? "login" : mode === "register" ? "registration" : mode === "forgot" ? "forgot_password" : mode === "reset" ? "reset_password" : "";

  const sendRegistrationCode = async () => {
    setError(""); setSuccess(""); setCodeBusy(true);
    try { await api.post("/api/public/email-code", { email, purpose: "register" }); setSuccess("Verification code sent. It expires in 10 minutes."); }
    catch (ex) { setError(errText(ex)); } finally { setCodeBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(""); setBusy(true);
    try {
      if (challenge) { await api.post("/api/auth/login/2fa", { challenge, code, remember_session: rememberSession }); location.assign(postAuthRedirect); return; }
      if (mode === "login") {
        const result = await api.post<AuthResult>("/api/auth/login", { email, password, remember_session: rememberSession, turnstile_token: turnstileToken });
        if (result.two_factor_required && result.challenge) { setChallenge(result.challenge); setPostAuthRedirect("/app"); return; }
        location.assign("/app"); return;
      }
      if (mode === "register") {
        if (!terms) throw new Error("Please accept the Terms and Privacy Policy.");
        if (password !== confirm) throw new Error("Passwords do not match.");
        if (socialRegistration) {
          if (emailCode.trim().length !== 6) throw new Error("Enter the six-digit email verification code.");
          const result = await api.post<AuthResult>("/api/public/auth/social-registration/complete", { code: socialRegistration.code, display_name: name, email, email_code: emailCode, password });
          location.assign(result.redirect || "/app"); return;
        }
        const result = await api.post<AuthResult>("/api/auth/register", { email, password, display_name: name, turnstile_token: turnstileToken });
        if (result.verification_required) {
          setSuccess(result.verification_queued === false ? "Account created. Verification mail is temporarily unavailable; retry from sign in later." : "Account created. Check your inbox to verify your email."); return;
        }
        location.assign("/app"); return;
      }
      if (mode === "verify") { await api.post("/api/auth/verifyemail", { token }); setSuccess("Email verified. You can sign in now."); return; }
      if (mode === "forgot") { await api.post("/api/auth/forgotpassword", { email, turnstile_token: turnstileToken }); setSuccess("If that account exists, a reset link has been queued."); return; }
      if (mode === "reset") {
        if (password !== confirm) throw new Error("Passwords do not match.");
        await api.post("/api/auth/resetpassword", { token, password, turnstile_token: turnstileToken });
        setSuccess("Password reset. All previous sessions were revoked; sign in with your new password.");
      }
    } catch (ex) { setError(errText(ex)); } finally { setBusy(false); }
  };

  const subtitle = challenge ? "Enter your authenticator code or an unused backup code." : socialRegistration ? `Finish registration with ${socialRegistration.label}.` : mode === "login" ? "Use your account credentials or an enabled provider." : mode === "register" ? "Start with a personal workspace. You can add a team later." : mode === "forgot" ? "We never reveal whether an email address exists." : "Complete the account security step below.";

  return <AuthShell visualTitle="One secure account for every GoJet workspace." visualBody="Short links, domains, QR, files and analytics stay behind one server-side session boundary.">
    <form className="auth-card" data-p15-auth={mode} onSubmit={submit}>
      <div><h1>{challenge ? "Two-step verification" : title}</h1><p className="auth-subtitle">{subtitle}</p></div>
      {(mode === "login" || mode === "register") && !challenge && !socialRegistration && providers.length ? <><div className="auth-providers">{providers.map((provider) => <button type="button" key={provider.id} onClick={() => location.assign(providerStart(provider, mode))}>{provider.label}</button>)}</div><div className="auth-divider"><span>or continue with email</span></div></> : null}
      {challenge ? <label>Authenticator or backup code<input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label> : <>
        {mode === "register" ? <label>Display name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label> : null}
        {mode === "login" || mode === "register" || mode === "forgot" ? <label>Email<input id="shell-login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label> : null}
        {socialRegistration ? <div className="auth-code-row"><label>Email verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} /></label><button type="button" disabled={codeBusy || !email.includes("@")} onClick={sendRegistrationCode}>{codeBusy ? "Sending…" : "Send code"}</button></div> : null}
        {mode === "login" || mode === "register" || mode === "reset" ? <label>{mode === "reset" ? "New password" : "Password"}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /><small>At least 10 characters.</small></label> : null}
        {mode === "register" || mode === "reset" ? <label>Confirm password<input type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label> : null}
        {mode === "verify" || mode === "reset" ? <label>{mode === "verify" ? "Verification token" : "Reset token"}<input value={token} onChange={(event) => setToken(event.target.value)} required /></label> : null}
        {mode === "login" ? <label className="auth-check"><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /><span>Remember this session for 30 days</span></label> : null}
        {mode === "register" ? <label className="auth-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>I agree to the Terms and Privacy Policy.</span></label> : null}
        {turnstileSurface && !socialRegistration ? <TurnstileField surface={turnstileSurface} onToken={setTurnstileToken} /> : null}
      </>}
      {error ? <div className="auth-alert is-error" role="alert">{error}</div> : null}{success ? <div className="auth-alert is-success" role="status">{success}</div> : null}
      <button className="auth-submit" disabled={busy}>{busy ? "Working…" : challenge ? "Verify and sign in" : mode === "login" ? "Sign in" : mode === "register" ? socialRegistration ? "Verify email and create account" : "Create account" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Send reset link" : "Reset password"}</button>
      {!challenge ? <div className="auth-links">{mode === "login" ? <><a href="/forgot-password">Forgot password?</a><a href="/register">Create account</a></> : mode === "register" ? <a href="/login">Already have an account?</a> : <a href="/login">Back to sign in</a>}</div> : null}
    </form>
  </AuthShell>;
}
