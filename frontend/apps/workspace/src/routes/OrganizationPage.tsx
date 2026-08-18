import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createWorkspaceClient, type CampaignRecord, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const workspaceClient = createWorkspaceClient(api);

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}

function CreateOrganizationItem({ workspaceId, type, onDone }: { workspaceId: number; type: "campaign" | "folder" | "tag"; onDone: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const mutation = useMutation({
    mutationFn: () => type === "campaign" ? workspaceClient.createCampaign(workspaceId, name.trim()) : type === "folder" ? workspaceClient.createFolder(workspaceId, name.trim()) : workspaceClient.createTag(workspaceId, name.trim(), color),
    onSuccess: () => { setName(""); onDone(); }
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim()) mutation.mutate(); };
  return <form className="organization-create-form" onSubmit={submit}>
    {mutation.isError ? <Alert tone="danger" title={`Unable to create ${type}`}>{errorMessage(mutation.error)}</Alert> : null}
    <Field label="Name" htmlFor={`organization-${type}-name`} required><Input id={`organization-${type}-name`} value={name} onChange={(event) => setName(event.target.value)} required /></Field>
    {type === "tag" ? <Field label="Color" htmlFor="organization-tag-color" help="Server accepts canonical #RRGGBB values only."><Input id="organization-tag-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></Field> : null}
    <Button type="submit" loading={mutation.isPending} disabled={!name.trim()}>Create {type}</Button>
  </form>;
}

function CampaignCard({ item, workspaceId, canEdit, onDone }: { item: CampaignRecord; workspaceId: number; canEdit: boolean; onDone: () => void }) {
  const mutation = useMutation({ mutationFn: (status: CampaignRecord["status"]) => workspaceClient.updateCampaignStatus(workspaceId, item.id, status), onSuccess: onDone });
  return <article className="organization-card">
    <div className="organization-card-head"><div><span>Campaign</span><h3>{item.name}</h3></div><Badge tone={item.status === "active" ? "success" : item.status === "paused" ? "warning" : "neutral"}>{item.status}</Badge></div>
    <dl className="organization-metrics"><div><dt>Links</dt><dd>{item.links}</dd></div><div><dt>Clicks</dt><dd>{item.clicks}</dd></div><div><dt>Conversions</dt><dd>{item.conversions}</dd></div></dl>
    {canEdit ? <Field label="Status" htmlFor={`campaign-status-${item.id}`}><Select id={`campaign-status-${item.id}`} value={item.status} disabled={mutation.isPending} onChange={(event) => mutation.mutate(event.target.value as CampaignRecord["status"])}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></Select></Field> : null}
    {mutation.isError ? <Alert tone="danger" title="Campaign update failed">{errorMessage(mutation.error)}</Alert> : null}
  </article>;
}

export default function OrganizationPage() {
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const organization = useQuery({ queryKey: ["workspace-organization", workspaceId], queryFn: () => workspaceClient.organization(workspaceId!), enabled: Boolean(workspaceId) });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["workspace-organization", workspaceId] });

  if (workspaces.isPending) return <Page className="organization-page"><div className="workspace-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="organization-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="organization-page"><EmptyState title="还没有工作区" description="创建工作区后才能组织链接资源。" /></Page>;

  const canEdit = workspace.role === "owner" || workspace.role === "admin" || workspace.role === "editor";
  const data = organization.data;
  return <Page className="organization-page" data-p12-organization>
    <PageHeader title="Organization" description={`Campaigns, folders & tags · ${workspace.name}`} />
    {!canEdit ? <Alert tone="warning" title="Read-only organization access">当前角色为 {workspace.role}。服务端只允许具备 edit 权限的角色创建或修改组织资源。</Alert> : null}
    {organization.isPending ? <div className="workspace-centered"><Spinner label="正在加载组织资源" /></div> : organization.isError ? <ErrorState title="无法加载组织资源" description={errorMessage(organization.error)} action={<Button type="button" onClick={() => organization.refetch()}>重试</Button>} /> : <div className="organization-stack">
      <section className="workspace-section" aria-labelledby="campaigns-title"><div className="workspace-section-head"><div><span className="workspace-eyebrow">CAMPAIGNS</span><h2 id="campaigns-title">Campaign performance groups</h2><p>Campaign 的 links、clicks 与 conversion 均来自服务端实时组织快照。</p></div>{canEdit ? <SideSheet triggerLabel="New campaign" title="Create campaign"><CreateOrganizationItem workspaceId={workspace.id} type="campaign" onDone={refresh} /></SideSheet> : null}</div>{data?.campaigns.length ? <div className="organization-card-grid">{data.campaigns.map((item) => <CampaignCard key={item.id} item={item} workspaceId={workspace.id} canEdit={canEdit} onDone={refresh} />)}</div> : <EmptyState title="No campaigns" description="创建 Campaign 后可在 Links 中归组并汇总点击与转化。" />}</section>
      <section className="workspace-section" aria-labelledby="folders-title"><div className="workspace-section-head"><div><span className="workspace-eyebrow">FOLDERS</span><h2 id="folders-title">Folders</h2><p>Folders 用于工作区内部结构化归档，不改变短链跳转行为。</p></div>{canEdit ? <SideSheet triggerLabel="New folder" title="Create folder"><CreateOrganizationItem workspaceId={workspace.id} type="folder" onDone={refresh} /></SideSheet> : null}</div>{data?.folders.length ? <div className="organization-list-grid">{data.folders.map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.links} links</span></article>)}</div> : <EmptyState title="No folders" description="当前没有 Folder。" />}</section>
      <section className="workspace-section" aria-labelledby="tags-title"><div className="workspace-section-head"><div><span className="workspace-eyebrow">TAGS</span><h2 id="tags-title">Tags</h2><p>Tag 颜色由服务端验证为 #RRGGBB，避免前端产生不可持久化的视觉值。</p></div>{canEdit ? <SideSheet triggerLabel="New tag" title="Create tag"><CreateOrganizationItem workspaceId={workspace.id} type="tag" onDone={refresh} /></SideSheet> : null}</div>{data?.tags.length ? <div className="organization-list-grid">{data.tags.map((item) => <article key={item.id}><span className="organization-tag-dot" style={{ backgroundColor: item.color }} aria-hidden="true" /><strong>{item.name}</strong><span>{item.links} links</span></article>)}</div> : <EmptyState title="No tags" description="当前没有 Tag。" />}</section>
    </div>}
  </Page>;
}
