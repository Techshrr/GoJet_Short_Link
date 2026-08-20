import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createWorkspaceClient, type WorkspaceCampaignRecord, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, useLocale } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const workspaceClient = createWorkspaceClient(api);
const tagPalette = [
  { en: "Blue", zh: "蓝色", value: "#" + "2563eb", swatch: "var(--brand-blue)" },
  { en: "Cyan", zh: "青色", value: "#" + "06b6d4", swatch: "var(--brand-cyan)" },
  { en: "Sky", zh: "天蓝", value: "#" + "38bdf8", swatch: "var(--brand-sky)" },
  { en: "Green", zh: "绿色", value: "#" + "16a34a", swatch: "var(--success)" },
  { en: "Amber", zh: "琥珀", value: "#" + "d97706", swatch: "var(--warning)" },
  { en: "Red", zh: "红色", value: "#" + "dc2626", swatch: "var(--danger)" },
  { en: "Ink", zh: "墨色", value: "#" + "0b1220", swatch: "var(--brand-ink)" }
] as const;
type Copy = (en: string, zh: string) => string;

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}

function CreateOrganizationItem({ workspaceId, type, onDone, c }: { workspaceId: number; type: "campaign" | "folder" | "tag"; onDone: () => void; c: Copy }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(tagPalette[0].value);
  const mutation = useMutation({
    mutationFn: () => type === "campaign" ? workspaceClient.createCampaign(workspaceId, name.trim()) : type === "folder" ? workspaceClient.createFolder(workspaceId, name.trim()) : workspaceClient.createTag(workspaceId, name.trim(), color),
    onSuccess: () => { setName(""); onDone(); }
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim()) mutation.mutate(); };
  const typeLabel = type === "campaign" ? c("campaign", "推广活动") : type === "folder" ? c("folder", "文件夹") : c("tag", "标签");
  return <form className="organization-create-form" onSubmit={submit}>
    {mutation.isError ? <Alert tone="danger" title={c(`Unable to create ${typeLabel}`, `无法创建${typeLabel}`)}>{errorMessage(mutation.error)}</Alert> : null}
    <Field label={c("Name", "名称")} htmlFor={`organization-${type}-name`} required><Input id={`organization-${type}-name`} value={name} onChange={(event) => setName(event.target.value)} required /></Field>
    {type === "tag" ? <Field label={c("Color", "颜色")} htmlFor="organization-tag-color-blue" help={c("Choose a GoJet palette color so tags remain consistent across the workspace.", "从 GoJet 预设色板中选择颜色，让工作区中的标签保持一致。") }><div className="organization-tag-palette" role="radiogroup" aria-label={c("Tag color palette", "标签颜色色板")}>{tagPalette.map((item) => <button id={`organization-tag-color-${item.en.toLowerCase()}`} key={item.en} type="button" role="radio" aria-checked={color === item.value} className="organization-tag-color" onClick={() => setColor(item.value)}><span className="organization-tag-swatch" style={{ backgroundColor: item.swatch }} aria-hidden="true" /><span>{c(item.en, item.zh)}</span></button>)}</div></Field> : null}
    <Button type="submit" loading={mutation.isPending} disabled={!name.trim()}>{c(`Create ${typeLabel}`, `创建${typeLabel}`)}</Button>
  </form>;
}

function CampaignCard({ item, workspaceId, canEdit, onDone, c }: { item: WorkspaceCampaignRecord; workspaceId: number; canEdit: boolean; onDone: () => void; c: Copy }) {
  const mutation = useMutation({ mutationFn: (status: WorkspaceCampaignRecord["status"]) => workspaceClient.updateCampaignStatus(workspaceId, item.id, status), onSuccess: onDone });
  const statusLabel = item.status === "active" ? c("Active", "进行中") : item.status === "paused" ? c("Paused", "已暂停") : item.status === "completed" ? c("Completed", "已完成") : item.status;
  return <article className="organization-card">
    <div className="organization-card-head"><div><span>{c("Campaign", "推广活动")}</span><h3>{item.name}</h3></div><Badge tone={item.status === "active" ? "success" : item.status === "paused" ? "warning" : "neutral"}>{statusLabel}</Badge></div>
    <dl className="organization-metrics"><div><dt>{c("Links", "短链接")}</dt><dd>{item.links}</dd></div><div><dt>{c("Clicks", "访问次数")}</dt><dd>{item.clicks}</dd></div><div><dt>{c("Conversions", "转化次数")}</dt><dd>{item.conversions}</dd></div></dl>
    {canEdit ? <Field label={c("Status", "状态")} htmlFor={`campaign-status-${item.id}`}><Select id={`campaign-status-${item.id}`} value={item.status} disabled={mutation.isPending} onChange={(event) => mutation.mutate(event.target.value as WorkspaceCampaignRecord["status"])}><option value="active">{c("Active", "进行中")}</option><option value="paused">{c("Paused", "已暂停")}</option><option value="completed">{c("Completed", "已完成")}</option></Select></Field> : null}
    {mutation.isError ? <Alert tone="danger" title={c("Campaign update failed", "推广活动更新失败")}>{errorMessage(mutation.error)}</Alert> : null}
  </article>;
}

export default function OrganizationPage() {
  const { locale } = useLocale();
  const c: Copy = (en, cn) => locale === "zh-CN" ? cn : en;
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const organization = useQuery({ queryKey: ["workspace-organization", workspaceId], queryFn: () => workspaceClient.organization(workspaceId!), enabled: Boolean(workspaceId) });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["workspace-organization", workspaceId] });

  if (workspaces.isPending) return <Page className="organization-page"><div className="workspace-centered"><Spinner label={c("Loading workspace", "正在读取工作区")} /></div></Page>;
  if (workspaces.isError) return <Page className="organization-page"><ErrorState title={c("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>{c("Retry", "重试")}</Button>} /></Page>;
  if (!workspace) return <Page className="organization-page"><EmptyState title={c("No workspace yet", "还没有工作区")} description={c("Create or join a workspace before organizing link resources.", "创建或加入工作区后才能整理短链接资源。")}/></Page>;

  const canEdit = workspace.role === "owner" || workspace.role === "admin" || workspace.role === "editor";
  const data = organization.data;
  return <Page className="organization-page" data-p12-organization>
    <PageHeader title={c("Organization", "资源整理")} description={c(`Campaigns, folders and tags · ${workspace.name}`, `推广活动、文件夹与标签 · ${workspace.name}`)} />
    {!canEdit ? <Alert tone="warning" title={c("Read-only organization access", "资源整理只读")}>{c(`Your current role is ${workspace.role}. You can review organization data but cannot create or change it.`, `你当前的角色为 ${workspace.role}。可以查看资源整理信息，但不能创建或修改。`)}</Alert> : null}
    {organization.isPending ? <div className="workspace-centered"><Spinner label={c("Loading organization", "正在加载资源整理信息")} /></div> : organization.isError ? <ErrorState title={c("Unable to load organization", "无法加载资源整理信息")} description={errorMessage(organization.error)} action={<Button type="button" onClick={() => organization.refetch()}>{c("Retry", "重试")}</Button>} /> : <div className="organization-stack">
      <section className="workspace-section" aria-labelledby="campaigns-title"><div className="workspace-section-head"><div><span className="workspace-eyebrow">{c("CAMPAIGNS", "推广活动")}</span><h2 id="campaigns-title">{c("Campaign performance groups", "推广活动分组")}</h2><p>{c("Group related links and review their click and conversion totals together.", "将相关短链接归入同一推广活动，并集中查看访问与转化汇总。")}</p></div>{canEdit ? <SideSheet triggerLabel={c("New campaign", "新建推广活动")} title={c("Create campaign", "创建推广活动")}><CreateOrganizationItem workspaceId={workspace.id} type="campaign" onDone={refresh} c={c} /></SideSheet> : null}</div>{data?.campaigns.length ? <div className="organization-card-grid">{data.campaigns.map((item) => <CampaignCard key={item.id} item={item} workspaceId={workspace.id} canEdit={canEdit} onDone={refresh} c={c} />)}</div> : <EmptyState title={c("No campaigns", "暂无推广活动")} description={c("Create a campaign to group related links and measure them together.", "创建推广活动后，可以归组相关短链接并统一查看表现。")}/>}</section>
      <section className="workspace-section" aria-labelledby="folders-title"><div className="workspace-section-head"><div><span className="workspace-eyebrow">{c("FOLDERS", "文件夹")}</span><h2 id="folders-title">{c("Folders", "文件夹")}</h2><p>{c("Use folders to keep workspace links organized without changing redirect behavior.", "使用文件夹整理工作区中的短链接，不会改变链接的跳转行为。")}</p></div>{canEdit ? <SideSheet triggerLabel={c("New folder", "新建文件夹")} title={c("Create folder", "创建文件夹")}><CreateOrganizationItem workspaceId={workspace.id} type="folder" onDone={refresh} c={c} /></SideSheet> : null}</div>{data?.folders.length ? <div className="organization-list-grid">{data.folders.map((item) => <article key={item.id}><strong>{item.name}</strong><span>{c(`${item.links} links`, `${item.links} 条短链接`)}</span></article>)}</div> : <EmptyState title={c("No folders", "暂无文件夹")} description={c("Create a folder when you need another way to organize links.", "需要进一步整理短链接时，可以创建文件夹。")}/>}</section>
      <section className="workspace-section" aria-labelledby="tags-title"><div className="workspace-section-head"><div><span className="workspace-eyebrow">{c("TAGS", "标签")}</span><h2 id="tags-title">{c("Tags", "标签")}</h2><p>{c("Use consistent colors and names to make link groups easier to scan and filter.", "使用统一的颜色和名称，让短链接分组更容易识别和筛选。")}</p></div>{canEdit ? <SideSheet triggerLabel={c("New tag", "新建标签")} title={c("Create tag", "创建标签")}><CreateOrganizationItem workspaceId={workspace.id} type="tag" onDone={refresh} c={c} /></SideSheet> : null}</div>{data?.tags.length ? <div className="organization-list-grid">{data.tags.map((item) => <article key={item.id}><span className="organization-tag-dot" style={{ backgroundColor: item.color }} aria-hidden="true" /><strong>{item.name}</strong><span>{c(`${item.links} links`, `${item.links} 条短链接`)}</span></article>)}</div> : <EmptyState title={c("No tags", "暂无标签")} description={c("Create a tag to label and filter related links.", "创建标签后，可以标记并筛选相关短链接。")}/>}</section>
    </div>}
  </Page>;
}
