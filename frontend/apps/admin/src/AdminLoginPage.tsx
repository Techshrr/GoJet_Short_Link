import { useState, type FormEvent } from "react";
import { ApiError } from "@gojet/api-client";
import { api, setAdminCsrfToken } from "@gojet/auth";
import { Button, Field, Input } from "@gojet/ui";
import { LocaleSwitch, LocalizedSurface, localizedError, useLocale } from "@gojet/ui/locale";

type LoginResponse = { administrator: { display_name: string; email: string }; csrfToken?: string; two_factor_required?: boolean };

export function AdminLoginPage({ onSuccess }: { onSuccess: () => void }) {
  const { locale, text } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      const response = await api.post<LoginResponse>("/api/admin/auth/login", { email, password, code });
      setAdminCsrfToken(response.csrfToken);
      onSuccess();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 428) {
        setNeedsCode(true);
        setError(text("Enter the six-digit code from your authenticator and submit again.", "请输入验证器中的 6 位验证码，然后再次登录。"));
      } else if (cause instanceof ApiError) {
        setError(localizedError(cause.message, locale, cause.status));
      } else {
        setError(localizedError(cause instanceof Error ? cause.message : undefined, locale));
      }
    } finally { setSubmitting(false); }
  }

  return <LocalizedSurface><main className="admin-login-page"><section className="admin-login-brand"><a href="/" className="gj-brand-wordmark" aria-label="GoJet">GoJet<span>.</span></a><LocaleSwitch /></section><section className="admin-login-card"><div><span className="admin-login-kicker">{text("GoJet Administration", "GoJet 管理后台")}</span><h1>{text("Administrator sign in", "管理员登录")}</h1><p>{text("Use an administrator account created for the GoJet management area. A successful sign-in creates a protected administrator session in this browser; normal workspace accounts do not grant access to the management area.", "请使用为 GoJet 管理后台创建的管理员账号登录。登录成功后，浏览器会建立独立且受保护的管理员会话；普通工作区账号不会自动获得后台管理权限。")}</p></div><form onSubmit={submit} className="admin-login-form"><Field label={text("Administrator email", "管理员邮箱")} htmlFor="admin-email" required><Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field><Field label={text("Password", "密码")} htmlFor="admin-password" required><Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>{needsCode ? <Field label={text("Authenticator code", "验证器验证码")} htmlFor="admin-code" help={text("Enter the current six-digit code from the authenticator linked to this administrator account.", "输入此管理员账号绑定的验证器当前显示的 6 位验证码。") } required><Input id="admin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></Field> : null}{error ? <div className="gj-error" role="alert">{error}</div> : null}<Button type="submit" size="lg" loading={submitting}>{text("Sign in to administration", "登录管理后台")}</Button></form></section></main></LocalizedSurface>;
}
