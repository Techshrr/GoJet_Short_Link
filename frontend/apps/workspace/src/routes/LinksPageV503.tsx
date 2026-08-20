import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkCreateInput, LinkDomainOption, LinkListFilters, LinkRecord, LinkRiskPresentation, LinkStatus, OrganizationSnapshot, WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Table, useLocale } from "@gojet/ui";
import { AlertDialog, DropdownMenu, SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

type Copy = (en: string, zh: string) => string;
type CustomerState = "active" | "review" | "blocked" | "paused" | "expired" | "unavailable";

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function customerState(item: LinkRecord, risk: LinkRiskPresentation | undefined, riskLoaded: boolean, riskFailed: boolean): CustomerState {
  if (item.status === "paused") return "paused";
  if (item.status === "expired") return "expired";
  if (riskFailed) return "unavailable";
  if (!riskLoaded || !risk || risk.pending || risk.effective_decision === "review") return "review";
  if (risk.effective_decision === "block") return "blocked";
  return "active";
}

function CustomerStatus({ state, c }: { state: CustomerState; c: Copy }) {
  const labels: Record<CustomerState, string> = {
    active: c("Active", "正常"), review: c("Safety review", "安全审核中"), blocked: c("Blocked", "已阻止"), paused: c("Paused", "已暂停"), expired: c("Expired", "已过期"), unavailable: c("Status unavailable", "安全状态不可用")
  };
  const tones: Record<CustomerState, "success" | "warning" | "danger" | "neutral"> = { active: "success", review: "warning", blocked: "danger", paused: "warning", expired: "neutral", unavailable: "danger" };
  return <Badge tone={tones[state]}>{labels[state]}</Badge>;
}

function CreateLinkForm({ workspaceId, domains, organization, c }: { workspaceId: number; domains: LinkDomainOption[]; organization: OrganizationSnapshot; c: Copy }) {
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
    if (!domain && domains.length > 0) setDomain((domains.find((item) => item.is_default) ?? domains[0])?.hostname ?? "");
  }, [domain, domains]);

  const selectedDomain = domains.find((item) => item.hostname === domain);
  const mutation = useMutation({ mutationFn: (input: LinkCreateInput) => linksClient.create(workspaceId, input), onSuccess: (created) => window.location.assign(`/app/links/${created.id}?workspace=${workspaceId}`) });
  const toggleTag = (id: number, checked: boolean) => setTagIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDomain || !destination.trim()) return;
    const input: LinkCreateInput = { source: selectedDomain.source, destination: destination.trim(), domain: selectedDomain.hostname, redirect_status: 302, one_time: oneTime };
    if (code.trim()) input.code = code.trim();
    if (title.trim()) input.title = title.trim();
    if (expiresAt) input.expires_at = new Date(expiresAt).toISOString();
    if (password) input.password = password;
    if (maxClicks) input.max_clicks = Number(maxClicks);
    if (campaignId) input.campaign_id = Number(campaignId);
    if (tagIds.length) input.tag_ids = tagIds;
    mutation.mutate(input);
  };

  return <form className="links-create-form" onSubmit={submit}>
    <div className="links-create-scroll">
      {mutation.isError ? <Alert tone="danger" title={c("Unable to create link", "无法创建短链接")}>{errorMessage(mutation.error)}</Alert> : null}
      <Field label={c("Destination", "目标地址")} htmlFor="create-destination" required help={c("Enter the complete HTTP(S) address visitors should reach.", "填写访客最终要访问的完整 HTTP(S) 地址。")}> <Input id="create-destination" type="url" placeholder="https://example.com/page" value={destination} onChange={(event) => setDestination(event.target.value)} required /></Field>
      <Field label={c("Short-link domain", "短链域名")} htmlFor="create-domain" required help={selectedDomain?.source === "official" ? c("GoJet managed short-link domain.", "GoJet 官方短链域名。") : c("Verified custom domain with HTTPS enabled.", "已验证并启用 HTTPS 的自定义域名。")}> 
        <Select id="create-domain" value={domain} onChange={(event) => setDomain(event.target.value)} required disabled={!domains.length}>
          {!domains.length ? <option value="">{c("No available short-link domains", "暂无可用短链域名")}</option> : null}
          {domains.map((item) => <option key={`${item.source}-${item.hostname}`} value={item.hostname}>{item.hostname}{item.label ? ` · ${item.label}` : ""}</option>)}
        </Select>
      </Field>
      <div className="links-form-grid">
        <Field label={c("Short code", "短码")} htmlFor="create-code" help={c("Leave blank to generate one automatically.", "留空时由系统自动生成。")}> <Input id="create-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="my-link" minLength={3} maxLength={64} /></Field>
        <Field label={c("Title", "标题")} htmlFor="create-title"><Input id="create-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder={c("Campaign landing page", "活动落地页")} /></Field>
      </div>
      <details className="links-advanced">
        <summary>{c("Advanced settings", "高级设置")}</summary>
        <div className="links-advanced-body">
          <div className="links-form-grid">
            <Field label={c("Expiration", "有效期")} htmlFor="create-expiry"><Input id="create-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
            <Field label={c("Click limit", "访问次数上限")} htmlFor="create-click-limit"><Input id="create-click-limit" type="number" min={1} value={maxClicks} onChange={(event) => setMaxClicks(event.target.value)} placeholder={c("Unlimited", "不限制")} /></Field>
          </div>
          <Field label={c("Access password", "访问密码")} htmlFor="create-password" help={c("At least 6 characters. The password will not be displayed again after saving.", "至少 6 位。保存后不会再次显示明文密码。")}> <Input id="create-password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>
          <Field label={c("Campaign", "推广活动")} htmlFor="create-campaign"><Select id="create-campaign" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">{c("No campaign", "不关联推广活动")}</option>{organization.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          {organization.tags.length ? <div className="links-tag-picker"><span className="links-field-label">{c("Tags", "标签")}</span>{organization.tags.map((tag) => <Checkbox key={tag.id} label={tag.name} checked={tagIds.includes(tag.id)} onCheckedChange={(checked) => toggleTag(tag.id, checked)} />)}</div> : null}
          <Checkbox label={c("One-time link", "一次性链接")} checked={oneTime} onCheckedChange={setOneTime} />
          <p className="links-muted">{c("Routing rules and A/B testing can be configured after the link is created.", "跳转规则和 A/B 测试可在创建完成后进入链接详情继续设置。")}</p>
        </div>
      </details>
    </div>
    <div className="links-sheet-footer"><span className="links-muted">{c("After saving, GoJet will run the required safety check before the link is treated as ready.", "保存后 GoJet 会完成必要的安全检查，审核通过后链接才会显示为正常状态。")}</span><Button type="submit" loading={mutation.isPending} disabled={!selectedDomain || !destination.trim()}>{c("Create link", "创建短链接")}</Button></div>
  </form>;
}

export default function LinksPageV503() {
  const { locale } = useLocale();
  const zh = locale === "zh-CN";
  const c: Copy = (en, cn) => zh ? cn : en;
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
  const risks = useQuery({ queryKey: ["link-risks", workspaceId], queryFn: () => linksClient.risks(workspaceId!), enabled: Boolean(workspaceId), refetchInterval: 15_000 });

  const invalidate = async () => { setSelected([]); await Promise.all([queryClient.invalidateQueries({ queryKey: ["links", workspaceId] }), queryClient.invalidateQueries({ queryKey: ["link-risks", workspaceId] })]); };
  const statusMutation = useMutation({ mutationFn: ({ ids, status }: { ids: number[]; status: "active" | "paused" }) => linksClient.bulkStatus(workspaceId!, ids, status), onSuccess: invalidate });
  const tagMutation = useMutation({ mutationFn: ({ ids, tagIds }: { ids: number[]; tagIds: number[] }) => linksClient.bulkTags(workspaceId!, ids, tagIds), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: (ids: number[]) => linksClient.bulkDelete(workspaceId!, ids), onSuccess: invalidate });
  const setNumericFilter = (key: "campaign" | "tag", raw: string) => setFilters((current) => { const next: LinkListFilters = { ...current, offset: 0 }; if (raw) next[key] = Number(raw); else delete next[key]; return next; });
  const riskMap = useMemo(() => new Map((risks.data?.data ?? []).map((risk) => [risk.link_id, risk])), [risks.data]);
  const allSelected = Boolean(list.data?.data.length) && Boolean(list.data?.data.every((item) => selected.includes(item.id)));
  const visibleColumns = useMemo(() => Object.values(columns).filter(Boolean).length, [columns]);
  const mutationError = statusMutation.error ?? tagMutation.error ?? deleteMutation.error;

  if (workspaces.isPending) return <Page className="links-page"><div className="links-centered"><Spinner label={c("Loading workspace", "正在读取工作区")} /></div></Page>;
  if (workspaces.isError) return <Page className="links-page"><ErrorState title={c("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>{c("Retry", "重试")}</Button>} /></Page>;
  if (!workspace) return <Page className="links-page"><EmptyState title={c("No workspace yet", "还没有工作区")} description={c("Create a workspace before managing short links.", "创建工作区后才能管理短链接。")}/></Page>;

  const canEdit = capabilities.data?.can_edit === true;
  const org = organization.data ?? { campaigns: [], folders: [], tags: [] };
  const domainItems = domains.data?.data ?? [];
  const hasFilters = Object.keys(filters).some((key) => !["limit", "offset"].includes(key) && Boolean(filters[key as keyof LinkListFilters]));

  return <Page className="links-page" data-v503-links-list>
    <PageHeader title={c("Short links", "短链接")} description={c(`${list.data?.total ?? 0} links · ${workspace.name}`, `${list.data?.total ?? 0} 条短链接 · ${workspace.name}`)} actions={canEdit ? <SideSheet triggerLabel={c("Create link", "创建短链接")} title={c("Create link", "创建短链接")} description={c("Create a managed short link with the public address and access controls you need.", "创建可持续管理的短链接，并设置需要的公开地址与访问规则。")}> <CreateLinkForm workspaceId={workspace.id} domains={domainItems} organization={org} c={c} /></SideSheet> : undefined}/>
    {capabilities.data && !canEdit ? <Alert tone="warning" title={c("Read-only workspace", "只读工作区")}>{c(`Your current role is ${capabilities.data.role}. You can view links${capabilities.data.can_analytics ? " and analytics" : ""}, but cannot edit them.`, `你当前的角色为 ${capabilities.data.role}。可以查看短链接${capabilities.data.can_analytics ? "和访问分析" : ""}，但不能创建、编辑或执行批量操作。`)}</Alert> : null}
    {risks.isError ? <Alert tone="danger" title={c("Safety status unavailable", "安全状态暂时不可用")}>{c("Link safety status could not be verified. Active links will not be displayed as healthy until the status becomes available.", "当前无法核验链接安全状态。在状态恢复前，系统不会把活动链接显示为正常。")}</Alert> : null}
    {mutationError ? <Alert tone="danger" title={c("Bulk action failed", "批量操作失败")}>{errorMessage(mutationError)}</Alert> : null}

    <section className="links-toolbar" aria-label={c("Link filters", "短链接筛选")}> 
      <Input aria-label={c("Search links", "搜索短链接")} placeholder={c("Search links", "搜索短链接")} value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, offset: 0 }))}/>
      <Select aria-label={c("Domain filter", "域名筛选")} value={filters.domain ?? ""} onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value, offset: 0 }))}><option value="">{c("All domains", "全部域名")}</option>{domainItems.map((item) => <option key={`${item.source}-${item.hostname}`} value={item.hostname}>{item.hostname}</option>)}</Select>
      <Select aria-label={c("Status filter", "状态筛选")} value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as LinkStatus | "", offset: 0 }))}><option value="">{c("All link states", "全部链接状态")}</option><option value="active">{c("Active", "活动")}</option><option value="paused">{c("Paused", "已暂停")}</option><option value="expired">{c("Expired", "已过期")}</option></Select>
      <Select aria-label={c("Campaign filter", "推广活动筛选")} value={filters.campaign ?? ""} onChange={(event) => setNumericFilter("campaign", event.target.value)}><option value="">{c("All campaigns", "全部推广活动")}</option>{org.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select aria-label={c("Tag filter", "标签筛选")} value={filters.tag ?? ""} onChange={(event) => setNumericFilter("tag", event.target.value)}><option value="">{c("All tags", "全部标签")}</option>{org.tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Input aria-label={c("Created from", "开始日期")} type="date" value={filters.from ?? ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, offset: 0 }))}/>
      <Input aria-label={c("Created to", "结束日期")} type="date" value={filters.to ?? ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, offset: 0 }))}/>
      <Select aria-label={c("View", "显示方式")} value={view} onChange={(event) => setView(event.target.value as "table" | "compact")}><option value="table">{c("Table view", "表格视图")}</option><option value="compact">{c("Compact view", "紧凑视图")}</option></Select>
      <details className="links-columns"><summary>{c(`Columns · ${visibleColumns}`, `显示列 · ${visibleColumns}`)}</summary><div>{(Object.keys(columns) as Array<keyof typeof columns>).map((key) => <Checkbox key={key} label={({ destination: c("Destination", "目标地址"), domain: c("Domain", "域名"), clicks: c("Clicks", "访问次数"), status: c("Status", "状态"), updated: c("Updated", "更新时间") } as Record<string,string>)[key]} checked={columns[key]} onCheckedChange={(checked) => setColumns((current) => ({ ...current, [key]: checked }))}/>)}</div></details>
    </section>

    {selected.length > 0 && canEdit ? <section className="links-bulk" aria-label={c("Bulk actions", "批量操作")}><strong>{c(`${selected.length} selected`, `已选择 ${selected.length} 条`)}</strong><Button size="sm" variant="outline" type="button" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ ids: selected, status: "active" })}>{c("Activate", "启用")}</Button><Button size="sm" variant="outline" type="button" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ ids: selected, status: "paused" })}>{c("Pause", "暂停")}</Button><Select aria-label={c("Bulk tag", "批量添加标签")} value={bulkTag} onChange={(event) => setBulkTag(event.target.value)}><option value="">{c("Choose tag", "选择标签")}</option>{org.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</Select><Button size="sm" variant="outline" type="button" disabled={!bulkTag} loading={tagMutation.isPending} onClick={() => tagMutation.mutate({ ids: selected, tagIds: [Number(bulkTag)] })}>{c("Apply tag", "添加标签")}</Button><Button size="sm" variant="outline" type="button" onClick={() => window.location.assign(linksClient.exportUrl(workspace.id, filters))}>{c("Export", "导出")}</Button><AlertDialog triggerLabel={c("Delete", "删除")} title={c("Delete selected links?", "删除已选择的短链接？")} description={c(`Delete ${selected.length} selected links. Their public short URLs will stop working.`, `将删除已选择的 ${selected.length} 条短链接，对应的公开短网址将停止访问。`)} confirmLabel={c("Delete links", "确认删除")} onConfirm={() => deleteMutation.mutate(selected)}/></section> : null}

    {list.isPending ? <div className="links-centered"><Spinner label={c("Loading links", "正在加载短链接")} /></div> : list.isError ? <ErrorState title={c("Unable to load links", "无法加载短链接")} description={errorMessage(list.error)} action={<Button type="button" onClick={() => list.refetch()}>{c("Retry", "重试")}</Button>}/> : list.data.data.length === 0 ? <EmptyState title={c("No links found", "没有找到短链接")} description={c("No links match the current filters. Change the filters or create a new link.", "当前筛选条件没有匹配的短链接。可以调整筛选条件，或创建新的短链接。") } action={hasFilters ? <Button variant="outline" type="button" onClick={() => setFilters({ limit: 25, offset: 0 })}>{c("Clear filters", "清除筛选")}</Button> : undefined}/> : <>
      <div className={`links-desktop-table${view === "compact" ? " is-compact" : ""}`}>
        <Table label={c("Short links", "短链接")}><thead><tr><th><input type="checkbox" aria-label={c("Select all links", "选择全部短链接")} checked={allSelected} onChange={(event) => setSelected(event.target.checked ? list.data.data.map((item) => item.id) : [])} disabled={!canEdit}/></th><th>{c("Short link", "短链接")}</th>{columns.destination ? <th>{c("Destination", "目标地址")}</th> : null}{columns.domain ? <th>{c("Domain", "域名")}</th> : null}{columns.clicks ? <th>{c("Clicks", "访问次数")}</th> : null}{columns.status ? <th>{c("Status", "状态")}</th> : null}{columns.updated ? <th>{c("Updated", "更新时间")}</th> : null}<th><span className="sr-only">{c("Actions", "操作")}</span></th></tr></thead>
          <tbody>{list.data.data.map((item) => <LinkRowV503 key={item.id} item={item} canEdit={canEdit} selected={selected.includes(item.id)} onSelected={(checked) => setSelected((current) => checked ? [...new Set([...current, item.id])] : current.filter((value) => value !== item.id))} columns={columns} workspaceId={workspace.id} onDelete={() => deleteMutation.mutate([item.id])} state={customerState(item, riskMap.get(item.id), risks.isSuccess, risks.isError)} c={c}/>)}</tbody>
        </Table>
      </div>
      <div className="links-mobile-list">{list.data.data.map((item) => <LinkMobileCardV503 key={item.id} item={item} workspaceId={workspace.id} state={customerState(item, riskMap.get(item.id), risks.isSuccess, risks.isError)} c={c}/>)}</div>
      <div className="links-pagination"><span>{list.data.offset + 1}–{Math.min(list.data.offset + list.data.data.length, list.data.total)} / {list.data.total}</span><div><Button size="sm" variant="outline" type="button" disabled={list.data.offset <= 0} onClick={() => setFilters((current) => ({ ...current, offset: Math.max(0, (current.offset ?? 0) - (current.limit ?? 25)) }))}>{c("Previous", "上一页")}</Button><Button size="sm" variant="outline" type="button" disabled={list.data.offset + list.data.data.length >= list.data.total} onClick={() => setFilters((current) => ({ ...current, offset: (current.offset ?? 0) + (current.limit ?? 25) }))}>{c("Next", "下一页")}</Button></div></div>
    </>}
  </Page>;
}

function LinkRowV503({ item, canEdit, selected, onSelected, columns, workspaceId, onDelete, state, c }: { item: LinkRecord; canEdit: boolean; selected: boolean; onSelected: (checked: boolean) => void; columns: { destination: boolean; domain: boolean; clicks: boolean; status: boolean; updated: boolean }; workspaceId: number; onDelete: () => void; state: CustomerState; c: Copy }) {
  const href = `/app/links/${item.id}?workspace=${workspaceId}`;
  return <tr><td><input type="checkbox" aria-label={c(`Select ${item.code}`, `选择 ${item.code}`)} checked={selected} onChange={(event) => onSelected(event.target.checked)} disabled={!canEdit}/></td><td><div className="links-identity"><span className="links-favicon" aria-hidden="true">↗</span><div><a className="links-short-url" href={href}>{shortUrl(item.domain, item.code)}</a><span>{item.title || c("Untitled link", "未命名短链接")}</span></div></div></td>{columns.destination ? <td><span className="links-destination" title={item.destination}>{item.destination}</span></td> : null}{columns.domain ? <td>{item.domain || c("Default", "默认")}</td> : null}{columns.clicks ? <td>{item.clicks ?? 0}</td> : null}{columns.status ? <td><CustomerStatus state={state} c={c}/></td> : null}{columns.updated ? <td>{formatDate(item.updated_at ?? item.created_at)}</td> : null}<td><DropdownMenu actions={[{ id: "open", label: c("Open details", "查看详情"), onSelect: () => window.location.assign(href) }, { id: "visit", label: c("Visit short URL", "访问短网址"), onSelect: () => window.open(shortUrl(item.domain, item.code), "_blank", "noopener,noreferrer") }, { id: "delete", label: c("Delete", "删除"), destructive: true, disabled: !canEdit, separatorBefore: true, onSelect: onDelete }]}/></td></tr>;
}

function LinkMobileCardV503({ item, workspaceId, state, c }: { item: LinkRecord; workspaceId: number; state: CustomerState; c: Copy }) {
  return <a className="links-mobile-card" href={`/app/links/${item.id}?workspace=${workspaceId}`}><div><strong>{shortUrl(item.domain, item.code)}</strong><span>{item.title || c("Untitled link", "未命名短链接")}</span></div><div><CustomerStatus state={state} c={c}/><span>{c(`${item.clicks ?? 0} clicks`, `${item.clicks ?? 0} 次访问`)}</span></div></a>;
}
