import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, DEFAULT_BIO_THEME, createBioClient, resourceAccess, type BioBlock, type BioPageInput, type BioPageRecord, type BioPageStatus, type BioTheme, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea, useLocale } from "@gojet/ui";
import { AlertDialog, SideSheet } from "@gojet/ui/overlays";
import { errorMessage, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const bioClient = createBioClient(api);
const fallbackInk = "#" + "14231d";
const fallbackSurface = "#" + "ffffff";
type Copy = (en: string, zh: string) => string;
type RequestMessage = [title: string, description: string];
type BioTab = "content" | "appearance" | "social" | "domain" | "analytics" | "seo" | "settings";
const tabs: BioTab[] = ["content", "appearance", "social", "domain", "analytics", "seo", "settings"];

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}

function requestMessage(error: unknown, c: Copy): RequestMessage | null {
  if (!(error instanceof ApiError)) return null;
  const detail = errorMessage(error).toLowerCase();
  if (error.status === 403 || /forbidden|无权|permission/.test(detail)) return [c("Permission denied", "没有操作权限"), c("Your current workspace role cannot perform this profile-page action.", "你当前的工作区角色无权执行该个人主页操作。")];
  if (error.status === 429) return [c("Too many requests", "操作过于频繁"), c("Wait a moment and try again.", "请求过于频繁，请稍后再试。")];
  if (error.status === 402 || error.status === 409 || (error.status === 422 && /(quota|limit|额度|套餐)/.test(detail))) return [c("Profile-page allowance reached", "个人主页额度不足"), c("This workspace has reached its current profile-page allowance.", "当前工作区的个人主页额度不足。")];
  if (error.status === 503) return [c("Profile-page service unavailable", "个人主页服务暂时不可用"), c("The service cannot complete this request right now. Try again later.", "个人主页服务当前无法完成请求，请稍后重试。")];
  return null;
}

function statusTone(status: BioPageStatus): "success" | "warning" | "neutral" { return status === "published" ? "success" : status === "paused" ? "warning" : "neutral"; }
function statusLabel(status: BioPageStatus, c: Copy) { return ({ draft: c("Draft", "草稿"), published: c("Published", "已发布"), paused: c("Paused", "已暂停") } as Record<BioPageStatus, string>)[status]; }
function themeValue(theme: BioTheme, key: keyof BioTheme, fallback: string) { return theme[key] || fallback; }
function safeURL(value: string) { try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null; } catch { return null; } }
function tabLabel(tab: BioTab, c: Copy) { return ({ content: c("Content", "内容"), appearance: c("Appearance", "外观"), social: c("Social", "社交"), domain: c("Domain", "域名"), analytics: c("Analytics", "访问分析"), seo: "SEO", settings: c("Settings", "设置") } as Record<BioTab, string>)[tab]; }

function PhonePreview({ title, bio, theme, blocks, c }: { title: string; bio: string; theme: BioTheme; blocks: BioBlock[]; c: Copy }) {
  const primary = themeValue(theme, "Primary", DEFAULT_BIO_THEME.Primary);
  const background = themeValue(theme, "Background", DEFAULT_BIO_THEME.Background);
  const ink = themeValue(theme, "Ink", DEFAULT_BIO_THEME.Ink ?? fallbackInk);
  const surface = themeValue(theme, "Surface", DEFAULT_BIO_THEME.Surface ?? fallbackSurface);
  return <div className="bio-phone-shell" aria-label={c("Profile live phone preview", "个人主页手机实时预览")}>
    <div className="bio-phone-speaker" aria-hidden="true" />
    <div className="bio-phone-screen" style={{ background, color: ink }}>
      <div className="bio-preview-avatar" style={{ background: primary }}>{(title.trim()[0] ?? "G").toUpperCase()}</div>
      <strong>{title || c("Your page title", "你的主页标题")}</strong>
      <p>{bio || c("Add a short introduction for your public page.", "为公开主页添加一段简短介绍。")}</p>
      <div className="bio-preview-links">
        {blocks.length ? blocks.map((block, index) => { const href = safeURL(block.URL); return href ? <a key={`${index}-${block.Label}`} href={href} target="_blank" rel="noreferrer nofollow" style={{ background: surface, borderColor: primary }}>{block.Label || c("Untitled link", "未命名链接")}</a> : <span key={`${index}-${block.Label}`} style={{ background: surface }}>{block.Label || c("Invalid link", "无效链接")}</span>; }) : <span className="bio-preview-empty">{c("Links appear here", "链接会显示在这里")}</span>}
      </div>
    </div>
  </div>;
}

function MiniPhone({ item }: { item: BioPageRecord }) {
  return <div className="bio-mini-phone" aria-hidden="true" style={{ background: themeValue(item.theme, "Background", DEFAULT_BIO_THEME.Background) }}><span style={{ background: themeValue(item.theme, "Primary", DEFAULT_BIO_THEME.Primary) }}>{(item.title[0] ?? "G").toUpperCase()}</span><i/><i/><i/></div>;
}

function CreateBioForm({ workspaceId, canEdit, c }: { workspaceId: number; canEdit: boolean; c: Copy }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(""); const [bio, setBio] = useState(""); const [slug, setSlug] = useState("");
  const mutation = useMutation({ mutationFn: () => bioClient.create(workspaceId, { title: title.trim(), bio: bio.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}), status: "draft", theme: DEFAULT_BIO_THEME, blocks: [] }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["bio-pages", workspaceId] }); setTitle(""); setBio(""); setSlug(""); } });
  const message = requestMessage(mutation.error, c);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit && title.trim()) mutation.mutate(); };
  return <form className="resource-create-form bio-create-form" onSubmit={submit} data-bio-create-form>
    {message ? <Alert tone="danger" title={message[0]}>{message[1]}</Alert> : mutation.isError ? <Alert tone="danger" title={c("Could not create profile page", "个人主页创建失败")}>{errorMessage(mutation.error)}</Alert> : null}
    {mutation.isSuccess ? <Alert tone="info" title={c("Profile page created", "个人主页已创建")}>{c("The new draft has been saved and the page list has been refreshed.", "新草稿已经保存，主页列表已刷新。")}</Alert> : null}
    <Field label={c("Page title", "主页标题")} htmlFor="bio-create-title" required><Input id="bio-create-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></Field>
    <Field label={c("Introduction", "简介")} htmlFor="bio-create-copy" help={c("Optional. Add a short introduction for visitors.", "可选；填写一段面向访客的简短介绍。") }><Textarea id="bio-create-copy" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2000} rows={5} /></Field>
    <Field label={c("Public slug", "公开短码")} htmlFor="bio-create-slug" help={c("Optional. Leave blank to generate one automatically.", "可选；留空时自动生成。") }><Input id="bio-create-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder={c("your-name", "your-name")} /></Field>
    <div className="resource-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!canEdit || !title.trim()}>{c("Create profile page", "创建个人主页")}</Button></div>
  </form>;
}

function BioBuilder({ item, workspaceId, canEdit, onDeleted, c }: { item: BioPageRecord; workspaceId: number; canEdit: boolean; onDeleted: () => void; c: Copy }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<BioTab>("content"); const [title, setTitle] = useState(item.title); const [bio, setBio] = useState(item.bio); const [status, setStatus] = useState<BioPageStatus>(item.status); const [primary, setPrimary] = useState(themeValue(item.theme, "Primary", DEFAULT_BIO_THEME.Primary)); const [background, setBackground] = useState(themeValue(item.theme, "Background", DEFAULT_BIO_THEME.Background)); const [blocks, setBlocks] = useState<BioBlock[]>(item.blocks ?? []);
  const theme = useMemo<BioTheme>(() => ({ ...DEFAULT_BIO_THEME, ...item.theme, Primary: primary, Background: background }), [item.theme, primary, background]);
  const input = useMemo<BioPageInput>(() => ({ title: title.trim(), bio, status, theme, blocks }), [title, bio, status, theme, blocks]);
  const update = useMutation({ mutationFn: () => bioClient.update(workspaceId, item.id, input), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["bio-pages", workspaceId] }); } });
  const remove = useMutation({ mutationFn: () => bioClient.delete(workspaceId, item.id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["bio-pages", workspaceId] }); onDeleted(); } });
  const message = requestMessage(update.error ?? remove.error, c);
  const save = () => { if (canEdit && title.trim()) update.mutate(); };
  const changeBlock = (index: number, patch: Partial<BioBlock>) => setBlocks((current) => current.map((block, position) => position === index ? { ...block, ...patch } : block));
  const removeBlock = (index: number) => setBlocks((current) => current.filter((_, position) => position !== index));
  const addBlock = (label = "", URL = "") => setBlocks((current) => current.length >= 50 ? current : [...current, { Label: label, URL }]);

  return <section className="resource-section bio-builder-section" data-bio-builder>
    <div className="resource-detail-head"><div><span className="resource-eyebrow">{c("PROFILE BUILDER", "个人主页编辑器")}</span><h2>{item.title}</h2><p>{bioClient.publicUrl(item.slug)}</p></div><Badge tone={statusTone(item.status)}>{statusLabel(item.status, c)}</Badge></div>
    {!canEdit ? <Alert tone="warning" title={c("Read-only profile pages", "个人主页只读")}>{c("Your current workspace role can review this page but cannot save changes.", "你当前的工作区角色可以查看此主页，但不能保存修改。")}</Alert> : null}
    {message ? <Alert tone="danger" title={message[0]}>{message[1]}</Alert> : update.isError ? <Alert tone="danger" title={c("Could not save changes", "无法保存修改")}>{errorMessage(update.error)}</Alert> : remove.isError ? <Alert tone="danger" title={c("Could not delete profile page", "无法删除个人主页")}>{errorMessage(remove.error)}</Alert> : null}
    {update.isSuccess ? <Alert tone="info" title={c("Saved", "已保存")}>{c("The latest page settings have been saved.", "最新主页设置已经保存。")}</Alert> : null}
    <div className="bio-builder-grid">
      <div className="bio-builder-controls">
        <div className="bio-tabs" role="tablist" aria-label={c("Profile builder sections", "个人主页编辑分区")}>
          {tabs.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? "is-active" : ""} onClick={() => setTab(name)}>{tabLabel(name, c)}</button>)}
        </div>
        <div className="bio-tab-panel" role="tabpanel">
          {tab === "content" ? <div className="bio-control-stack">
            <Field label={c("Page title", "主页标题")} htmlFor={`bio-title-${item.id}`} required><Input id={`bio-title-${item.id}`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={!canEdit}/></Field>
            <Field label={c("Introduction", "简介")} htmlFor={`bio-copy-${item.id}`}><Textarea id={`bio-copy-${item.id}`} value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2000} rows={5} disabled={!canEdit}/></Field>
            <div className="bio-block-list"><div className="bio-control-head"><strong>{c("Links", "链接")}</strong><Button type="button" size="sm" onClick={() => addBlock()} disabled={!canEdit || blocks.length >= 50}>{c("Add link", "添加链接")}</Button></div>{blocks.length ? blocks.map((block, index) => <div className="bio-block-editor" key={`${index}-${block.Label}`}><Input aria-label={c(`Link ${index + 1} label`, `链接 ${index + 1} 名称`)} value={block.Label} maxLength={120} disabled={!canEdit} onChange={(event) => changeBlock(index, { Label: event.target.value })} placeholder={c("Label", "名称")}/><Input aria-label={c(`Link ${index + 1} URL`, `链接 ${index + 1} 地址`)} value={block.URL} disabled={!canEdit} onChange={(event) => changeBlock(index, { URL: event.target.value })} placeholder="https://example.com"/><Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(index)} disabled={!canEdit}>{c("Remove", "移除")}</Button></div>) : <p className="bio-muted-copy">{c("No links yet. Add the destinations you want visitors to see.", "还没有链接。添加希望访客看到的目标地址。")}</p>}</div>
          </div> : null}
          {tab === "appearance" ? <div className="bio-control-stack"><Field label={c("Primary color", "主色")} htmlFor={`bio-primary-${item.id}`}><Input id={`bio-primary-${item.id}`} type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} disabled={!canEdit}/></Field><Field label={c("Background color", "背景色")} htmlFor={`bio-background-${item.id}`}><Input id={`bio-background-${item.id}`} type="color" value={background} onChange={(event) => setBackground(event.target.value)} disabled={!canEdit}/></Field><p className="bio-muted-copy">{c("The preview updates immediately while you choose page colors.", "选择主页颜色时，右侧预览会立即更新。")}</p></div> : null}
          {tab === "social" ? <div className="bio-control-stack"><h3>{c("Social links", "社交链接")}</h3><p className="bio-muted-copy">{c("Add common social destinations to the same ordered link list shown on your public page.", "把常用社交平台添加到公开主页使用的同一链接列表中。")}</p><div className="resource-actions"><Button type="button" size="sm" onClick={() => addBlock("GitHub", "https://github.com/")} disabled={!canEdit}>{c("GitHub", "GitHub")}</Button><Button type="button" size="sm" onClick={() => addBlock("X", "https://x.com/")} disabled={!canEdit}>{c("X", "X")}</Button><Button type="button" size="sm" onClick={() => addBlock("LinkedIn", "https://www.linkedin.com/")} disabled={!canEdit}>{c("LinkedIn", "LinkedIn")}</Button></div></div> : null}
          {tab === "domain" ? <div className="bio-control-stack"><h3>{c("Public address", "公开地址")}</h3><a className="resource-download-link" href={bioClient.publicUrl(item.slug)} target="_blank" rel="noreferrer">{bioClient.publicUrl(item.slug)}</a><p className="bio-muted-copy">{c("Verified domains are managed centrally for your workspace.", "已验证域名由工作区统一管理。")}</p><a className="resource-download-link" href="/app/domains">{c("Manage domains", "管理域名")}</a></div> : null}
          {tab === "analytics" ? <div className="bio-control-stack"><h3>{c("Page analytics", "主页访问数据")}</h3><div className="bio-metric"><strong>{item.views}</strong><span>{c("views", "次访问")}</span></div><p className="bio-muted-copy">{c("This total reflects recorded visits to the published page.", "这里显示已记录的公开主页访问次数。")}</p><a className="resource-download-link" href="/app/analytics">{c("Open Analytics", "打开访问分析")}</a></div> : null}
          {tab === "seo" ? <div className="bio-control-stack"><Alert tone="info" title={c("Search indexing is disabled", "搜索引擎收录已关闭")}>{c("Public profile pages are excluded from search indexing by default to protect user-generated content.", "公开个人主页默认不允许搜索引擎收录，以保护用户生成内容。")}</Alert><p className="bio-muted-copy">{c("This safety setting is applied automatically to public profile pages.", "这项安全设置会自动应用到公开个人主页。")}</p></div> : null}
          {tab === "settings" ? <div className="bio-control-stack"><Field label={c("Publishing status", "发布状态")} htmlFor={`bio-status-${item.id}`}><Select id={`bio-status-${item.id}`} value={status} onChange={(event) => setStatus(event.target.value as BioPageStatus)} disabled={!canEdit}><option value="draft">{c("Draft", "草稿")}</option><option value="published">{c("Published", "已发布")}</option><option value="paused">{c("Paused", "已暂停")}</option></Select></Field><p className="bio-muted-copy">{c("Only published pages are available from their public address.", "只有已发布主页可以通过公开地址访问。")}</p><div className="resource-actions">{canEdit ? <Button type="button" onClick={save} loading={update.isPending}>{c("Save settings", "保存设置")}</Button> : null}{canEdit ? <AlertDialog triggerLabel={c("Delete profile page", "删除个人主页")} title={c("Delete this profile page?", "删除这个个人主页？")} description={c("Its public address will stop working after deletion.", "删除后，这个公开主页地址将停止访问。") } confirmLabel={c("Delete", "确认删除")} onConfirm={() => remove.mutate()}/> : null}</div></div> : null}
        </div>
        {tab !== "settings" && canEdit ? <div className="bio-builder-save"><Button type="button" onClick={save} loading={update.isPending} disabled={!title.trim()}>{c("Save changes", "保存修改")}</Button></div> : null}
      </div>
      <div className="bio-builder-preview"><span className="resource-eyebrow">{c("LIVE PREVIEW", "实时预览")}</span><PhonePreview title={title} bio={bio} theme={theme} blocks={blocks} c={c}/></div>
    </div>
  </section>;
}

export default function BioPageV503() {
  const { locale } = useLocale(); const c: Copy = (en, cn) => locale === "zh-CN" ? cn : en;
  const { workspaces, workspace } = useWorkspace(); const [selectedId, setSelectedId] = useState<number | null>(null); const workspaceId = workspace?.id;
  const pages = useQuery({ queryKey: ["bio-pages", workspaceId], queryFn: () => bioClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  if (workspaces.isPending) return <Page className="resources-page"><div className="resources-centered"><Spinner label={c("Loading workspace", "正在读取工作区")}/></div></Page>;
  if (workspaces.isError) return <Page className="resources-page"><ErrorState title={c("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>{c("Retry", "重试")}</Button>}/></Page>;
  if (!workspace) return <Page className="resources-page"><EmptyState title={c("No workspace", "还没有工作区")} description={c("Create or join a workspace before managing profile pages.", "创建或加入工作区后才能管理个人主页。")}/></Page>;
  const access = resourceAccess(workspace.role); const rows = pages.data?.data ?? []; const selected = rows.find((item) => item.id === selectedId) ?? null; const listMessage = requestMessage(pages.error, c);
  return <Page className="resources-page" data-v503-bio data-p11-bio>
    <PageHeader title={c("Profile pages", "个人主页")} description={c(`Build and manage public profile pages with live preview in ${workspace.name}.`, `在 ${workspace.name} 中通过实时预览创建和管理公开个人主页。`)} actions={access.can_edit ? <SideSheet triggerLabel={c("New profile page", "新建个人主页")} title={c("Create profile page", "创建个人主页")} description={c("New pages start as drafts so you can finish them before publishing.", "新主页会先保存为草稿，完善后再发布。") }><CreateBioForm workspaceId={workspace.id} canEdit={access.can_edit} c={c}/></SideSheet> : undefined}/>
    {!access.can_edit ? <Alert tone="warning" title={c("Read-only profile pages", "个人主页只读")}>{c(`Your current workspace role is ${workspace.role}. You can review pages and their public state, but cannot create, edit or delete them.`, `当前工作区角色为 ${workspace.role}。你可以查看个人主页和公开状态，但不能创建、编辑或删除。`)}</Alert> : null}
    <section className="resource-summary-grid" aria-label={c("Profile-page summary", "个人主页概况")}><article><span>{c("Pages", "主页数量")}</span><strong>{rows.length}</strong><small>{c("Saved in this workspace", "当前工作区已保存")}</small></article><article><span>{c("Views", "访问次数")}</span><strong>{rows.reduce((sum, item) => sum + item.views, 0)}</strong><small>{c("Recorded visits", "已记录访问")}</small></article><article><span>{c("Published", "已发布")}</span><strong>{rows.filter((item) => item.status === "published").length}</strong><small>{c("Public pages", "公开主页")}</small></article></section>
    <section className="resource-section" aria-labelledby="bio-list-title"><div className="resource-section-head"><div><span className="resource-eyebrow">{c("PROFILE PAGES", "个人主页")}</span><h2 id="bio-list-title">{c("Your profile pages", "你的个人主页")}</h2><p>{c("Choose a page to edit its content, appearance, links, publishing state and live preview.", "选择一个主页，即可编辑内容、外观、链接和发布状态，并查看实时预览。")}</p></div></div>
      {pages.isPending ? <div className="resources-centered"><Spinner label={c("Loading profile pages", "正在加载个人主页")}/></div> : listMessage ? <ErrorState title={listMessage[0]} description={listMessage[1]} action={<Button type="button" onClick={() => pages.refetch()}>{c("Retry", "重试")}</Button>}/> : pages.isError ? <ErrorState title={c("Unable to load profile pages", "无法加载个人主页")} description={errorMessage(pages.error)} action={<Button type="button" onClick={() => pages.refetch()}>{c("Retry", "重试")}</Button>}/> : rows.length ? <div className="bio-page-list"><div className="bio-page-head" aria-hidden="true"><span>{c("Preview", "预览")}</span><span>{c("Title", "标题")}</span><span>{c("Address", "地址")}</span><span>{c("Views", "访问")}</span><span>{c("Status", "状态")}</span></div>{rows.map((item) => <button key={item.id} type="button" className="bio-page-row" data-bio-id={item.id} onClick={() => setSelectedId(item.id)}><span><MiniPhone item={item}/></span><span><strong>{item.title}</strong><small>{item.bio || c("No introduction", "暂无简介")}</small></span><span>/p/{item.slug}</span><span>{item.views}</span><span><Badge tone={statusTone(item.status)}>{statusLabel(item.status, c)}</Badge></span></button>)}</div> : <EmptyState title={c("No profile pages", "还没有个人主页")} description={access.can_edit ? c("Create a draft to start building your public profile page.", "创建一个草稿，开始制作公开个人主页。") : c("This workspace does not have any profile pages yet.", "当前工作区还没有个人主页。")}/>} 
    </section>
    {selected ? <BioBuilder key={`${selected.id}-${selected.created_at ?? ""}`} item={selected} workspaceId={workspace.id} canEdit={access.can_edit} onDeleted={() => setSelectedId(null)} c={c}/> : null}
  </Page>;
}
