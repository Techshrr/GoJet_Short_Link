import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, ErrorState, Field, Input, Page, PageHeader, Spinner, localizedError, useLocale, type GoJetLocale } from "@gojet/ui";
import "../oauth.css";

type Provider = { id: string; label: string; implemented: boolean; enabled: boolean; configured: boolean; visible: boolean; callback_url?: string; display_name?: string; login_types?: { id: string; label: string }[]; available_login_types?: { id: string; label: string }[] };
type Settings = { socialauth?: Record<string, unknown> };
type Draft = { enabled: boolean; clientId: string; secret: string; baseUrl: string; displayName: string; loginTypes: string };
type Copy = (en: string, zh: string) => string;
function errorStatus(error: unknown): number | undefined { if (!error || typeof error !== "object" || !("status" in error)) return undefined; const value = (error as { status?: unknown }).status; return typeof value === "number" ? value : undefined; }
const errText = (error: unknown, locale: GoJetLocale) => localizedError(error instanceof Error ? error.message : undefined, locale, errorStatus(error));

export default function OAuthPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const qc = useQueryClient();
  const providers = useQuery({ queryKey: ["p15-oauth-providers"], queryFn: () => api.get<{ providers: Provider[] }>("/api/admin/auth/providers") });
  const settings = useQuery({ queryKey: ["p15-settings-center"], queryFn: () => api.get<Settings>("/api/admin/settings") });
  const [saved, setSaved] = useState("");
  const values = settings.data?.socialauth ?? {};
  const save = useMutation({ mutationFn: ({ provider, draft }: { provider: Provider; draft: Draft }) => { const prefix = `auth.social.${provider.id}.`; const body: Record<string, unknown> = { [prefix + "enabled"]: draft.enabled, [prefix + "client_id"]: draft.clientId }; if (draft.secret.trim()) body[prefix + "client_secret"] = draft.secret; if (provider.id === "rainbow") { body[prefix + "base_url"] = draft.baseUrl; body[prefix + "display_name"] = draft.displayName; body[prefix + "login_types"] = draft.loginTypes.split(",").map((value) => value.trim()).filter(Boolean); } return api.put("/api/admin/settings/socialauth", body); }, onSuccess: async (_, variables) => { setSaved(variables.provider.id); await Promise.all([qc.invalidateQueries({ queryKey: ["p15-oauth-providers"] }), qc.invalidateQueries({ queryKey: ["p15-settings-center"] })]); } });
  return <Page className="oauth-page" data-p15-admin-oauth><PageHeader title={c("External sign-in", "第三方登录")} description={c("Configure the providers users may choose on the sign-in page. Client secrets are write-only: existing secrets are never returned to the browser.", "配置用户可在登录页面选择的第三方登录服务。客户端密钥只写不回显，已保存的密钥不会返回到浏览器。")}/>{providers.isPending || settings.isPending ? <Spinner label={c("Loading sign-in providers", "正在加载登录服务")} /> : providers.isError || settings.isError ? <ErrorState title={c("Unable to load sign-in settings", "无法加载第三方登录设置")} description={errText(providers.error || settings.error, locale)}/> : <div className="oauth-grid">{providers.data?.providers.map((provider) => <ProviderCard key={provider.id} provider={provider} values={values} saving={save.isPending && save.variables?.provider.id === provider.id} saved={saved === provider.id} error={save.isError && save.variables?.provider.id === provider.id ? errText(save.error, locale) : ""} onSave={(draft) => save.mutate({ provider, draft })} c={c}/>)}</div>}</Page>;
}

function ProviderCard({ provider, values, saving, saved, error, onSave, c }: { provider: Provider; values: Record<string, unknown>; saving: boolean; saved: boolean; error: string; onSave: (draft: Draft) => void; c: Copy }) {
  const prefix = `auth.social.${provider.id}.`;
  const initial = useMemo<Draft>(() => ({ enabled: Boolean(values[prefix + "enabled"] ?? provider.enabled), clientId: String(values[prefix + "client_id"] ?? ""), secret: "", baseUrl: String(values[prefix + "base_url"] ?? ""), displayName: String(values[prefix + "display_name"] ?? provider.display_name ?? ""), loginTypes: Array.isArray(values[prefix + "login_types"]) ? (values[prefix + "login_types"] as unknown[]).join(", ") : (provider.login_types ?? []).map((value) => value.id).join(", ") }), [provider, values, prefix]);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const availability = !provider.implemented ? c("Unavailable", "暂不可用") : provider.visible ? c("Available to users", "用户可使用") : provider.enabled ? c("Configuration incomplete", "配置未完成") : c("Disabled", "已停用");
  return <section className="oauth-card"><header><div><h2>{provider.label}</h2><span>{provider.id}</span></div><div className="oauth-badges"><Badge tone={provider.implemented ? "success" : "neutral"}>{provider.implemented ? c("Supported", "已支持") : c("Unavailable", "暂不可用")}</Badge><Badge tone={provider.visible ? "success" : provider.enabled ? "warning" : "neutral"}>{availability}</Badge></div></header>
    {provider.callback_url ? <div className="oauth-callback"><span>{c("Callback address", "回调地址")}</span><code>{provider.callback_url}</code></div> : null}<label className="oauth-toggle"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}/><span>{c("Enable this sign-in provider", "启用这个登录服务")}</span></label>
    <Field label={provider.id === "rainbow" ? c("APPID / Client ID", "APPID / 客户端 ID") : c("Client ID", "客户端 ID")} htmlFor={`${provider.id}-client-id`}><Input id={`${provider.id}-client-id`} value={draft.clientId} onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}/></Field>
    <Field label={provider.id === "rainbow" ? c("APPKEY / Client Secret", "APPKEY / 客户端密钥") : c("Client Secret", "客户端密钥")} htmlFor={`${provider.id}-secret`} help={provider.configured ? c("A secret is already configured. Leave this field blank to keep it unchanged.", "已有密钥。此处留空即可保持原密钥不变。") : c("No complete provider credentials are configured yet.", "当前尚未配置完整的登录服务凭据。") }><Input id={`${provider.id}-secret`} type="password" autoComplete="new-password" value={draft.secret} placeholder={c("Enter a new secret only when changing it", "仅在需要修改时填写新密钥")} onChange={(event) => setDraft({ ...draft, secret: event.target.value })}/></Field>
    {provider.id === "rainbow" ? <><Field label={c("Service base address", "服务基础地址")} htmlFor="rainbow-base"><Input id="rainbow-base" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}/></Field><Field label={c("Display name", "显示名称")} htmlFor="rainbow-name"><Input id="rainbow-name" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}/></Field><Field label={c("Enabled login types", "启用的登录类型")} htmlFor="rainbow-types" help={c("Enter provider-supported type IDs separated by commas.", "填写服务商支持的登录类型 ID，多个值用英文逗号分隔。") }><Input id="rainbow-types" value={draft.loginTypes} onChange={(event) => setDraft({ ...draft, loginTypes: event.target.value })}/></Field></> : null}
    {error ? <Alert tone="danger" title={c("Provider settings were not saved", "登录服务保存失败")}>{error}</Alert> : saved ? <Alert tone="info" title={c("Provider settings saved", "登录服务已保存")}>{c("The latest configuration has been reloaded. Existing stored secrets remain hidden.", "最新配置已重新加载，已保存的密钥仍保持隐藏。")}</Alert> : null}<Button type="button" disabled={!provider.implemented} loading={saving} onClick={() => onSave(draft)}>{c(`Save ${provider.label}`, `保存 ${provider.label}`)}</Button>
  </section>;
}
