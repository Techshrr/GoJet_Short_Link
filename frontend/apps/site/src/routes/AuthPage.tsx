import { type FormEvent, useEffect, useState } from "react";
import { AuthShell } from "@gojet/ui/shells";
import { localized, useLocale, type GoJetLocale } from "@gojet/ui/locale";
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

const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) => request<T>(path, "POST", body),
};

function errText(error: unknown, locale: GoJetLocale) {
  if (!(error instanceof Error)) return locale === "zh-CN" ? "发生了未预期的错误，请稍后重试。" : "An unexpected error occurred. Please try again.";
  return localized(error.message, locale);
}

function providerStart(provider: Provider, mode: Mode) {
  const params = new URLSearchParams({ redirect: "/app" });
  if (mode === "register") params.set("flow", "register");
  if (provider.id === "rainbow" && provider.login_types?.[0]) params.set("type", provider.login_types[0].id);
  return `/api/public/auth/${encodeURIComponent(provider.id)}/start?${params.toString()}`;
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const { locale, text } = useLocale();
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
    if (socialError) {
      setError(locale === "zh-CN" ? `第三方登录失败（${socialError}），请重新尝试或改用邮箱登录。` : `Third-party sign-in failed (${socialError}). Try again or sign in with email.`);
      history.replaceState(null, "", location.pathname + location.search);
    }
    const handoff = mode === "login" ? fragment.get("social_handoff") : null;
    if (handoff) {
      history.replaceState(null, "", location.pathname + location.search);
      setBusy(true);
      api.post<AuthResult>("/api/public/auth/handoff", { code: handoff }).then((result) => {
        if (!active) return;
        if (result.two_factor_required && result.challenge) {
          setChallenge(result.challenge);
          setPostAuthRedirect(result.redirect || "/app");
          setSuccess(locale === "zh-CN" ? "第三方账号验证成功。请输入双因素验证码继续登录。" : "Your third-party account was verified. Enter your two-step verification code to continue.");
        } else location.assign(result.redirect || "/app");
      }).catch((ex) => active && setError(errText(ex, locale))).finally(() => active && setBusy(false));
    }
    const registration = mode === "register" ? fragment.get("social_registration") : null;
    if (registration) {
      history.replaceState(null, "", location.pathname + location.search);
      setBusy(true);
      api.get<SocialInfo>(`/api/public/auth/social-registration?code=${encodeURIComponent(registration)}`).then((info) => {
        if (!active) return;
        setSocialRegistration({ code: registration, provider: info.provider, label: info.provider_label });
        if (info.suggested_display_name) setName(info.suggested_display_name);
        if (info.provider_email) setEmail(info.provider_email);
        setSuccess(locale === "zh-CN" ? `${info.provider_label} 身份验证成功。请确认邮箱并完成 GoJet 账号创建。` : `${info.provider_label} was verified. Confirm your email to finish creating your GoJet account.`);
      }).catch((ex) => active && setError(errText(ex, locale))).finally(() => active && setBusy(false));
    }
    return () => { active = false; };
  }, [mode, locale]);

  const title = {
    login: text("Sign in to GoJet", "登录 GoJet"),
    register: text("Create your GoJet account", "创建 GoJet 账号"),
    verify: text("Verify your email", "验证邮箱"),
    forgot: text("Reset your password", "找回密码"),
    reset: text("Choose a new password", "设置新密码"),
  }[mode];
  const turnstileSurface = mode === "login" ? "login" : mode === "register" ? "registration" : mode === "forgot" ? "forgot_password" : mode === "reset" ? "reset_password" : "";

  const sendRegistrationCode = async () => {
    setError(""); setSuccess(""); setCodeBusy(true);
    try {
      await api.post("/api/public/email-code", { email, purpose: "register" });
      setSuccess(text("Verification code sent. It is valid for 10 minutes.", "验证码已发送，有效期为 10 分钟。"));
    } catch (ex) { setError(errText(ex, locale)); } finally { setCodeBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(""); setBusy(true);
    try {
      if (challenge) {
        await api.post("/api/auth/login/2fa", { challenge, code, remember_session: rememberSession });
        location.assign(postAuthRedirect);
        return;
      }
      if (mode === "login") {
        const result = await api.post<AuthResult>("/api/auth/login", { email, password, remember_session: rememberSession, turnstile_token: turnstileToken });
        if (result.two_factor_required && result.challenge) {
          setChallenge(result.challenge);
          setPostAuthRedirect("/app");
          return;
        }
        location.assign("/app");
        return;
      }
      if (mode === "register") {
        if (!terms) throw new Error(text("Please accept the Terms of Service and Privacy Policy.", "请先同意《服务条款》和《隐私政策》。"));
        if (password !== confirm) throw new Error(text("The two passwords do not match.", "两次输入的密码不一致。"));
        if (socialRegistration) {
          if (emailCode.trim().length !== 6) throw new Error(text("Enter the six-digit email verification code.", "请输入 6 位邮箱验证码。"));
          const result = await api.post<AuthResult>("/api/public/auth/social-registration/complete", { code: socialRegistration.code, display_name: name, email, email_code: emailCode, password });
          location.assign(result.redirect || "/app");
          return;
        }
        const result = await api.post<AuthResult>("/api/auth/register", { email, password, display_name: name, turnstile_token: turnstileToken });
        if (result.verification_required) {
          setSuccess(result.verification_queued === false
            ? text("Your account was created, but the verification email could not be sent right now. Sign in later to request another verification message.", "账号已创建，但验证邮件暂时无法发送。稍后可以从登录流程重新请求验证邮件。")
            : text("Your account was created. Open the verification message in your inbox before using protected account features.", "账号已创建。请打开邮箱中的验证邮件完成验证，然后再使用受保护的账号功能。"));
          return;
        }
        location.assign("/app");
        return;
      }
      if (mode === "verify") {
        await api.post("/api/auth/verifyemail", { token });
        setSuccess(text("Your email has been verified. You can sign in now.", "邮箱验证成功，现在可以登录。"));
        return;
      }
      if (mode === "forgot") {
        await api.post("/api/auth/forgotpassword", { email, turnstile_token: turnstileToken });
        setSuccess(text("If an account uses that email address, password-reset instructions will be sent to it.", "如果该邮箱对应有效账号，系统会向该邮箱发送密码重置说明。"));
        return;
      }
      if (mode === "reset") {
        if (password !== confirm) throw new Error(text("The two passwords do not match.", "两次输入的密码不一致。"));
        await api.post("/api/auth/resetpassword", { token, password, turnstile_token: turnstileToken });
        setSuccess(text("Your password has been reset and previous sessions have been signed out. Sign in again with the new password.", "密码已重置，之前的登录会话已经退出。请使用新密码重新登录。"));
      }
    } catch (ex) { setError(errText(ex, locale)); } finally { setBusy(false); }
  };

  const subtitle = challenge
    ? text("Enter the current code from your authenticator, or an unused backup code, to finish signing in.", "输入验证器当前显示的验证码，或输入一枚尚未使用的备用验证码，以完成登录。")
    : socialRegistration
      ? text(`Finish creating your account with ${socialRegistration.label}.`, `使用 ${socialRegistration.label} 完成账号创建。`)
      : mode === "login"
        ? text("Use your email and password, or choose one of the sign-in methods enabled for this site.", "使用邮箱和密码登录，也可以选择当前站点已经启用的其他登录方式。")
        : mode === "register"
          ? text("Create your account and personal workspace first. You can invite other people and create additional workspaces later when you need them.", "先创建账号和个人工作区。后续确有协作需要时，可以再邀请其他成员或创建新的工作区。")
          : mode === "forgot"
            ? text("Enter your email address. For account security, this page does not disclose whether an account exists for that address.", "输入邮箱地址。为保护账号安全，此页面不会透露该邮箱是否对应现有账号。")
            : text("Complete the verification information below to protect your account before continuing.", "完成下面的验证信息后再继续，以保护账号安全。" );

  return <AuthShell
    visualTitle={text("One account for the links, pages and files you manage in GoJet.", "一个账号，管理你在 GoJet 中的链接、页面和文件。")}
    visualBody={text(
      "After signing in, you can open your workspaces, create and update public content, connect your own domains, manage team access, and review visits and account activity from the same account.",
      "登录后可以进入自己的工作区，创建和更新公开内容，绑定自定义域名，管理团队成员权限，并在同一个账号中查看访问数据和操作记录。"
    )}
  >
    <form className="auth-card" data-p15-auth={mode} onSubmit={submit}>
      <div><h1>{challenge ? text("Two-step verification", "双因素验证") : title}</h1><p className="auth-subtitle">{subtitle}</p></div>
      {(mode === "login" || mode === "register") && !challenge && !socialRegistration && providers.length ? <>
        <div className="auth-providers">{providers.map((provider) => <button type="button" key={provider.id} onClick={() => location.assign(providerStart(provider, mode))}>{provider.label}</button>)}</div>
        <div className="auth-divider"><span>{text("or continue with email", "或使用邮箱继续")}</span></div>
      </> : null}
      {challenge ? <label>{text("Authenticator or backup code", "验证器或备用验证码")}<input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label> : <>
        {mode === "register" ? <label>{text("Display name", "显示名称")}<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label> : null}
        {mode === "login" || mode === "register" || mode === "forgot" ? <label>{text("Email", "邮箱")}<input id="shell-login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label> : null}
        {socialRegistration ? <div className="auth-code-row"><label>{text("Email verification code", "邮箱验证码")}<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} /></label><button type="button" disabled={codeBusy || !email.includes("@")} onClick={sendRegistrationCode}>{codeBusy ? text("Sending…", "发送中…") : text("Send code", "发送验证码")}</button></div> : null}
        {mode === "login" || mode === "register" || mode === "reset" ? <label>{mode === "reset" ? text("New password", "新密码") : text("Password", "密码")}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /><small>{text("Use at least 10 characters.", "至少输入 10 个字符。")}</small></label> : null}
        {mode === "register" || mode === "reset" ? <label>{text("Confirm password", "确认密码")}<input type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label> : null}
        {mode === "verify" || mode === "reset" ? <label>{mode === "verify" ? text("Verification token", "邮箱验证令牌") : text("Reset token", "密码重置令牌")}<input value={token} onChange={(event) => setToken(event.target.value)} required /></label> : null}
        {mode === "login" ? <label className="auth-check"><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /><span>{text("Keep me signed in on this device for 30 days", "在此设备上保持登录 30 天")}</span></label> : null}
        {mode === "register" ? <label className="auth-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>{text("I agree to the Terms of Service and Privacy Policy.", "我同意《服务条款》和《隐私政策》。")}</span></label> : null}
        {turnstileSurface && !socialRegistration ? <TurnstileField surface={turnstileSurface} onToken={setTurnstileToken} /> : null}
      </>}
      {error ? <div className="auth-alert is-error" role="alert">{error}</div> : null}
      {success ? <div className="auth-alert is-success" role="status">{success}</div> : null}
      <button className="auth-submit" disabled={busy}>{busy
        ? text("Working…", "处理中…")
        : challenge
          ? text("Verify and sign in", "验证并登录")
          : mode === "login"
            ? text("Sign in", "登录")
            : mode === "register"
              ? socialRegistration ? text("Verify email and create account", "验证邮箱并创建账号") : text("Create account", "创建账号")
              : mode === "verify"
                ? text("Verify email", "验证邮箱")
                : mode === "forgot"
                  ? text("Send reset instructions", "发送重置说明")
                  : text("Reset password", "重置密码")}</button>
      {!challenge ? <div className="auth-links">{mode === "login"
        ? <><a href="/forgot-password">{text("Forgot password?", "忘记密码？")}</a><a href="/register">{text("Create account", "创建账号")}</a></>
        : mode === "register"
          ? <a href="/login">{text("Already have an account?", "已有账号？")}</a>
          : <a href="/login">{text("Back to sign in", "返回登录")}</a>}</div> : null}
    </form>
  </AuthShell>;
}
