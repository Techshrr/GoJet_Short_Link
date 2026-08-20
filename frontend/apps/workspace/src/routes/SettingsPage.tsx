import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, clearClientSessionState } from "@gojet/auth";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";
import "../settings.css";

type Me = { id: number; email: string; display_name: string; email_verified: boolean };
type Security = { totp_enabled: boolean; backup_codes_remaining: number };
type Session = { id: string; ip_address: string; user_agent: string; last_active_at: string; expires_at: string; created_at: string; current: boolean };
type SocialIdentity = { provider: string; label: string; provider_email?: string; display_name?: string; created_at: string; last_login_at?: string };
type SocialProvider = { id: string; label: string; configured: boolean; linked: boolean; login_types?: { id: string; label: string }[] };
type SocialState = { password_login_enabled: boolean; identities: SocialIdentity[]; providers: SocialProvider[] };

const errorText = (e: unknown, fallback: string) => e instanceof Error ? e.message : fallback;
const date = (v?: string) => v ? new Date(v).toLocaleString() : "—";
const section = () => location.pathname.includes("/security") ? "security" : location.pathname.includes("/sessions") ? "sessions" : location.pathname.includes("/connected-accounts") ? "connected" : "profile";

export default function SettingsPage() {
  const { text } = useLocale();
  const active = section();
  const nav = [
    [text("Profile", "个人资料"), "/app/settings", "profile"],
    [text("Security", "安全"), "/app/settings/security", "security"],
    [text("Sessions", "登录会话"), "/app/settings/sessions", "sessions"],
    [text("Connected accounts", "关联账号"), "/app/settings/connected-accounts", "connected"],
  ] as const;
  return <Page className="settings-page" data-p15-settings={active}>
    <PageHeader title={text("Settings", "设置")} description={text("Manage your account identity, sign-in security, active sessions and connected login methods.", "管理账号资料、登录安全、当前会话和已关联的第三方登录方式。")} />
    <nav className="settings-nav" aria-label={text("Settings sections", "设置分类")}>{nav.map(([label, href, key]) => <a key={key} className={active === key ? "is-active" : ""} href={href}>{label}</a>)}</nav>
    {active === "profile" ? <Profile /> : active === "security" ? <SecurityPanel /> : active === "sessions" ? <SessionsPanel /> : <ConnectedPanel />}
  </Page>;
}

function Profile() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["p15-me"], queryFn: () => api.get<Me>("/api/me") });
  const [name, setName] = useState("");
  useEffect(() => { if (me.data) setName(me.data.display_name); }, [me.data]);
  const save = useMutation({ mutationFn: () => api.patch<Me>("/api/me", { display_name: name.trim() }), onSuccess: () => qc.invalidateQueries({ queryKey: ["p15-me"] }) });
  const verify = useMutation({ mutationFn: () => api.post<{ queued: boolean }>("/api/mail/verification", {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["p15-me"] }) });
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");

  return <section className="settings-card">
    <div className="settings-card-head"><div><h2>{text("Profile", "个人资料")}</h2><p>{text("Your primary account identity.", "这里显示你的主要账号资料。")}</p></div>{me.data ? <Badge tone={me.data.email_verified ? "success" : "warning"}>{me.data.email_verified ? text("Email verified", "邮箱已验证") : text("Email verification required", "邮箱待验证")}</Badge> : null}</div>
    {me.isPending ? <Spinner label={text("Loading profile", "正在加载个人资料")} /> : me.isError ? <ErrorState title={text("Unable to load profile", "无法加载个人资料")} description={errorText(me.error, fallback)} /> : me.data ? <form className="settings-form" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
      <Field label={text("Display name", "显示名称")} htmlFor="profile-name"><Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={text("Email", "邮箱")} htmlFor="profile-email"><Input id="profile-email" value={me.data.email} disabled /></Field>
      {!me.data.email_verified ? <div className="settings-verification-action"><p>{text("Verify this address before relying on email-based security and account recovery.", "请先验证此邮箱，以便正常使用邮件安全通知和账号找回。")}</p><Button type="button" variant="outline" loading={verify.isPending} onClick={() => verify.mutate()}>{text("Send verification email", "发送验证邮件")}</Button></div> : null}
      {verify.isSuccess ? <Alert tone="info" title={text("Verification email queued", "验证邮件已发送")}>{text("Check your inbox and follow the verification link.", "请检查邮箱并打开验证链接完成验证。")}</Alert> : null}
      {verify.isError ? <Alert tone="danger" title={text("Unable to send verification email", "验证邮件发送失败")}>{errorText(verify.error, fallback)}</Alert> : null}
      {save.isError ? <Alert tone="danger" title={text("Profile update failed", "个人资料保存失败")}>{errorText(save.error, fallback)}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Profile updated", "个人资料已保存")}>{text("Your display name has been updated.", "显示名称已更新。")}</Alert> : null}
      <Button type="submit" loading={save.isPending}>{text("Save profile", "保存个人资料")}</Button>
    </form> : null}
  </section>;
}

function SecurityPanel() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const security = useQuery({ queryKey: ["p15-security"], queryFn: () => api.get<Security>("/api/me/security") });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");

  const password = useMutation({ mutationFn: () => { if (newPassword !== confirm) throw new Error(text("New passwords do not match.", "两次输入的新密码不一致。")); return api.post("/api/me/password", { current_password: currentPassword, new_password: newPassword }); }, onSuccess: () => { clearClientSessionState(); location.assign("/login"); } });
  const begin = useMutation({ mutationFn: () => api.post<{ secret: string; otpauth_uri: string }>("/api/me/totp/setup"), onSuccess: setSetup });
  const enable = useMutation({ mutationFn: () => api.post<{ backup_codes: string[] }>("/api/me/totp/enable", { code: mfaCode }), onSuccess: async (r) => { setBackupCodes(r.backup_codes); setSetup(null); setMfaCode(""); await qc.invalidateQueries({ queryKey: ["p15-security"] }); } });
  const regenerate = useMutation({ mutationFn: () => api.post<{ backup_codes: string[] }>("/api/me/totp/backup-codes", { code: mfaCode }), onSuccess: async (r) => { setBackupCodes(r.backup_codes); setMfaCode(""); await qc.invalidateQueries({ queryKey: ["p15-security"] }); } });
  const disable = useMutation({ mutationFn: () => api.request("/api/me/totp", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: mfaCode }) }), onSuccess: async () => { setMfaCode(""); setBackupCodes([]); await qc.invalidateQueries({ queryKey: ["p15-security"] }); } });

  return <div className="settings-stack">
    <section className="settings-card"><h2>{text("Password", "登录密码")}</h2><p>{text("Changing your password signs out every existing session, including this one.", "修改密码后，所有已登录会话（包括当前会话）都会退出。")}</p><form className="settings-form" onSubmit={(e: FormEvent) => { e.preventDefault(); password.mutate(); }}>
      <Field label={text("Current password", "当前密码")} htmlFor="current-password"><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
      <Field label={text("New password", "新密码")} htmlFor="new-password"><Input id="new-password" type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
      <Field label={text("Confirm new password", "确认新密码")} htmlFor="confirm-password"><Input id="confirm-password" type="password" minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      {password.isError ? <Alert tone="danger" title={text("Password change failed", "密码修改失败")}>{errorText(password.error, fallback)}</Alert> : null}
      <Button type="submit" loading={password.isPending}>{text("Change password", "修改密码")}</Button>
    </form></section>

    <section className="settings-card"><div className="settings-card-head"><div><h2>{text("Authenticator app", "身份验证器")}</h2><p>{text("Use a TOTP authenticator and one-time backup recovery codes.", "使用 TOTP 身份验证器和一次性备用恢复码保护账号。")}</p></div>{security.data ? <Badge tone={security.data.totp_enabled ? "success" : "neutral"}>{security.data.totp_enabled ? text("Enabled", "已启用") : text("Not enabled", "未启用")}</Badge> : null}</div>
      {security.isPending ? <Spinner label={text("Loading security status", "正在读取安全状态")} /> : security.isError ? <ErrorState title={text("Unable to load security status", "无法读取安全状态")} description={errorText(security.error, fallback)} /> : security.data ? <>
        {!security.data.totp_enabled && !setup ? <Button type="button" onClick={() => begin.mutate()} loading={begin.isPending}>{text("Set up authenticator", "设置身份验证器")}</Button> : null}
        {setup ? <div className="settings-mfa-setup"><Alert tone="warning" title={text("Save this secret in your authenticator", "请将此密钥保存到身份验证器")}>{text("The secret is shown only during setup. Enter a current six-digit code to enable two-step verification.", "此密钥只在设置过程中显示一次。输入当前 6 位验证码后，双重验证才会正式启用。")}</Alert><code>{setup.secret}</code><small>{setup.otpauth_uri}</small><Field label={text("Authenticator code", "身份验证器验证码")} htmlFor="mfa-enable-code"><Input id="mfa-enable-code" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} /></Field><Button type="button" onClick={() => enable.mutate()} loading={enable.isPending}>{text("Confirm and enable", "确认并启用")}</Button></div> : null}
        {security.data.totp_enabled ? <div className="settings-form"><p>{text(`${security.data.backup_codes_remaining} unused backup codes remain.`, `还剩 ${security.data.backup_codes_remaining} 个未使用的备用恢复码。`)}</p><Field label={text("Authenticator code", "身份验证器验证码")} htmlFor="mfa-manage-code"><Input id="mfa-manage-code" inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} /></Field><div className="settings-actions"><Button type="button" onClick={() => regenerate.mutate()} loading={regenerate.isPending}>{text("Regenerate backup codes", "重新生成备用恢复码")}</Button><Button type="button" variant="outline" onClick={() => disable.mutate()} loading={disable.isPending}>{text("Disable two-step verification", "关闭双重验证")}</Button></div></div> : null}
        {[begin, enable, regenerate, disable].some((m) => m.isError) ? <Alert tone="danger" title={text("Security action failed", "安全设置操作失败")}>{errorText(begin.error || enable.error || regenerate.error || disable.error, fallback)}</Alert> : null}
      </> : null}
      {backupCodes.length ? <div className="settings-backups"><Alert tone="warning" title={text("Copy these backup codes now", "请立即保存这些备用恢复码")}>{text("Each code can be used once. GoJet cannot display them again later.", "每个恢复码只能使用一次，之后 GoJet 无法再次显示这些明文恢复码。")}</Alert><div>{backupCodes.map((code) => <code key={code}>{code}</code>)}</div></div> : null}
    </section>
  </div>;
}

function SessionsPanel() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["p15-sessions"], queryFn: () => api.get<{ data: Session[] }>("/api/me/sessions") });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/api/me/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["p15-sessions"] }) });
  const others = useMutation({ mutationFn: () => api.delete("/api/me/sessions"), onSuccess: () => qc.invalidateQueries({ queryKey: ["p15-sessions"] }) });
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");
  return <section className="settings-card"><div className="settings-card-head"><div><h2>{text("Sessions", "登录会话")}</h2><p>{text("Review signed-in devices, IP addresses and recent activity.", "查看当前已登录设备、IP 地址和最近活动时间。")}</p></div><Button type="button" variant="outline" onClick={() => others.mutate()} loading={others.isPending}>{text("Sign out other sessions", "退出其他会话")}</Button></div>
    {query.isPending ? <Spinner label={text("Loading sessions", "正在加载会话")} /> : query.isError ? <ErrorState title={text("Unable to load sessions", "无法加载会话")} description={errorText(query.error, fallback)} /> : query.data?.data.length ? <div className="session-list">{query.data.data.map((s) => <article key={s.id} className="session-row"><div><strong>{s.current ? text("Current session", "当前会话") : text("Signed-in session", "已登录会话")}</strong><span>{s.user_agent || text("Unknown device", "未知设备")}</span><small>{s.ip_address || text("IP unavailable", "IP 不可用")} · {text("Last active", "最近活动")} {date(s.last_active_at)}</small></div><div>{s.current ? <Badge tone="success">{text("Current", "当前")}</Badge> : <Button type="button" variant="outline" onClick={() => revoke.mutate(s.id)}>{text("Sign out", "退出")}</Button>}</div></article>)}</div> : <EmptyState title={text("No active sessions", "没有活动会话")} description={text("No signed-in server sessions are currently active.", "当前没有其他有效登录会话。")}/>} 
  </section>;
}

function ConnectedPanel() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["p15-social"], queryFn: () => api.get<SocialState>("/api/me/social-identities") });
  const bind = useMutation({ mutationFn: (p: SocialProvider) => api.post<{ authorize_url: string }>(`/api/me/social/${p.id}/bind/start${p.id === "rainbow" && p.login_types?.[0] ? `?type=${encodeURIComponent(p.login_types[0].id)}` : ""}`), onSuccess: (r) => location.assign(r.authorize_url) });
  const unbind = useMutation({ mutationFn: (id: string) => api.delete(`/api/me/social/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["p15-social"] }) });
  const identities = useMemo(() => new Map((query.data?.identities ?? []).map((i) => [i.provider, i])), [query.data]);
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");
  return <section className="settings-card"><h2>{text("Connected accounts", "关联账号")}</h2><p>{text("Connect or remove third-party sign-in methods configured by the administrator.", "绑定或移除管理员已配置的第三方登录方式。")}</p>
    {query.isPending ? <Spinner label={text("Loading connected accounts", "正在加载关联账号")} /> : query.isError ? <ErrorState title={text("Unable to load connected accounts", "无法加载关联账号")} description={errorText(query.error, fallback)} /> : query.data ? <div className="connected-list">{query.data.providers.map((provider) => { const identity = identities.get(provider.id); return <article key={provider.id} className="connected-row"><div><strong>{provider.label}</strong><span>{identity ? identity.provider_email || identity.display_name || text("Connected", "已关联") : provider.configured ? text("Available to connect", "可以关联") : text("Not configured by administrator", "管理员尚未配置")}</span>{identity ? <small>{text("Connected", "关联时间")} {date(identity.created_at)}</small> : null}</div><div>{identity ? <Button type="button" variant="outline" onClick={() => unbind.mutate(provider.id)}>{text("Disconnect", "解除关联")}</Button> : <Button type="button" disabled={!provider.configured} onClick={() => bind.mutate(provider)}>{text("Connect", "关联")}</Button>}</div></article>; })}</div> : null}
    {bind.isError || unbind.isError ? <Alert tone="danger" title={text("Connected-account action failed", "关联账号操作失败")}>{errorText(bind.error || unbind.error, fallback)}</Alert> : null}
  </section>;
}
