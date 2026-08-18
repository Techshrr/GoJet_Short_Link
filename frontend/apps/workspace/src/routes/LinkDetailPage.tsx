import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ABDestination, LinkRecord, LinkStatus, LinkWriteInput, RoutingDimension, RoutingRule, UTMValues, WorkspaceSummary } from "@gojet/api-client";
import { validateLinkRouting } from "@gojet/api-client";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Page, Select, SettingsSection, Spinner, Tabs, Textarea } from "@gojet/ui";
import { AlertDialog, DropdownMenu } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

function useDetailWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function currentLinkId(): number | undefined {
  const match = window.location.pathname.match(/\/app\/links\/(\d+)\/?$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function editable(link: LinkRecord): LinkWriteInput {
  const output: LinkWriteInput = {
    destination: link.destination,
    title: link.title,
    status: link.status,
    redirect_status: link.redirect_status,
    one_time: link.one_time,
    utm: link.utm ?? {},
    routing_rules: link.routing_rules ?? [],
    ab_destinations: link.ab_destinations ?? []
  };
  if (link.expires_at) output.expires_at = link.expires_at;
  else output.expires_at = null;
  if (link.max_clicks) output.max_clicks = link.max_clicks;
  else output.max_clicks = null;
  if (link.folder_id) output.folder_id = link.folder_id;
  else output.folder_id = null;
  if (link.campaign_id) output.campaign_id = link.campaign_id;
  else output.campaign_id = null;
  if (link.tag_ids?.length) output.tag_ids = link.tag_ids;
  return output;
}

function StatusBadge({ status }: { status: LinkStatus }) {
  return <Badge tone={status === "active" ? "success" : status === "paused" ? "warning" : "neutral"}>{status}</Badge>;
}

function Reason({ value, onChange, id = "change-reason" }: { value: string; onChange: (value: string) => void; id?: string }) {
  return <Field label="Change reason" htmlFor={id} required help="后端会把原因与完整变更快照写入 History。"><Input id={id} value={value} maxLength={255} onChange={(event) => onChange(event.target.value)} placeholder="例如：更新投放目标" required /></Field>;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return <div className="link-summary-card"><span>{label}</span><strong>{value}</strong></div>;
}

function AnalyticsPanel({ workspaceId, linkId, canAnalytics }: { workspaceId: number; linkId: number; canAnalytics: boolean }) {
  const analytics = useQuery({ queryKey: ["link-analytics", workspaceId, linkId], queryFn: () => linksClient.analytics(workspaceId, linkId), enabled: canAnalytics });
  if (!canAnalytics) return <Alert tone="warning" title="Analytics permission required">当前工作区角色没有 analytics 权限。</Alert>;
  if (analytics.isPending) return <div className="links-centered"><Spinner label="正在加载分析" /></div>;
  if (analytics.isError) return <ErrorState title="无法读取分析数据" description={errorMessage(analytics.error)} action={<Button type="button" onClick={() => analytics.refetch()}>重试</Button>} />;
  const data = analytics.data;
  return <div className="link-panel-stack"><div className="link-summary-grid"><SummaryCard label="Clicks" value={data.clicks} /><SummaryCard label="Unique visitors" value={data.unique_visitors} /><SummaryCard label="Bots" value={data.bot_visits} /></div><div className="link-analytics-grid"><Dimension title="Sources" data={data.sources} /><Dimension title="Countries" data={data.countries} /><Dimension title="Devices" data={data.devices} /><Dimension title="Browsers" data={data.browsers} /></div>{data.recent.length ? <div className="link-history-list"><h3>Recent events</h3>{data.recent.slice(0, 20).map((event, index) => <div className="link-history-item" key={index}><code>{String(event.timestamp ?? "")}</code><span>{String(event.source ?? "Unknown")} · {String(event.country ?? "")} · {String(event.device ?? "")}</span></div>)}</div> : <EmptyState title="No analytics events" description="当前时间范围还没有点击数据。" />}</div>;
}

function Dimension({ title, data }: { title: string; data: Array<{ name: string; count: number }> }) {
  return <div className="link-dimension"><h3>{title}</h3>{data.length ? data.slice(0, 8).map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.count}</strong></div>) : <p>No data</p>}</div>;
}

function RoutingPanel({ link, canEdit, save, pending, mutationError }: EditorProps) {
  const initial = useMemo(() => (link.routing_rules ?? []).map((rule) => ({ Dimension: rule.Dimension, Value: rule.Value, Destination: rule.Destination })), [link.routing_rules]);
  const [rules, setRules] = useState<RoutingRule[]>(initial);
  const [reason, setReason] = useState("");
  useEffect(() => setRules(initial), [initial]);
  const updateRule = (index: number, patch: Partial<RoutingRule>) => setRules((current) => current.map((rule, position) => position === index ? { ...rule, ...patch } : rule));
  const errors = validateLinkRouting({ routing_rules: rules });
  return <form className="link-editor" onSubmit={(event) => { event.preventDefault(); if (!errors.length && reason.trim()) save({ routing_rules: rules }, reason); }}><div className="link-editor-head"><div><h3>Routing rules</h3><p>按 device、country、language 或 source 将访问路由到不同 HTTP(S) 目标。</p></div>{canEdit ? <Button variant="outline" type="button" disabled={rules.length >= 20} onClick={() => setRules((current) => [...current, { Dimension: "country", Value: "", Destination: "" }])}>Add rule</Button> : null}</div>{rules.length ? <div className="link-rule-list">{rules.map((rule, index) => <div className="link-rule-row" key={index}><Select aria-label={`Rule ${index + 1} dimension`} value={rule.Dimension} disabled={!canEdit} onChange={(event) => updateRule(index, { Dimension: event.target.value as RoutingDimension })}><option value="device">Device</option><option value="country">Country</option><option value="language">Language</option><option value="source">Source</option></Select><Input aria-label={`Rule ${index + 1} value`} value={rule.Value} disabled={!canEdit} onChange={(event) => updateRule(index, { Value: event.target.value })} placeholder="Match value" /><Input aria-label={`Rule ${index + 1} destination`} type="url" value={rule.Destination} disabled={!canEdit} onChange={(event) => updateRule(index, { Destination: event.target.value })} placeholder="https://…" />{canEdit ? <Button size="sm" variant="ghost" type="button" onClick={() => setRules((current) => current.filter((_, position) => position !== index))}>Remove</Button> : null}</div>)}</div> : <EmptyState title="No routing rules" description="未命中规则时继续使用链接的主 Destination。" />}{errors.length ? <Alert tone="danger" title="Routing validation">{errors.join("；")}</Alert> : null}{mutationError ? <Alert tone="danger" title="无法保存 Routing">{errorMessage(mutationError)}</Alert> : null}{canEdit ? <><Reason id="routing-reason" value={reason} onChange={setReason} /><div className="link-editor-actions"><Button type="submit" loading={pending} disabled={!reason.trim() || Boolean(errors.length)}>Save routing</Button></div></> : null}</form>;
}

function ABPanel({ link, canEdit, save, pending, mutationError }: EditorProps) {
  const initial = useMemo<ABDestination[]>(() => link.ab_destinations?.length ? link.ab_destinations : [], [link.ab_destinations]);
  const [variants, setVariants] = useState<ABDestination[]>(initial);
  const [reason, setReason] = useState("");
  useEffect(() => setVariants(initial), [initial]);
  const updateVariant = (index: number, patch: Partial<ABDestination>) => setVariants((current) => current.map((variant, position) => position === index ? { ...variant, ...patch } : variant));
  const total = variants.reduce((sum, item) => sum + Number(item.Weight || 0), 0);
  const errors = validateLinkRouting({ ab_destinations: variants });
  return <form className="link-editor" onSubmit={(event) => { event.preventDefault(); if (!errors.length && reason.trim()) save({ ab_destinations: variants }, reason); }}><div className="link-editor-head"><div><h3>A/B Test</h3><p>2–10 个版本，唯一 ID、有效 URL，权重总和必须等于 100。</p></div>{canEdit ? <Button variant="outline" type="button" disabled={variants.length >= 10} onClick={() => setVariants((current) => [...current, { ID: `v${current.length + 1}`, Destination: "", Weight: current.length === 0 ? 50 : 1 }])}>Add variant</Button> : null}</div><div className="link-ab-total" data-valid={total === 100 || undefined}>Total weight: <strong>{total}%</strong></div>{variants.length ? <div className="link-rule-list">{variants.map((variant, index) => <div className="link-rule-row link-ab-row" key={`${variant.ID}-${index}`}><Input aria-label={`Variant ${index + 1} id`} value={variant.ID} disabled={!canEdit} onChange={(event) => updateVariant(index, { ID: event.target.value })} placeholder="v1" /><Input aria-label={`Variant ${index + 1} destination`} type="url" value={variant.Destination} disabled={!canEdit} onChange={(event) => updateVariant(index, { Destination: event.target.value })} placeholder="https://…" /><Input aria-label={`Variant ${index + 1} weight`} type="number" min={1} max={99} value={variant.Weight} disabled={!canEdit} onChange={(event) => updateVariant(index, { Weight: Number(event.target.value) })} />{canEdit ? <Button size="sm" variant="ghost" type="button" onClick={() => setVariants((current) => current.filter((_, position) => position !== index))}>Remove</Button> : null}</div>)}</div> : <EmptyState title="A/B Test is off" description="添加至少两个版本后才能启用 A/B 分流。" />}{errors.length && variants.length ? <Alert tone="danger" title="A/B validation">{errors.join("；")}</Alert> : null}{mutationError ? <Alert tone="danger" title="无法保存 A/B Test">{errorMessage(mutationError)}</Alert> : null}{canEdit ? <><Reason id="ab-reason" value={reason} onChange={setReason} /><div className="link-editor-actions"><Button type="submit" loading={pending} disabled={!reason.trim() || !variants.length || Boolean(errors.length)}>Save A/B Test</Button>{variants.length ? <Button variant="outline" type="button" onClick={() => setVariants([])}>Disable A/B</Button> : null}</div></> : null}</form>;
}

function UTMPanel({ link, canEdit, save, pending, mutationError }: EditorProps) {
  const [values, setValues] = useState<UTMValues>(link.utm ?? {});
  const [reason, setReason] = useState("");
  useEffect(() => setValues(link.utm ?? {}), [link.utm]);
  const preview = useMemo(() => { try { const url = new URL(link.destination); Object.entries(values).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }); return url.toString(); } catch { return link.destination; } }, [link.destination, values]);
  const set = (key: keyof UTMValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <form className="link-editor" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) save({ utm: values }, reason); }}><h3>UTM parameters</h3><div className="links-form-grid"><Field label="Source" htmlFor="utm-source"><Input id="utm-source" disabled={!canEdit} value={values.utm_source ?? ""} onChange={(event) => set("utm_source", event.target.value)} maxLength={255} /></Field><Field label="Medium" htmlFor="utm-medium"><Input id="utm-medium" disabled={!canEdit} value={values.utm_medium ?? ""} onChange={(event) => set("utm_medium", event.target.value)} maxLength={255} /></Field><Field label="Campaign" htmlFor="utm-campaign"><Input id="utm-campaign" disabled={!canEdit} value={values.utm_campaign ?? ""} onChange={(event) => set("utm_campaign", event.target.value)} maxLength={255} /></Field><Field label="Content" htmlFor="utm-content"><Input id="utm-content" disabled={!canEdit} value={values.utm_content ?? ""} onChange={(event) => set("utm_content", event.target.value)} maxLength={255} /></Field><Field label="Term" htmlFor="utm-term"><Input id="utm-term" disabled={!canEdit} value={values.utm_term ?? ""} onChange={(event) => set("utm_term", event.target.value)} maxLength={255} /></Field></div><div className="link-preview"><span>Destination preview</span><code>{preview}</code></div>{mutationError ? <Alert tone="danger" title="无法保存 UTM">{errorMessage(mutationError)}</Alert> : null}{canEdit ? <><Reason id="utm-reason" value={reason} onChange={setReason} /><div className="link-editor-actions"><Button type="submit" loading={pending} disabled={!reason.trim()}>Save UTM</Button></div></> : null}</form>;
}

function AccessPanel({ link, canEdit, save, pending, mutationError }: EditorProps) {
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [expiresAt, setExpiresAt] = useState(link.expires_at ? link.expires_at.slice(0, 16) : "");
  const [maxClicks, setMaxClicks] = useState(link.max_clicks ? String(link.max_clicks) : "");
  const [oneTime, setOneTime] = useState(link.one_time);
  const [reason, setReason] = useState("");
  useEffect(() => { setExpiresAt(link.expires_at ? link.expires_at.slice(0, 16) : ""); setMaxClicks(link.max_clicks ? String(link.max_clicks) : ""); setOneTime(link.one_time); setPassword(""); setClearPassword(false); }, [link]);
  return <form className="link-editor" onSubmit={(event) => { event.preventDefault(); if (!reason.trim()) return; const patch: Partial<LinkWriteInput> = { one_time: oneTime, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null, max_clicks: maxClicks ? Number(maxClicks) : null }; if (password) patch.password = password; if (clearPassword) patch.clear_password = true; save(patch, reason); }}><SettingsSection title="Access controls" description="密码、到期时间、点击上限和一次性访问都由 redirect plane 实际执行。"><div className="links-form-grid"><Field label="New password" htmlFor="access-password" help={link.password_protected ? "当前已启用密码；留空保持不变。" : "至少 6 位。"}><Input id="access-password" type="password" minLength={6} disabled={!canEdit} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field><Field label="Expiration" htmlFor="access-expiry"><Input id="access-expiry" type="datetime-local" disabled={!canEdit} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field><Field label="Max clicks" htmlFor="access-max-clicks"><Input id="access-max-clicks" type="number" min={1} disabled={!canEdit} value={maxClicks} onChange={(event) => setMaxClicks(event.target.value)} placeholder="Unlimited" /></Field></div><Checkbox label="One-time link" checked={oneTime} disabled={!canEdit} onCheckedChange={setOneTime} />{link.password_protected ? <Checkbox label="Remove current password" checked={clearPassword} disabled={!canEdit || Boolean(password)} onCheckedChange={setClearPassword} /> : null}</SettingsSection>{mutationError ? <Alert tone="danger" title="无法保存 Access">{errorMessage(mutationError)}</Alert> : null}{canEdit ? <><Reason id="access-reason" value={reason} onChange={setReason} /><div className="link-editor-actions"><Button type="submit" loading={pending} disabled={!reason.trim()}>Save access</Button></div></> : null}</form>;
}

function QRPanel({ workspaceId, linkId, short }: { workspaceId: number; linkId: number; short: string }) {
  const [foreground, setForeground] = useState("#14231d");
  const [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(768);
  const preview = linksClient.qrUrl(workspaceId, linkId, { format: "png", size, foreground, background });
  return <div className="link-qr-layout"><div className="link-qr-preview"><img src={preview} alt={`QR code for ${short}`} /><code>{short}</code></div><div className="link-editor"><h3>QR style & export</h3><div className="links-form-grid"><Field label="Foreground" htmlFor="qr-fg"><Input id="qr-fg" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></Field><Field label="Background" htmlFor="qr-bg"><Input id="qr-bg" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></Field><Field label="Size" htmlFor="qr-size"><Select id="qr-size" value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={512}>512 px</option><option value={768}>768 px</option><option value={1024}>1024 px</option><option value={1600}>1600 px</option></Select></Field></div><div className="link-editor-actions">{(["png", "svg", "pdf"] as const).map((format) => <a key={format} className="gj-button" data-variant="outline" data-size="md" href={linksClient.qrUrl(workspaceId, linkId, { format, size, foreground, background, download: true })}>{format.toUpperCase()}</a>)}</div><p className="links-muted">二维码直接编码该 Link 的真实短地址；PNG/SVG/PDF 均由后端生成，不使用前端占位图。</p></div></div>;
}

function SettingsPanel({ link, canEdit, save, pending, mutationError, workspaceId, onDeleted }: EditorProps & { workspaceId: number; onDeleted: () => void }) {
  const [destination, setDestination] = useState(link.destination);
  const [title, setTitle] = useState(link.title);
  const [status, setStatus] = useState<LinkStatus>(link.status);
  const [redirect, setRedirect] = useState<301 | 302 | 307 | 308>(link.redirect_status);
  const [reason, setReason] = useState("");
  const remove = useMutation({ mutationFn: () => linksClient.bulkDelete(workspaceId, [link.id]), onSuccess: onDeleted });
  useEffect(() => { setDestination(link.destination); setTitle(link.title); setStatus(link.status); setRedirect(link.redirect_status); }, [link]);
  return <div className="link-panel-stack" id="settings"><form className="link-editor" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) save({ destination, title, status, redirect_status: redirect }, reason); }}><SettingsSection title="Link settings" description="短码和域名保持不可变；Destination、标题、状态和跳转码进入版本历史。"><Field label="Destination" htmlFor="settings-destination" required><Input id="settings-destination" type="url" disabled={!canEdit} value={destination} onChange={(event) => setDestination(event.target.value)} required /></Field><Field label="Title" htmlFor="settings-title"><Input id="settings-title" disabled={!canEdit} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} /></Field><div className="links-form-grid"><Field label="Status" htmlFor="settings-status"><Select id="settings-status" disabled={!canEdit} value={status} onChange={(event) => setStatus(event.target.value as LinkStatus)}><option value="active">Active</option><option value="paused">Paused</option><option value="expired">Expired</option></Select></Field><Field label="Redirect" htmlFor="settings-redirect"><Select id="settings-redirect" disabled={!canEdit} value={redirect} onChange={(event) => setRedirect(Number(event.target.value) as 301 | 302 | 307 | 308)}><option value={301}>301 Permanent</option><option value={302}>302 Temporary</option><option value={307}>307 Temporary</option><option value={308}>308 Permanent</option></Select></Field></div></SettingsSection>{mutationError ? <Alert tone="danger" title="无法保存 Settings">{errorMessage(mutationError)}</Alert> : null}{canEdit ? <><Reason id="settings-reason" value={reason} onChange={setReason} /><div className="link-editor-actions"><Button type="submit" loading={pending} disabled={!reason.trim()}>Save settings</Button></div></> : null}</form>{canEdit ? <SettingsSection title="Danger zone" description="删除使用现有 soft-delete 语义，并从 Redis redirect plane 移除。">{remove.isError ? <Alert tone="danger" title="删除失败">{errorMessage(remove.error)}</Alert> : null}<AlertDialog triggerLabel="Delete link" title="Delete this link?" description="短地址将停止解析。数据库记录会软删除，以保留审计能力。" confirmLabel="Delete link" onConfirm={() => remove.mutate()} /></SettingsSection> : null}</div>;
}

function HistoryPanel({ workspaceId, linkId, canEdit }: { workspaceId: number; linkId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ["link-history", workspaceId, linkId], queryFn: () => linksClient.versions(workspaceId, linkId) });
  const [reason, setReason] = useState("");
  const restore = useMutation({ mutationFn: (revision: number) => linksClient.restore(workspaceId, linkId, revision, reason), onSuccess: async () => { setReason(""); await Promise.all([queryClient.invalidateQueries({ queryKey: ["link", workspaceId, linkId] }), queryClient.invalidateQueries({ queryKey: ["link-history", workspaceId, linkId] })]); } });
  if (history.isPending) return <div className="links-centered"><Spinner label="正在加载历史" /></div>;
  if (history.isError) return <ErrorState title="无法读取 History" description={errorMessage(history.error)} action={<Button type="button" onClick={() => history.refetch()}>重试</Button>} />;
  return <div className="link-panel-stack">{canEdit ? <Reason id="restore-reason" value={reason} onChange={setReason} /> : null}{restore.isError ? <Alert tone="danger" title="恢复失败">{errorMessage(restore.error)}</Alert> : null}<div className="link-history-list">{history.data.data.map((version) => <article className="link-history-item" key={version.id}><div><strong>Revision {version.revision}</strong><span>{formatDate(version.created_at)} · actor #{version.created_by}</span></div><p>{version.change_reason}</p><details><summary>Snapshot / diff source</summary><pre>{JSON.stringify(version.snapshot, null, 2)}</pre></details>{canEdit ? <Button size="sm" variant="outline" type="button" disabled={!reason.trim()} loading={restore.isPending} onClick={() => restore.mutate(version.revision)}>Restore revision</Button> : null}</article>)}</div></div>;
}

interface EditorProps {
  link: LinkRecord;
  canEdit: boolean;
  save: (patch: Partial<LinkWriteInput>, reason: string) => void;
  pending: boolean;
  mutationError: unknown;
}

export default function LinkDetailPage() {
  const queryClient = useQueryClient();
  const linkId = currentLinkId();
  const { workspaces, workspace } = useDetailWorkspace();
  const workspaceId = workspace?.id;
  const capabilities = useQuery({ queryKey: ["link-capabilities", workspaceId], queryFn: () => linksClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const link = useQuery({ queryKey: ["link", workspaceId, linkId], queryFn: () => linksClient.get(workspaceId!, linkId!), enabled: Boolean(workspaceId && linkId) });
  const risks = useQuery({ queryKey: ["link-risks", workspaceId], queryFn: () => linksClient.risks(workspaceId!), enabled: Boolean(workspaceId) });
  const update = useMutation({ mutationFn: ({ patch, reason }: { patch: Partial<LinkWriteInput>; reason: string }) => { if (!link.data || !workspaceId || !linkId) throw new Error("Link context unavailable"); return linksClient.update(workspaceId, linkId, { ...editable(link.data), ...patch }, reason); }, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["link", workspaceId, linkId] }), queryClient.invalidateQueries({ queryKey: ["links", workspaceId] }), queryClient.invalidateQueries({ queryKey: ["link-history", workspaceId, linkId] })]); } });

  if (!linkId) return <Page className="links-page"><ErrorState title="Invalid link" description="链接编号无效。" /></Page>;
  if (workspaces.isPending || link.isPending) return <Page className="links-page"><div className="links-centered"><Spinner label="正在加载链接详情" /></div></Page>;
  if (workspaces.isError || !workspace) return <Page className="links-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} /></Page>;
  if (link.isError || !link.data) return <Page className="links-page"><ErrorState title="链接不存在或无权访问" description={errorMessage(link.error)} action={<a className="gj-button" data-variant="outline" data-size="md" href={`/app/links?workspace=${workspace.id}`}>Back to links</a>} /></Page>;

  const item = link.data;
  const short = shortUrl(item.domain, item.code);
  const canEdit = capabilities.data?.can_edit === true;
  const canAnalytics = capabilities.data?.can_analytics === true;
  const risk = risks.data?.data.find((entry) => entry.link_id === item.id);
  const save = (patch: Partial<LinkWriteInput>, reason: string) => update.mutate({ patch, reason: reason.trim() });
  const editorProps: EditorProps = { link: item, canEdit, save, pending: update.isPending, mutationError: update.error };

  const tabs = [
    { value: "overview", label: "Overview", content: <div className="link-panel-stack"><div className="link-summary-grid"><SummaryCard label="Destination" value={item.destination} /><SummaryCard label="Clicks" value={item.clicks ?? 0} /><SummaryCard label="Created" value={formatDate(item.created_at)} /><SummaryCard label="Domain" value={item.domain || "Default"} /></div>{risk ? <Alert tone={risk.effective_decision === "block" ? "danger" : risk.pending || risk.effective_decision === "review" ? "warning" : "info"} title={`Destination risk · ${risk.effective_decision}`}>{risk.pending ? "安全扫描待处理或已到复检时间。" : `Provider ${risk.provider} · score ${risk.score}.`}{risk.manual ? " 当前状态包含管理员人工决策。" : ""}</Alert> : null}<SettingsSection title="Current behavior"><dl className="link-definition-list"><div><dt>Redirect</dt><dd>{item.redirect_status}</dd></div><div><dt>Password</dt><dd>{item.password_protected ? "Protected" : "Off"}</dd></div><div><dt>Expires</dt><dd>{formatDate(item.expires_at)}</dd></div><div><dt>Click limit</dt><dd>{item.max_clicks ?? "Unlimited"}</dd></div><div><dt>One-time</dt><dd>{item.one_time ? "On" : "Off"}</dd></div></dl></SettingsSection></div> },
    { value: "analytics", label: "Analytics", content: <AnalyticsPanel workspaceId={workspace.id} linkId={item.id} canAnalytics={canAnalytics} /> },
    { value: "routing", label: "Routing", content: <RoutingPanel {...editorProps} /> },
    { value: "ab", label: "A/B Test", content: <ABPanel {...editorProps} /> },
    { value: "utm", label: "UTM", content: <UTMPanel {...editorProps} /> },
    { value: "access", label: "Access", content: <AccessPanel {...editorProps} /> },
    { value: "qr", label: "QR", content: <QRPanel workspaceId={workspace.id} linkId={item.id} short={short} /> },
    { value: "settings", label: "Settings", content: <SettingsPanel {...editorProps} workspaceId={workspace.id} onDeleted={() => window.location.assign(`/app/links?workspace=${workspace.id}`)} /> },
    { value: "history", label: "History", content: <HistoryPanel workspaceId={workspace.id} linkId={item.id} canEdit={canEdit} /> }
  ];

  return <Page className="links-page link-detail-page" data-p05-link-detail><div className="link-detail-header"><div><a className="links-back" href={`/app/links?workspace=${workspace.id}`}>← Links</a><div className="link-title-row"><h1>{short}</h1><StatusBadge status={item.status} /></div><p>{item.title || "Untitled link"}</p></div><div className="link-header-actions"><Button variant="outline" type="button" onClick={() => navigator.clipboard.writeText(short)}>Copy</Button><Button variant="outline" type="button" onClick={() => window.open(short, "_blank", "noopener,noreferrer")}>Visit</Button>{canEdit ? <Button type="button" onClick={() => document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" })}>Edit</Button> : null}<DropdownMenu actions={[{ id: "copy-destination", label: "Copy destination", onSelect: () => navigator.clipboard.writeText(item.destination) }, { id: "history", label: "History is available in the tab below" }]} /></div></div>{capabilities.data && !canEdit ? <Alert tone="warning" title="Read-only link">当前角色为 {capabilities.data.role}。编辑、恢复和删除操作已禁用。</Alert> : null}<Tabs items={tabs} defaultValue="overview" /></Page>;
}
