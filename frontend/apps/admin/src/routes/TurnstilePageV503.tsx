import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Button, Checkbox, ErrorState, Field, Input, Page, PageHeader, Spinner, Textarea } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";

type Settings = Record<string, unknown>;
const bool = (value: unknown) => value === true || value === "true" || value === 1;

export default function TurnstilePageV503() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "v503", "turnstile"], queryFn: () => api.get<Settings>("/api/admin/bot-protection") });
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [secret, setSecret] = useState("");
  const [failOpen, setFailOpen] = useState(false);
  const [hostnames, setHostnames] = useState("");
  const [contexts, setContexts] = useState<Record<string, boolean>>({});

  const contextDefinitions = [
    ["turnstile.registration", text("Registration", "注册")],
    ["turnstile.login", text("Sign in", "登录")],
    ["turnstile.forgot_password", text("Forgot password", "找回密码")],
    ["turnstile.reset_password", text("Reset password", "重置密码")],
    ["turnstile.ticket_create", text("Create support ticket", "创建工单")],
    ["turnstile.ticket_reply", text("Reply to support ticket", "回复工单")],
    ["turnstile.abuse_report", text("Abuse report", "滥用举报")],
  ] as const;

  useEffect(() => {
    if (!query.data) return;
    setEnabled(bool(query.data["turnstile.enabled"]));
    setSiteKey(String(query.data["turnstile.site_key"] ?? ""));
    setFailOpen(bool(query.data["turnstile.fail_open"]));
    const names = query.data["turnstile.allowed_hostnames"];
    setHostnames(Array.isArray(names) ? names.join("\n") : String(names ?? ""));
    setContexts(Object.fromEntries(contextDefinitions.map(([key]) => [key, bool(query.data?.[key])] as const)));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        "turnstile.enabled": enabled,
        "turnstile.site_key": siteKey.trim(),
        "turnstile.fail_open": failOpen,
        "turnstile.allowed_hostnames": hostnames,
        ...contexts,
      };
      if (secret.trim()) body["turnstile.secret"] = secret.trim();
      return api.put("/api/admin/bot-protection", body);
    },
    onSuccess: async () => { setSecret(""); await qc.invalidateQueries({ queryKey: ["admin", "v503", "turnstile"] }); },
  });
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");
  const secretConfigured = bool(query.data?.["turnstile.secret_configured"]);

  return <Page data-p17-admin="turnstile-v503">
    <PageHeader title="Turnstile" description={text("Configure Cloudflare Turnstile for public forms and account flows. The Secret Key is write-only and is never returned to the browser.", "配置 Cloudflare Turnstile，用于公开表单和账号流程的人机验证。Secret Key 只写不回显，不会返回到浏览器。")}/>
    {query.isPending ? <Spinner label={text("Loading Turnstile settings", "正在读取 Turnstile 设置")} /> : query.isError ? <ErrorState title={text("Unable to load Turnstile settings", "无法读取 Turnstile 设置")} description={query.error instanceof Error ? query.error.message : fallback} /> : <>
      <section className="p17-action-card">
        <h2>{text("Cloudflare credentials", "Cloudflare 密钥")}</h2>
        <Checkbox label={text("Enable Turnstile", "启用 Turnstile")} checked={enabled} onCheckedChange={setEnabled} />
        <div className="p17-form-grid">
          <Field label="Site Key" htmlFor="turnstile-site-key"><Input id="turnstile-site-key" value={siteKey} onChange={(event) => setSiteKey(event.target.value)} /></Field>
          <Field label="Secret Key" htmlFor="turnstile-secret" help={secretConfigured ? text("A Secret Key is already configured. Leave this field blank to keep it unchanged.", "已有 Secret Key。此处留空即可保持原密钥不变。") : text("Enter the Secret Key from Cloudflare Turnstile.", "填写 Cloudflare Turnstile 提供的 Secret Key。")}><Input id="turnstile-secret" type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={secretConfigured ? text("Configured — leave blank to preserve", "已配置 — 留空保持不变") : ""} /></Field>
        </div>
        <Field label={text("Allowed hostnames", "允许使用的域名")} htmlFor="turnstile-hostnames" help={text("One hostname per line, for example gojet.cc and www.gojet.cc.", "每行填写一个域名，例如 gojet.cc 和 www.gojet.cc。") }><Textarea id="turnstile-hostnames" rows={4} value={hostnames} onChange={(event) => setHostnames(event.target.value)} /></Field>
        <Checkbox label={text("Allow the request when Turnstile itself is unavailable", "Turnstile 服务异常时允许请求继续")} checked={failOpen} onCheckedChange={setFailOpen} />
      </section>

      <section className="p17-action-card">
        <h2>{text("Protected flows", "启用验证的场景")}</h2>
        <p>{text("Choose exactly which public flows require a Turnstile challenge.", "选择哪些公开流程需要进行 Turnstile 人机验证。")}</p>
        <div className="p17-form-grid">{contextDefinitions.map(([key, label]) => <Checkbox key={key} label={label} checked={contexts[key] ?? false} onCheckedChange={(checked) => setContexts((current) => ({ ...current, [key]: checked }))} />)}</div>
      </section>

      {save.isError ? <Alert tone="danger" title={text("Turnstile settings were not saved", "Turnstile 设置保存失败")}>{save.error instanceof Error ? save.error.message : fallback}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Turnstile settings saved", "Turnstile 设置已保存")}>{text("Public forms will use the updated policy immediately.", "公开表单会立即使用最新的人机验证策略。")}</Alert> : null}
      <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>{text("Save Turnstile settings", "保存 Turnstile 设置")}</Button>
    </>}
  </Page>;
}
