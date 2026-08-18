import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, createBioClient, resourceAccess, type BioBlock, type BioPageInput, type BioPageRecord, type BioPageStatus, type BioTheme, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const bioClient = createBioClient(api);
const tabs = ["Content", "Appearance", "Social", "Domain", "Analytics", "SEO", "Settings"] as const;
type BioTab = (typeof tabs)[number];

const defaultTheme: BioTheme = {
  Primary: "#16a66a",
  Background: "#f5faf7",
  Ink: "#14231d",
  Muted: "#66766f",
  Surface: "#ffffff"
};

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function requestState(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const detail = errorMessage(error).toLowerCase();
  if (error.status === 403 || /forbidden|无权|permission/.test(detail)) return { title: "Permission denied", body: "当前成员角色没有执行该 Bio 操作的权限。" };
  if (error.status === 429) return { title: "Rate limited", body: "请求过于频繁，请稍后再试。" };
  if (error.status === 402 || error.status === 409 || (error.status === 422 && /(quota|limit|额度|套餐)/.test(detail))) return { title: "Quota exceeded", body: "当前套餐的 Bio 页面额度不足，请先调整额度或套餐。" };
  if (error.status === 503) return { title: "Bio service disabled", body: "Bio 服务当前不可用；GoJet 不会用浏览器本地数据伪造成功状态。" };
  return null;
}

function statusTone(status: BioPageStatus): "success" | "warning" | "neutral" {
  if (status === "published") return "success";
  if (status === "paused") return "warning";
  return "neutral";
}

function color(theme: BioTheme, key: "Primary" | "Background" | "Ink" | "Muted" | "Surface", fallback: string) {
  const source = theme as BioTheme & Record<string, string | undefined>;
  return source[key] ?? source[key.toLowerCase()] ?? fallback;
}

function safeURL(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function PhonePreview({ title, bio, theme, blocks }: { title: string; bio: string; theme: BioTheme; blocks: BioBlock[] }) {
  const primary = color(theme, "Primary", defaultTheme.Primary);
  const background = color(theme, "Background", defaultTheme.Background);
  const ink = color(theme, "Ink", defaultTheme.Ink ?? "#14231d");
  const surface = color(theme, "Surface", defaultTheme.Surface ?? "#ffffff");
  return <div className="bio-phone-shell" aria-label="Bio live phone preview">
    <div className="bio-phone-speaker" aria-hidden="true" />
    <div className="bio-phone-screen" style={{ background, color: ink }}>
      <div className="bio-preview-avatar" style={{ background: primary }}>{(title.trim()[0] ?? "G").toUpperCase()}</div>
      <strong>{title || "Your Bio title"}</strong>
      <p>{bio || "Add a short introduction for your public page."}</p>
      <div className="bio-preview-links">{blocks.length ? blocks.map((block, index) => {
        const href = safeURL(block.URL);
        return href ? <a key={`${index}-${block.Label}`} href={href} target="_blank" rel="noreferrer nofollow" style={{ background: surface, borderColor: primary }}>{block.Label || "Untitled link"}</a> : <span key={`${index}-${block.Label}`} style={{ background: surface }}>{block.Label || "Invalid link"}</span>;
      }) : <span className="bio-preview-empty">Links appear here</span>}</div>
    </div>
  </div>;
}

function MiniPhone({ item }: { item: BioPageRecord }) {
  return <div className="bio-mini-phone" aria-hidden="true" style={{ background: color(item.theme, "Background", defaultTheme.Background) }}><span style={{ background: color(item.theme, "Primary", defaultTheme.Primary) }}>{(item.title[0] ?? "G").toUpperCase()}</span><i /><i /><i /></div>;
}

function CreateBioForm({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [slug, setSlug] = useState("");
  const mutation = useMutation({
    mutationFn: () => bioClient.create(workspaceId, { title: title.trim(), bio: bio.trim(), slug: slug.trim() || undefined, status: "draft", theme: defaultTheme, blocks: [] }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["bio-pages", workspaceId] }); setTitle(""); setBio(""); setSlug(""); }
  });
  const special = requestState(mutation.error);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit && title.trim()) mutation.mutate(); };
  return <form className="resource-create-form bio-create-form" onSubmit={submit} data-bio-create-form>
    {!canEdit ? <Alert tone="warning" title="Read-only">当前角色可以查看 Bio 页面，但不能创建或修改。</Alert> : null}
    {special ? <Alert tone="danger" title={special.title}>{special.body}</Alert> : mutation.isError ? <Alert tone="danger" title="创建失败">{errorMessage(mutation.error)}</Alert> : null}
    {mutation.isSuccess ? <Alert tone="info" title="Bio created">已创建草稿并重新读取服务端列表。</Alert> : null}
    <Field label="Title" htmlFor="bio-create-title" required><Input id="bio-create-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></Field>
    <Field label="Bio" htmlFor="bio-create-copy" help="Optional, maximum 2000 characters."><Textarea id="bio-create-copy" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2000} rows={5} /></Field>
    <Field label="Custom code" htmlFor="bio-create-slug" help="Optional public /p/{code}; the Go service sanitizes and checks the persisted slug."><Input id="bio-create-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="ethan" /></Field>
    <div className="resource-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!canEdit || !title.trim()}>Create Bio</Button></div>
  </form>;
}

function BioBuilder({ item, workspaceId, canEdit, onDeleted }: { item: BioPageRecord; workspaceId: number; canEdit: boolean; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<BioTab>("Content");
  const [title, setTitle] = useState(item.title);
  const [bio, setBio] = useState(item.bio);
  const [status, setStatus] = useState<BioPageStatus>(item.status);
  const [primary, setPrimary] = useState(color(item.theme, "Primary", defaultTheme.Primary));
  const [background, setBackground] = useState(color(item.theme, "Background", defaultTheme.Background));
  const [blocks, setBlocks] = useState<BioBlock[]>(item.blocks ?? []);
  const theme = useMemo<BioTheme>(() => ({ ...defaultTheme, Primary: primary, Background: background }), [primary, background]);
  const input = useMemo<BioPageInput>(() => ({ title: title.trim(), bio, status, theme, blocks }), [title, bio, status, theme, blocks]);
  const update = useMutation({ mutationFn: () => bioClient.update(workspaceId, item.id, input), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["bio-pages", workspaceId] }); } });
  const remove = useMutation({ mutationFn: () => bioClient.delete(workspaceId, item.id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["bio-pages", workspaceId] }); onDeleted(); } });
  const special = requestState(update.error) ?? requestState(remove.error);
  const save = () => { if (canEdit && title.trim()) update.mutate(); };
  const changeBlock = (index: number, patch: Partial<BioBlock>) => setBlocks((current) => current.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index));
  const addBlock = (label = "", URL = "") => setBlocks((current) => current.length >= 50 ? current : [...current, { Label: label, URL }]);

  return <section className="resource-section bio-builder-section" data-bio-builder>
    <div className="resource-detail-head"><div><span className="resource-eyebrow">BIO BUILDER</span><h2>{item.title}</h2><p>{bioClient.publicUrl(item.slug)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>
    {!canEdit ? <Alert tone="warning" title="Read-only Bio access">当前角色只能查看 Builder 与公开状态，服务端会拒绝写操作。</Alert> : null}
    {special ? <Alert tone="danger" title={special.title}>{special.body}</Alert> : update.isError ? <Alert tone="danger" title="保存失败">{errorMessage(update.error)}</Alert> : remove.isError ? <Alert tone="danger" title="删除失败">{errorMessage(remove.error)}</Alert> : null}
    {update.isSuccess ? <Alert tone="info" title="Saved">Bio 页面已写入 Go API。</Alert> : null}
    <div className="bio-builder-grid">
      <div className="bio-builder-controls">
        <div className="bio-tabs" role="tablist" aria-label="Bio builder sections">{tabs.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? "is-active" : ""} onClick={() => setTab(name)}>{name}</button>)}</div>
        <div className="bio-tab-panel" role="tabpanel">
          {tab === "Content" ? <div className="bio-control-stack">
            <Field label="Title" htmlFor={`bio-title-${item.id}`} required><Input id={`bio-title-${item.id}`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={!canEdit} /></Field>
            <Field label="Bio" htmlFor={`bio-copy-${item.id}`}><Textarea id={`bio-copy-${item.id}`} value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2000} rows={5} disabled={!canEdit} /></Field>
            <div className="bio-block-list"><div className="bio-control-head"><strong>Links</strong><Button type="button" size="sm" onClick={() => addBlock()} disabled={!canEdit || blocks.length >= 50}>Add link</Button></div>{blocks.length ? blocks.map((block, index) => <div className="bio-block-editor" key={`${index}-${block.Label}`}><Input aria-label={`Link ${index + 1} label`} value={block.Label} maxLength={120} disabled={!canEdit} onChange={(event) => changeBlock(index, { Label: event.target.value })} placeholder="Label" /><Input aria-label={`Link ${index + 1} URL`} value={block.URL} disabled={!canEdit} onChange={(event) => changeBlock(index, { URL: event.target.value })} placeholder="https://example.com" /><Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(index)} disabled={!canEdit}>Remove</Button></div>) : <p className="bio-muted-copy">No links yet. Add up to 50 complete HTTP(S) links.</p>}</div>
          </div> : null}
          {tab === "Appearance" ? <div className="bio-control-stack"><Field label="Primary color" htmlFor={`bio-primary-${item.id}`}><Input id={`bio-primary-${item.id}`} type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} disabled={!canEdit} /></Field><Field label="Background color" htmlFor={`bio-background-${item.id}`}><Input id={`bio-background-${item.id}`} type="color" value={background} onChange={(event) => setBackground(event.target.value)} disabled={!canEdit} /></Field><p className="bio-muted-copy">Colors are persisted in the validated Theme JSON and revalidated by the public Go renderer.</p></div> : null}
          {tab === "Social" ? <div className="bio-control-stack"><h3>Social links</h3><p className="bio-muted-copy">V4 persists one validated link-block collection rather than a separate social schema. Social buttons therefore remain real Bio blocks.</p><div className="resource-actions"><Button type="button" size="sm" onClick={() => addBlock("GitHub", "https://github.com/")} disabled={!canEdit}>Add GitHub</Button><Button type="button" size="sm" onClick={() => addBlock("X", "https://x.com/")} disabled={!canEdit}>Add X</Button><Button type="button" size="sm" onClick={() => addBlock("LinkedIn", "https://www.linkedin.com/")} disabled={!canEdit}>Add LinkedIn</Button></div></div> : null}
          {tab === "Domain" ? <div className="bio-control-stack"><h3>Public address</h3><a className="resource-download-link" href={bioClient.publicUrl(item.slug)} target="_blank" rel="noreferrer">{bioClient.publicUrl(item.slug)}</a><p className="bio-muted-copy">Bio does not invent a per-page domain column that V4 does not persist. Domain ownership and DNS verification remain in the Domains pipeline.</p><a className="resource-download-link" href="/app/domains">Manage domains</a></div> : null}
          {tab === "Analytics" ? <div className="bio-control-stack"><h3>Page analytics</h3><div className="bio-metric"><strong>{item.views}</strong><span>views</span></div><p className="bio-muted-copy">This counter is returned by the Bio service and increments on successful published reads.</p><a className="resource-download-link" href="/app/analytics">Open Analytics</a></div> : null}
          {tab === "SEO" ? <div className="bio-control-stack"><Alert tone="info" title="SEO default: noindex">Public Bio pages are user-generated content and are server-rendered with <code>noindex,nofollow</code>. This safety default is not exposed as a client-side override.</Alert><p className="bio-muted-copy">The public response also remains no-store, nosniff and constrained by CSP.</p></div> : null}
          {tab === "Settings" ? <div className="bio-control-stack"><Field label="Publishing status" htmlFor={`bio-status-${item.id}`}><Select id={`bio-status-${item.id}`} value={status} onChange={(event) => setStatus(event.target.value as BioPageStatus)} disabled={!canEdit}><option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option></Select></Field><p className="bio-muted-copy">Only published pages are readable from the public `/p/{item.slug}` route.</p><div className="resource-actions">{canEdit ? <Button type="button" onClick={save} loading={update.isPending}>Save settings</Button> : null}{canEdit ? <Dialog triggerLabel="Delete Bio" title="Delete Bio page?" description="This pauses and soft-deletes the workspace resource." confirmLabel="Delete Bio" destructive onConfirm={() => remove.mutate()}><p>The public page will no longer be available after deletion.</p></Dialog> : null}</div></div> : null}
        </div>
        {tab !== "Settings" && canEdit ? <div className="bio-builder-save"><Button type="button" onClick={save} loading={update.isPending} disabled={!title.trim()}>Save changes</Button></div> : null}
      </div>
      <div className="bio-builder-preview"><span className="resource-eyebrow">LIVE PREVIEW</span><PhonePreview title={title} bio={bio} theme={theme} blocks={blocks} /></div>
    </div>
  </section>;
}

export default function BioPage() {
  const { workspaces, workspace } = useWorkspace();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const workspaceId = workspace?.id;
  const pages = useQuery({ queryKey: ["bio-pages", workspaceId], queryFn: () => bioClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  if (workspaces.isPending) return <Page className="resources-page"><div className="resources-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="resources-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="resources-page"><EmptyState title="还没有工作区" description="创建工作区后才能管理 Bio 页面。" /></Page>;
  const access = resourceAccess(workspace.role);
  const rows = pages.data?.data ?? [];
  const selected = rows.find((item) => item.id === selectedId) ?? null;
  const listState = requestState(pages.error);
  return <Page className="resources-page" data-p11-bio>
    <PageHeader title="Bio" description={`Build link-in-bio pages with validated blocks, live preview and server-owned publishing · ${workspace.name}`} actions={access.can_edit ? <SideSheet triggerLabel="Create Bio" title="Create Bio page" description="New Bio pages start as server-persisted drafts."><CreateBioForm workspaceId={workspace.id} canEdit={access.can_edit} /></SideSheet> : undefined} />
    {!access.can_edit ? <Alert tone="warning" title="Read-only Bio access">当前角色为 {workspace.role}。可以查看 Bio 页面，但创建、修改和删除由 RBAC 禁止。</Alert> : null}
    <section className="resource-summary-grid" aria-label="Bio summary"><article><span>Pages</span><strong>{rows.length}</strong><small>当前工作区</small></article><article><span>Views</span><strong>{rows.reduce((sum, item) => sum + item.views, 0)}</strong><small>服务端累计访问</small></article><article><span>Published</span><strong>{rows.filter((item) => item.status === "published").length}</strong><small>公开页面</small></article></section>
    <section className="resource-section" aria-labelledby="bio-list-title">
      <div className="resource-section-head"><div><span className="resource-eyebrow">PAGES</span><h2 id="bio-list-title">Bio pages</h2><p>Preview、Title、Domain、Views 与 Status 均来自真实 Bio 资源。</p></div></div>
      {pages.isPending ? <div className="resources-centered"><Spinner label="正在加载 Bio 页面" /></div> : listState ? <ErrorState title={listState.title} description={listState.body} action={<Button type="button" onClick={() => pages.refetch()}>重试</Button>} /> : pages.isError ? <ErrorState title="无法加载 Bio 页面" description={errorMessage(pages.error)} action={<Button type="button" onClick={() => pages.refetch()}>重试</Button>} /> : rows.length ? <div className="bio-page-list"><div className="bio-page-head" aria-hidden="true"><span>Preview</span><span>Title</span><span>Domain</span><span>Views</span><span>Status</span></div>{rows.map((item) => <button key={item.id} type="button" className="bio-page-row" data-bio-id={item.id} onClick={() => setSelectedId(item.id)}><span><MiniPhone item={item} /></span><span><strong>{item.title}</strong><small>{item.bio || "No bio yet"}</small></span><span>/p/{item.slug}</span><span>{item.views}</span><span><Badge tone={statusTone(item.status)}>{item.status}</Badge></span></button>)}</div> : <EmptyState title="No Bio pages" description={access.can_edit ? "Create a Bio draft to start building your public page." : "当前工作区还没有 Bio 页面。"} />}
    </section>
    {selected ? <BioBuilder key={`${selected.id}-${selected.created_at ?? ""}`} item={selected} workspaceId={workspace.id} canEdit={access.can_edit} onDeleted={() => setSelectedId(null)} /> : null}
  </Page>;
}
