import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, createTextClient, resourceAccess, type TextShareFormat, type TextShareRecord, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, Checkbox, Dialog, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const textClient = createTextClient(api);

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function requestState(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const detail = errorMessage(error).toLowerCase();
  if (error.status === 403) return { title: "Permission denied", body: "当前成员角色没有执行该文本操作的权限。" };
  if (error.status === 429) return { title: "Rate limited", body: "请求过于频繁，请稍后再试。" };
  if (error.status === 402 || error.status === 409 || (error.status === 422 && /(quota|limit|额度|套餐)/.test(detail))) return { title: "Quota exceeded", body: "当前套餐的 Text 分享额度不足，请先调整额度或套餐。" };
  if (error.status === 503) return { title: "Text service disabled", body: "Text 服务当前不可用；GoJet 不会用浏览器本地数据伪造成功状态。" };
  return null;
}

function expiryInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function expiryPayload(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function statusTone(status: TextShareRecord["status"]): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "neutral";
}

function TextPreview({ format, content }: { format: TextShareFormat; content: string }) {
  return <section className="text-live-preview" aria-label="Text live preview">
    <div className="text-preview-head"><strong>Preview</strong><Badge tone="neutral">{format}</Badge></div>
    <pre data-format={format}>{content || "Preview appears here as you type."}</pre>
    <small>Public Markdown is rendered by the Go server's escaped allowlist renderer under strict CSP. This editor preview never injects user HTML.</small>
  </section>;
}

function TextCreateForm({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<TextShareFormat>("plain");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [oneTime, setOneTime] = useState(false);
  const mutation = useMutation({
    mutationFn: () => textClient.create(workspaceId, { title: title.trim(), content, format, slug: slug.trim() || undefined, password: password || undefined, expires_at: expiryPayload(expiresAt), one_time: oneTime }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["text-shares", workspaceId] }); setTitle(""); setContent(""); setSlug(""); setPassword(""); setExpiresAt(""); setOneTime(false); }
  });
  const special = requestState(mutation.error);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit && title.trim() && content) mutation.mutate(); };

  return <form className="resource-create-form text-editor-form" onSubmit={submit} data-text-create-form>
    {!canEdit ? <Alert tone="warning" title="Read-only">当前角色可以查看 Text 分享，但不能创建或修改。</Alert> : null}
    {special ? <Alert tone="danger" title={special.title}>{special.body}</Alert> : mutation.isError ? <Alert tone="danger" title="创建失败">{errorMessage(mutation.error)}</Alert> : null}
    {mutation.isSuccess ? <Alert tone="info" title="Text created">文本已保存到服务端，列表将重新读取真实 API。</Alert> : null}
    <Field label="Title" htmlFor="text-title" required><Input id="text-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></Field>
    <div className="resource-form-grid">
      <Field label="Format" htmlFor="text-format"><Select id="text-format" value={format} onChange={(event) => setFormat(event.target.value as TextShareFormat)}><option value="plain">Plain text</option><option value="markdown">Markdown</option><option value="code">Code / logs</option></Select></Field>
      <Field label="Language" htmlFor="text-language" help="V4 Text contract does not persist a code-language field; syntax language is therefore not fabricated in V5."><Select id="text-language" value="auto" disabled><option value="auto">Auto / not persisted</option></Select></Field>
    </div>
    <Field label="Content" htmlFor="text-content" required help="Maximum 1 MB is enforced by the Go service."><Textarea id="text-content" className="text-editor-area" value={content} onChange={(event) => setContent(event.target.value)} rows={12} required /></Field>
    <TextPreview format={format} content={content} />
    <div className="resource-form-grid">
      <Field label="Custom code" htmlFor="text-slug" help="Optional. The backend sanitizes and checks the public /t/{code} slug."><Input id="text-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="release-notes" /></Field>
      <Field label="Expiry" htmlFor="text-expiry"><Input id="text-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
    </div>
    <Field label="Password" htmlFor="text-password" help="Optional; when set it must be at least 6 characters and is hashed by the backend."><Input id="text-password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>
    <Checkbox checked={oneTime} onCheckedChange={setOneTime} label="One-time share — first successful read consumes the resource" />
    <section className="resource-capability-note"><strong>Domain</strong><p>Custom-domain ownership and verification stay in the Domains pipeline. Text does not invent a per-share domain binding that the backend does not persist.</p><a href="/app/domains">Manage domains</a></section>
    <div className="resource-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!canEdit || !title.trim() || !content}>Create Text</Button></div>
  </form>;
}

function TextEditor({ item, workspaceId, canEdit, onDeleted }: { item: TextShareRecord; workspaceId: number; canEdit: boolean; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["text-share", workspaceId, item.id], queryFn: () => textClient.get(workspaceId, item.id) });
  if (detail.isPending) return <section className="resource-section"><div className="resources-centered"><Spinner label="正在加载文本内容" /></div></section>;
  if (detail.isError) { const special = requestState(detail.error); return <section className="resource-section"><ErrorState title={special?.title ?? "无法读取文本"} description={special?.body ?? errorMessage(detail.error)} action={<Button type="button" onClick={() => detail.refetch()}>重试</Button>} /></section>; }
  return <TextEditorLoaded key={`${item.id}-${detail.data.status}-${detail.data.views}`} item={detail.data} workspaceId={workspaceId} canEdit={canEdit} onDeleted={onDeleted} onSaved={async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["text-shares", workspaceId] }), queryClient.invalidateQueries({ queryKey: ["text-share", workspaceId, item.id] })]); }} />;
}

function TextEditorLoaded({ item, workspaceId, canEdit, onDeleted, onSaved }: { item: TextShareRecord; workspaceId: number; canEdit: boolean; onDeleted: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content ?? "");
  const [format, setFormat] = useState<TextShareFormat>(item.format);
  const [status, setStatus] = useState<"active" | "paused">(item.status === "paused" ? "paused" : "active");
  const [expiresAt, setExpiresAt] = useState(expiryInput(item.expires_at));
  const [oneTime, setOneTime] = useState(item.one_time);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const terminal = item.status === "consumed" || item.status === "expired";
  const update = useMutation({ mutationFn: () => textClient.update(workspaceId, item.id, { title: title.trim(), content, format, status, expires_at: expiryPayload(expiresAt), one_time: oneTime, password: clearPassword ? "" : (password || undefined) }), onSuccess: onSaved });
  const remove = useMutation({ mutationFn: () => textClient.delete(workspaceId, item.id), onSuccess: async () => { await onSaved(); onDeleted(); } });
  const updateState = requestState(update.error);
  const removeState = requestState(remove.error);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit && !terminal && title.trim() && content) update.mutate(); };

  return <section className="resource-section text-detail-panel" data-text-detail>
    <div className="resource-detail-head"><div><span className="resource-eyebrow">TEXT DETAIL</span><h2>{item.title}</h2><p>{textClient.publicUrl(item.slug)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>
    {!canEdit ? <Alert tone="warning" title="Read-only Text access">当前角色只能查看内容和公开状态，服务端会拒绝写操作。</Alert> : null}
    {terminal ? <Alert tone="warning" title="Terminal share">该分享已 {item.status}，不能重新激活；如需继续发布请创建新分享。</Alert> : null}
    {updateState ? <Alert tone="danger" title={updateState.title}>{updateState.body}</Alert> : update.isError ? <Alert tone="danger" title="保存失败">{errorMessage(update.error)}</Alert> : null}
    {removeState ? <Alert tone="danger" title={removeState.title}>{removeState.body}</Alert> : remove.isError ? <Alert tone="danger" title="删除失败">{errorMessage(remove.error)}</Alert> : null}
    <form className="text-editor-layout" onSubmit={submit}>
      <div className="text-editor-controls">
        <Field label="Title" htmlFor={`edit-text-title-${item.id}`} required><Input id={`edit-text-title-${item.id}`} value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEdit || terminal} maxLength={200} /></Field>
        <div className="resource-form-grid"><Field label="Format" htmlFor={`edit-text-format-${item.id}`}><Select id={`edit-text-format-${item.id}`} value={format} onChange={(event) => setFormat(event.target.value as TextShareFormat)} disabled={!canEdit || terminal}><option value="plain">Plain text</option><option value="markdown">Markdown</option><option value="code">Code / logs</option></Select></Field><Field label="Status" htmlFor={`edit-text-status-${item.id}`}><Select id={`edit-text-status-${item.id}`} value={status} onChange={(event) => setStatus(event.target.value as "active" | "paused")} disabled={!canEdit || terminal}><option value="active">Active</option><option value="paused">Paused</option></Select></Field></div>
        <Field label="Content" htmlFor={`edit-text-content-${item.id}`} required><Textarea id={`edit-text-content-${item.id}`} className="text-editor-area" rows={14} value={content} onChange={(event) => setContent(event.target.value)} disabled={!canEdit || terminal} /></Field>
        <div className="resource-form-grid"><Field label="Expiry" htmlFor={`edit-text-expiry-${item.id}`}><Input id={`edit-text-expiry-${item.id}`} type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={!canEdit || terminal} /></Field><Field label="New password" htmlFor={`edit-text-password-${item.id}`} help={item.protected ? "Leave blank to keep current password." : "Optional; minimum 6 characters."}><Input id={`edit-text-password-${item.id}`} type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} disabled={!canEdit || terminal || clearPassword} /></Field></div>
        <Checkbox checked={oneTime} onCheckedChange={setOneTime} disabled={!canEdit || terminal} label="One-time share" />
        {item.protected ? <Checkbox checked={clearPassword} onCheckedChange={setClearPassword} disabled={!canEdit || terminal} label="Remove password protection" /> : null}
        <div className="resource-actions"><a className="resource-download-link" href={textClient.publicUrl(item.slug)} target="_blank" rel="noreferrer">Open public page</a><a className="resource-download-link" href="/app/domains">Manage domains</a>{canEdit && !terminal ? <Button type="submit" loading={update.isPending}>Save changes</Button> : null}{canEdit ? <Dialog triggerLabel="Delete Text" title="Delete Text share?" description="This pauses and soft-deletes the workspace resource." confirmLabel="Delete Text" destructive onConfirm={() => remove.mutate()}><p>The public share will no longer be available after deletion.</p></Dialog> : null}</div>
      </div>
      <TextPreview format={format} content={content} />
    </form>
  </section>;
}

export default function TextPage() {
  const { workspaces, workspace } = useWorkspace();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const workspaceId = workspace?.id;
  const shares = useQuery({ queryKey: ["text-shares", workspaceId], queryFn: () => textClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  if (workspaces.isPending) return <Page className="resources-page"><div className="resources-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="resources-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="resources-page"><EmptyState title="还没有工作区" description="创建工作区后才能管理 Text 分享。" /></Page>;
  const access = resourceAccess(workspace.role);
  const rows = shares.data?.data ?? [];
  const selected = rows.find((item) => item.id === selectedId) ?? null;
  const listState = requestState(shares.error);

  return <Page className="resources-page" data-p10-text>
    <PageHeader title="Text" description={`Publish plain text, Markdown, code and logs with server-enforced access controls · ${workspace.name}`} actions={access.can_edit ? <SideSheet triggerLabel="Create Text" title="Create Text share" description="Text is persisted through the Go API; password, expiry and one-time behavior remain server truth."><TextCreateForm workspaceId={workspace.id} canEdit={access.can_edit} /></SideSheet> : undefined} />
    {!access.can_edit ? <Alert tone="warning" title="Read-only Text access">当前角色为 {workspace.role}。可以查看 Text 分享，但创建、修改和删除由 RBAC 禁止。</Alert> : null}
    <section className="resource-summary-grid" aria-label="Text summary"><article><span>Shares</span><strong>{rows.length}</strong><small>当前工作区</small></article><article><span>Views</span><strong>{rows.reduce((sum, item) => sum + item.views, 0)}</strong><small>服务端累计阅读</small></article><article><span>Protected</span><strong>{rows.filter((item) => item.protected).length}</strong><small>密码保护</small></article></section>
    <section className="resource-section" aria-labelledby="text-list-title">
      <div className="resource-section-head"><div><span className="resource-eyebrow">CONTENT</span><h2 id="text-list-title">Text library</h2><p>标题、类型、阅读量、过期时间与状态均来自真实 API。</p></div></div>
      {shares.isPending ? <div className="resources-centered"><Spinner label="正在加载 Text 分享" /></div> : listState ? <ErrorState title={listState.title} description={listState.body} action={<Button type="button" onClick={() => shares.refetch()}>重试</Button>} /> : shares.isError ? <ErrorState title="无法加载 Text 分享" description={errorMessage(shares.error)} action={<Button type="button" onClick={() => shares.refetch()}>重试</Button>} /> : rows.length ? <div className="text-resource-list"><div className="text-resource-head" aria-hidden="true"><span>Title</span><span>Type</span><span>Views</span><span>Expiry</span><span>Created</span><span>Status</span></div>{rows.map((item) => <button key={item.id} type="button" className="text-resource-row" data-text-id={item.id} onClick={() => setSelectedId(item.id)}><span><strong>{item.title}</strong><small>/t/{item.slug}{item.protected ? " · protected" : ""}{item.one_time ? " · one-time" : ""}</small></span><span>{item.format}</span><span>{item.views}</span><span>{item.expires_at ? formatDate(item.expires_at) : "Never"}</span><span>{item.created_at ? formatDate(item.created_at) : "—"}</span><span><Badge tone={statusTone(item.status)}>{item.status}</Badge></span></button>)}</div> : <EmptyState title="No Text shares" description={access.can_edit ? "Create a Text share to publish notes, Markdown, code or logs." : "当前工作区还没有 Text 分享。"} />}
    </section>
    {selected ? <TextEditor item={selected} workspaceId={workspace.id} canEdit={access.can_edit} onDeleted={() => setSelectedId(null)} /> : null}
  </Page>;
}
