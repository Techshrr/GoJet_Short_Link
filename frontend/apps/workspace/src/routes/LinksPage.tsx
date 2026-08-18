import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkCreateInput, LinkDomainOption, LinkListFilters, LinkRecord, LinkStatus, OrganizationSnapshot, WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Table } from "@gojet/ui";
import { AlertDialog, DropdownMenu, SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

const statusLabels: Record<LinkStatus, string> = { active: "Active", paused: "Paused", expired: "Expired" };

function Status({ value }: { value: LinkStatus }) {
  return <Badge tone={value === "active" ? "success" : value === "paused" ? "warning" : "neutral"}>{statusLabels[value]}</Badge>;
}

function useWorkspace() {
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[])
  });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function CreateLinkForm({ workspaceId, domains, organization }: { workspaceId: number; domains: LinkDomainOption[]; organization: OrganizationSnapshot }) {
  const [destination, setDestination] = useState("");
  const [domain, setDomain] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [oneTime, setOneTime] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (!domain && domains.length > 0) {
      setDomain((domains.find((item) => item.is_default) ?? domains[0])?.hostname ?? "");
    }
  }, [domain, domains]);

  const selectedDomain = domains.find((item) => item.hostname === domain);
  const mutation = useMutation({
    mutationFn: (input: LinkCreateInput) => linksClient.create(workspaceId, input),
    onSuccess: (created) => {
      window.location.assign(`/app/links/${created.id}?workspace=${workspaceId}`);
    }
  });

  const toggleTag = (id: number, checked: boolean) => setTagIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDomain || !destination.trim()) return;
    const input: LinkCreateInput = {
      source: selectedDomain.source,
      destination: destination.trim(),
      domain: selectedDomain.hostname,
      redirect_status: 302,
      one_time: oneTime
    };
    if (code.trim()) input.code = code.trim();
    if (title.trim()) input.title = title.trim();
    if (expiresAt) input.expires_at = new Date(expiresAt).toISOString();
    if (password) input.password = password;
    if (maxClicks) input.max_clicks = Number(maxClicks);
    if (campaignId) input.campaign_id = Number(campaignId);
    if (tagIds.length) input.tag_ids = tagIds;
    mutation.mutate(input);
  };

  return (
    <form className="links-create-form" onSubmit={submit}>
      <div className="links-create-scroll">
        {mutation.isError ? <Alert tone="danger" title="无法创建链接">{errorMessage(mutation.error)}</Alert> : null}
        <Field label="Destination" htmlFor="create-destination" required help="完整的 HTTP(S) 目标地址。">
          <Input id="create-destination" type="url" placeholder="https://example.com/page" value={destination} onChange={(event) => setDestination(event.target.value)} required />
        </Field>
        <Field label="Domain" htmlFor="create-domain" required help={selectedDomain?.source === "official" ? "GoJet 官方短链域名" : "已验证并启用 HTTPS 的自定义域名"}>
          <Select id="create-domain" value={domain} onChange={(event) => setDomain(event.target.value)} required disabled={!domains.length}>
            {!domains.length ? <option value="">暂无可用短链域名</option> : null}
            {domains.map((item) => <option key={`${item.source}-${item.hostname}`} value={item.hostname}>{item.hostname}{item.label ? ` · ${item.label}` : ""}</option>)}
          </Select>
        </Field>
        <div className="links-form-grid">
          <Field label="Code" htmlFor="create-code" help="留空时按系统策略生成。"><Input id="create-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="my-link" minLength={3} maxLength={64} /></Field>
          <Field label="Title" htmlFor="create-title"><Input id="create-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="Campaign landing page" /></Field>
        </div>
        <details className="links-advanced">
          <summary>Advanced settings</summary>
          <div className="links-advanced-body">
            <div className="links-form-grid">
              <Field label="Expiration" htmlFor="create-expiry"><Input id="create-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
              <Field label="Click limit" htmlFor="create-click-limit"><Input id="create-click-limit" type="number" min={1} value={maxClicks} onChange={(event) => setMaxClicks(event.target.value)} placeholder="Unlimited" /></Field>
            </div>
            <Field label="Access password" htmlFor="create-password" help="至少 6 位；明文不会从 API 返回。"><Input id="create-password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>
            <Field label="Campaign" htmlFor="create-campaign"><Select id="create-campaign" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">No campaign</option>{organization.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            {organization.tags.length ? <div className="links-tag-picker"><span className="links-field-label">Tags</span>{organization.tags.map((tag) => <Checkbox key={tag.id} label={tag.name} checked={tagIds.includes(tag.id)} onCheckedChange={(checked) => toggleTag(tag.id, checked)} />)}</div> : null}
            <Checkbox label="One-time link" checked={oneTime} onCheckedChange={setOneTime} />
            <p className="links-muted">Routing 和 A/B Test 在创建后进入链接详情配置，避免首个创建流程过载。</p>
          </div>
        </details>
      </div>
      <div className="links-sheet-footer">
        <span className="links-muted">创建会立即写入 MySQL 并同步 Redis redirect plane。</span>
        <Button type="submit" loading={mutation.isPending} disabled={!selectedDomain || !destination.trim()}>Create link</Button>
      </div>
    </form>
  );
}

export default function LinksPage() {
  const queryClient = useQueryClient();
  const { workspaces, workspace } = useWorkspace();
  const [filters, setFilters] = useState<LinkListFilters>({ limit: 25, offset: 0 });
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkTag, setBulkTag] = useState("");
  const [view, setView] = useState<"table" | "compact">("table");
  const [columns, setColumns] = useState({ destination: true, domain: true, clicks: true, status: true, updated: true });

  const workspaceId = workspace?.id;
  const capabilities = useQuery({ queryKey: ["link-capabilities", workspaceId], queryFn: () => linksClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const domains = useQuery({ queryKey: ["link-domains", workspaceId], queryFn: () => linksClient.domains(workspaceId!), enabled: Boolean(workspaceId) });
  const organization = useQuery({ queryKey: ["link-organization", workspaceId], queryFn: () => linksClient.organization(workspaceId!), enabled: Boolean(workspaceId) });
  const list = useQuery({ queryKey: ["links", workspaceId, filters], queryFn: () => linksClient.list(workspaceId!, filters), enabled: Boolean(workspaceId) });

  const invalidate = async () => {
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: ["links", workspaceId] });
  };
  const statusMutation = useMutation({ mutationFn: ({ ids, status }: { ids: number[]; status: "active" | "paused" }) => linksClient.bulkStatus(workspaceId!, ids, status), onSuccess: invalidate });
  const tagMutation = useMutation({ mutationFn: ({ ids, tagIds }: { ids: number[]; tagIds: number[] }) => linksClient.bulkTags(workspaceId!, ids, tagIds), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: (ids: number[]) => linksClient.bulkDelete(workspaceId!, ids), onSuccess: invalidate });

  const allSelected = Boolean(list.data?.data.length) && list.data?.data.every((item) => selected.includes(item.id));
  const visibleColumns = useMemo(() => Object.entries(columns).filter(([, shown]) => shown).length, [columns]);
  const mutationError = statusMutation.error ?? tagMutation.error ?? deleteMutation.error;

  if (workspaces.isPending) return <Page className="links-page"><div className="links-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="links-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="links-page"><EmptyState title="还没有工作区" description="创建工作区后才能管理短链接。" /></Page>;

  const canEdit = capabilities.data?.can_edit === true;
  const org = organization.data ?? { campaigns: [], folders: [], tags: [] };
  const domainItems = domains.data?.data ?? [];

  return (
    <Page className="links-page" data-p05-links-list>
      <PageHeader title="Links" description={`${list.data?.total ?? 0} links · ${workspace.name}`} actions={canEdit ? <SideSheet triggerLabel="Create link" title="Create link" description="创建真实短链接并立即同步 redirect plane。"><CreateLinkForm workspaceId={workspace.id} domains={domainItems} organization={org} /></SideSheet> : undefined} />

      {capabilities.data && !canEdit ? <Alert tone="warning" title="Read-only workspace">当前角色为 {capabilities.data.role}。你可以查看链接{capabilities.data.can_analytics ? "和分析" : ""}，但不能创建、编辑或执行批量操作。</Alert> : null}
      {mutationError ? <Alert tone="danger" title="批量操作失败">{errorMessage(mutationError)}</Alert> : null}

      <section className="links-toolbar" aria-label="Links filters">
        <Input aria-label="Search links" placeholder="Search links" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, offset: 0 }))} />
        <Select aria-label="Domain filter" value={filters.domain ?? ""} onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value, offset: 0 }))}><option value="">All domains</option>{domainItems.map((item) => <option key={`${item.source}-${item.hostname}`} value={item.hostname}>{item.hostname}</option>)}</Select>
        <Select aria-label="Status filter" value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as LinkStatus | "", offset: 0 }))}><option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="expired">Expired</option></Select>
        <Select aria-label="Campaign filter" value={filters.campaign ?? ""} onChange={(event) => setFilters((current) => ({ ...current, campaign: event.target.value ? Number(event.target.value) : undefined, offset: 0 }))}><option value="">All campaigns</option>{org.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select aria-label="Tag filter" value={filters.tag ?? ""} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value ? Number(event.target.value) : undefined, offset: 0 }))}><option value="">All tags</option>{org.tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Input aria-label="Created from" type="date" value={filters.from ?? ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, offset: 0 }))} />
        <Input aria-label="Created to" type="date" value={filters.to ?? ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, offset: 0 }))} />
        <Select aria-label="View" value={view} onChange={(event) => setView(event.target.value as "table" | "compact")}><option value="table">Table view</option><option value="compact">Compact view</option></Select>
        <details className="links-columns"><summary>Columns · {visibleColumns}</summary><div>{(Object.keys(columns) as Array<keyof typeof columns>).map((key) => <Checkbox key={key} label={key[0].toUpperCase() + key.slice(1)} checked={columns[key]} onCheckedChange={(checked) => setColumns((current) => ({ ...current, [key]: checked }))} />)}</div></details>
      </section>

      {selected.length > 0 && canEdit ? <section className="links-bulk" aria-label="Bulk actions"><strong>{selected.length} selected</strong><Button size="sm" variant="outline" type="button" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ ids: selected, status: "active" })}>Activate</Button><Button size="sm" variant="outline" type="button" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ ids: selected, status: "paused" })}>Pause</Button><Select aria-label="Bulk tag" value={bulkTag} onChange={(event) => setBulkTag(event.target.value)}><option value="">Choose tag</option>{org.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</Select><Button size="sm" variant="outline" type="button" disabled={!bulkTag} loading={tagMutation.isPending} onClick={() => tagMutation.mutate({ ids: selected, tagIds: [Number(bulkTag)] })}>Tag</Button><Button size="sm" variant="outline" type="button" onClick={() => window.location.assign(linksClient.exportUrl(workspace.id, filters))}>Export</Button><AlertDialog triggerLabel="Delete" title="Delete selected links?" description={`将软删除 ${selected.length} 条链接，并立即从 redirect plane 移除。`} confirmLabel="Delete links" onConfirm={() => deleteMutation.mutate(selected)} /></section> : null}

      {list.isPending ? <div className="links-centered"><Spinner label="正在加载链接" /></div> : list.isError ? <ErrorState title="无法加载链接" description={errorMessage(list.error)} action={<Button type="button" onClick={() => list.refetch()}>重试</Button>} /> : list.data.data.length === 0 ? <EmptyState title="No links found" description="当前筛选没有匹配链接。调整筛选条件，或创建第一条链接。" action={Object.keys(filters).some((key) => !["limit", "offset"].includes(key) && Boolean(filters[key as keyof LinkListFilters])) ? <Button variant="outline" type="button" onClick={() => setFilters({ limit: 25, offset: 0 })}>Clear filters</Button> : undefined} /> : <>
        <div className={`links-desktop-table${view === "compact" ? " is-compact" : ""}`}>
          <Table label="Links">
            <thead><tr><th><input type="checkbox" aria-label="Select all links" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? list.data.data.map((item) => item.id) : [])} disabled={!canEdit} /></th><th>Link</th>{columns.destination ? <th>Destination</th> : null}{columns.domain ? <th>Domain</th> : null}{columns.clicks ? <th>Clicks</th> : null}{columns.status ? <th>Status</th> : null}{columns.updated ? <th>Updated</th> : null}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{list.data.data.map((item) => <LinkRow key={item.id} item={item} canEdit={canEdit} selected={selected.includes(item.id)} onSelected={(checked) => setSelected((current) => checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} columns={columns} workspaceId={workspace.id} onDelete={() => deleteMutation.mutate([item.id])} />)}</tbody>
          </Table>
        </div>
        <div className="links-mobile-list">{list.data.data.map((item) => <LinkMobileCard key={item.id} item={item} workspaceId={workspace.id} />)}</div>
        <div className="links-pagination"><span>{list.data.offset + 1}–{Math.min(list.data.offset + list.data.data.length, list.data.total)} of {list.data.total}</span><div><Button size="sm" variant="outline" type="button" disabled={list.data.offset <= 0} onClick={() => setFilters((current) => ({ ...current, offset: Math.max(0, (current.offset ?? 0) - (current.limit ?? 25)) }))}>Previous</Button><Button size="sm" variant="outline" type="button" disabled={list.data.offset + list.data.data.length >= list.data.total} onClick={() => setFilters((current) => ({ ...current, offset: (current.offset ?? 0) + (current.limit ?? 25) }))}>Next</Button></div></div>
      </>}
    </Page>
  );
}

function LinkRow({ item, canEdit, selected, onSelected, columns, workspaceId, onDelete }: { item: LinkRecord; canEdit: boolean; selected: boolean; onSelected: (checked: boolean) => void; columns: { destination: boolean; domain: boolean; clicks: boolean; status: boolean; updated: boolean }; workspaceId: number; onDelete: () => void }) {
  const href = `/app/links/${item.id}?workspace=${workspaceId}`;
  return <tr><td><input type="checkbox" aria-label={`Select ${item.code}`} checked={selected} onChange={(event) => onSelected(event.target.checked)} disabled={!canEdit} /></td><td><div className="links-identity"><span className="links-favicon" aria-hidden="true">↗</span><div><a className="links-short-url" href={href}>{shortUrl(item.domain, item.code)}</a><span>{item.title || "Untitled link"}</span></div></div></td>{columns.destination ? <td><span className="links-destination" title={item.destination}>{item.destination}</span></td> : null}{columns.domain ? <td>{item.domain || "Default"}</td> : null}{columns.clicks ? <td>{item.clicks ?? 0}</td> : null}{columns.status ? <td><Status value={item.status} /></td> : null}{columns.updated ? <td>{formatDate(item.updated_at ?? item.created_at)}</td> : null}<td><DropdownMenu actions={[{ id: "open", label: "Open details", onSelect: () => window.location.assign(href) }, { id: "visit", label: "Visit short URL", onSelect: () => window.open(shortUrl(item.domain, item.code), "_blank", "noopener,noreferrer") }, { id: "delete", label: "Delete", destructive: true, disabled: !canEdit, separatorBefore: true, onSelect: onDelete }]} /></td></tr>;
}

function LinkMobileCard({ item, workspaceId }: { item: LinkRecord; workspaceId: number }) {
  return <a className="links-mobile-card" href={`/app/links/${item.id}?workspace=${workspaceId}`}><div><strong>{shortUrl(item.domain, item.code)}</strong><span>{item.title || "Untitled link"}</span></div><div><Status value={item.status} /><span>{item.clicks ?? 0} clicks</span></div></a>;
}
