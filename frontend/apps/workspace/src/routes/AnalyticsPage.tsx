import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createAnalyticsClient, type AnalyticsDimension, type LinkAnalytics, type LinkRecord, type OrganizationSnapshot, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Page, PageHeader, Spinner } from "@gojet/ui";
import { ChartFrame, DatePicker, Metric, Sparkline } from "@gojet/ui/patterns";
import { errorMessage, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const analyticsClient = createAnalyticsClient(api);
const DAY = 86_400_000;

function isoDay(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return isoDay(date); }
function defaultRange() { const to = new Date(); const from = new Date(to.getTime() - 29 * DAY); return { from: isoDay(from), to: isoDay(to) }; }
function compareRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.max(1, Math.round((end - start) / DAY) + 1);
  return { from: addDays(from, -days), toExclusive: from };
}
function percent(current: number, previous?: number) {
  if (previous === undefined) return undefined;
  if (previous === 0) return current === 0 ? "0% vs previous" : "+100% vs previous";
  const delta = ((current - previous) / previous) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs previous`;
}
function humanVisits(data?: LinkAnalytics) { return Math.max(0, (data?.clicks ?? 0) - (data?.bot_visits ?? 0)); }

function ComparedMetric({ label, value, change }: { label: string; value: string; change: string | undefined }) {
  return change === undefined ? <Metric label={label} value={value} /> : <Metric label={label} value={value} change={change} />;
}

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function DimensionList({ title, items, focus }: { title: string; items: AnalyticsDimension[]; focus?: string }) {
  const rows = focus ? items.filter((item) => item.name === focus) : items;
  const max = Math.max(1, ...items.map((item) => item.count));
  return <section className="analytics-dimension" aria-label={title}>
    <div className="analytics-section-heading"><h3>{title}</h3><Badge tone="neutral">Top {items.length}</Badge></div>
    {rows.length ? <div className="analytics-dimension-list">{rows.map((item) => <div key={item.name} className="analytics-dimension-row"><div><strong>{item.name || "Unknown"}</strong><span>{item.count.toLocaleString()}</span></div><div className="analytics-bar" aria-hidden="true"><span style={{ width: `${Math.max(3, (item.count / max) * 100)}%` }} /></div></div>)}</div> : <EmptyState title={`No ${title.toLowerCase()} data`} description="当前日期范围和资源条件下没有该维度事件。" />}
  </section>;
}

function downloadCSV(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const { workspaces, workspace } = useWorkspace();
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [domain, setDomain] = useState("");
  const [campaign, setCampaign] = useState("");
  const [linkId, setLinkId] = useState("");
  const [compare, setCompare] = useState(false);
  const [countryFocus, setCountryFocus] = useState("");
  const [deviceFocus, setDeviceFocus] = useState("");
  const workspaceId = workspace?.id;

  const capabilities = useQuery({ queryKey: ["analytics-capabilities", workspaceId], queryFn: () => linksClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const canAnalytics = capabilities.data?.can_analytics === true;
  const domains = useQuery({ queryKey: ["analytics-domains", workspaceId], queryFn: () => linksClient.domains(workspaceId!), enabled: Boolean(workspaceId && canAnalytics) });
  const organization = useQuery({ queryKey: ["analytics-organization", workspaceId], queryFn: () => linksClient.organization(workspaceId!), enabled: Boolean(workspaceId && canAnalytics) });
  const links = useQuery({
    queryKey: ["analytics-links", workspaceId, domain, campaign],
    queryFn: () => linksClient.list(workspaceId!, { domain, limit: 100, offset: 0, ...(campaign ? { campaign: Number(campaign) } : {}) }),
    enabled: Boolean(workspaceId && canAnalytics)
  });
  const overview = useQuery({ queryKey: ["analytics-overview", workspaceId], queryFn: () => analyticsClient.overview(workspaceId!), enabled: Boolean(workspaceId && canAnalytics && !linkId) });
  const activity = useQuery({ queryKey: ["analytics-resource-activity", workspaceId], queryFn: () => analyticsClient.resourceActivity(workspaceId!), enabled: Boolean(workspaceId && canAnalytics && !linkId) });
  const current = useQuery({
    queryKey: ["analytics-link", workspaceId, linkId, from, to],
    queryFn: () => linksClient.analytics(workspaceId!, Number(linkId), from, addDays(to, 1)),
    enabled: Boolean(workspaceId && canAnalytics && linkId && from && to && from <= to)
  });
  const previousPeriod = useMemo(() => compareRange(from, to), [from, to]);
  const previous = useQuery({
    queryKey: ["analytics-link-compare", workspaceId, linkId, previousPeriod.from, previousPeriod.toExclusive],
    queryFn: () => linksClient.analytics(workspaceId!, Number(linkId), previousPeriod.from, previousPeriod.toExclusive),
    enabled: Boolean(workspaceId && canAnalytics && linkId && compare && from && to && from <= to)
  });

  if (workspaces.isPending) return <Page className="analytics-page"><div className="analytics-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="analytics-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="analytics-page"><EmptyState title="还没有工作区" description="创建工作区后才能查看分析数据。" /></Page>;

  const selectedLink = links.data?.data.find((item) => String(item.id) === linkId);
  const organizationData = organization.data as OrganizationSnapshot | undefined;
  const exportRows = (): Array<Array<string | number>> => {
    if (linkId && current.data) {
      const rows: Array<Array<string | number>> = [["GoJet Analytics", selectedLink?.title || selectedLink?.code || linkId], ["From", from], ["To", to], ["Clicks", current.data.clicks], ["Unique visitors", current.data.unique_visitors], ["Bot visits", current.data.bot_visits]];
      for (const [label, values] of [["Country", current.data.countries], ["Device", current.data.devices], ["Source", current.data.sources]] as const) for (const item of values) rows.push([label, item.name, item.count]);
      return rows;
    }
    if (overview.data) return [["GoJet Workspace Analytics", workspace.name], ["Today clicks", overview.data.today_clicks], ["Month clicks", overview.data.month_clicks], ["Unique visitors", overview.data.unique_visitors], ["Active links", overview.data.active_links], ...overview.data.trend.map((point) => [point.date, point.clicks])];
    return [["GoJet Analytics", "No data"]];
  };
  const exportAnalytics = () => downloadCSV(`gojet-analytics-${workspace.id}-${isoDay(new Date())}.csv`, exportRows());

  if (capabilities.isPending) return <Page className="analytics-page"><div className="analytics-centered"><Spinner label="正在确认分析权限" /></div></Page>;
  if (capabilities.isError) return <Page className="analytics-page"><ErrorState title="无法确认分析权限" description={errorMessage(capabilities.error)} action={<Button type="button" onClick={() => capabilities.refetch()}>重试</Button>} /></Page>;
  if (!canAnalytics) return <Page className="analytics-page" data-p07-analytics><PageHeader title="Analytics" description={`Workspace intelligence · ${workspace.name}`} /><Alert tone="warning" title="Analytics permission required">当前角色为 {capabilities.data?.role ?? "unknown"}。GoJet 后端要求 analytics 权限，当前账号不会发起分析数据请求。</Alert><EmptyState title="Analytics unavailable" description="请由工作区 Owner/Admin 调整角色，或切换到有 analytics 权限的工作区。" /></Page>;

  const rangeInvalid = !from || !to || from > to;
  const linkError = current.error ?? (compare ? previous.error : null);
  const linkRows = links.data?.data ?? [];
  const countries = current.data?.countries ?? [];
  const devices = current.data?.devices ?? [];

  return <Page className="analytics-page" data-p07-analytics>
    <PageHeader title="Analytics" description={`Workspace intelligence · ${workspace.name}`} actions={<div className="analytics-header-actions"><DatePicker id="analytics-from" label="From" value={from} onChange={setFrom} /><DatePicker id="analytics-to" label="To" value={to} onChange={setTo} /><label className="analytics-compare"><input type="checkbox" checked={compare} disabled={!linkId || rangeInvalid} onChange={(event) => setCompare(event.target.checked)} /><span><strong>Compare</strong><small>{linkId ? "Previous equal-length period" : "Select a link resource"}</small></span></label><Button type="button" variant="outline" onClick={exportAnalytics} disabled={Boolean(linkId ? !current.data : !overview.data)}>Export CSV</Button></div>} />

    <section className="analytics-filter-card" aria-label="Analytics filters">
      <div className="analytics-filter-grid">
        <label className="gj-field"><span className="gj-label">Resource</span><select className="gj-input" aria-label="Resource filter" value={linkId} onChange={(event) => { setLinkId(event.target.value); setCountryFocus(""); setDeviceFocus(""); if (!event.target.value) setCompare(false); }}><option value="">Workspace overview</option>{linkRows.map((item: LinkRecord) => <option key={item.id} value={item.id}>{item.title || item.code} · {item.domain}/{item.code}</option>)}</select></label>
        <label className="gj-field"><span className="gj-label">Domain</span><select className="gj-input" aria-label="Domain filter" value={domain} onChange={(event) => { setDomain(event.target.value); setLinkId(""); setCompare(false); }}><option value="">All domains</option>{(domains.data?.data ?? []).map((item) => <option key={`${item.source}-${item.hostname}`} value={item.hostname}>{item.hostname}</option>)}</select></label>
        <label className="gj-field"><span className="gj-label">Campaign</span><select className="gj-input" aria-label="Campaign filter" value={campaign} onChange={(event) => { setCampaign(event.target.value); setLinkId(""); setCompare(false); }}><option value="">All campaigns</option>{(organizationData?.campaigns ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="gj-field"><span className="gj-label">Country</span><select className="gj-input" aria-label="Country filter" disabled={!linkId || !countries.length} value={countryFocus} onChange={(event) => setCountryFocus(event.target.value)}><option value="">All breakdown rows</option>{countries.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <label className="gj-field"><span className="gj-label">Device</span><select className="gj-input" aria-label="Device filter" disabled={!linkId || !devices.length} value={deviceFocus} onChange={(event) => setDeviceFocus(event.target.value)}><option value="">All breakdown rows</option>{devices.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
      </div>
      <p className="analytics-filter-note">Domain 与 Campaign 会真实筛选可选链接资源；Header 的日期范围与 Compare 会重新请求该链接的后端 analytics。Country / Device 用于聚焦后端已返回的聚合维度，不伪装成后端尚未提供的交叉条件 KPI。</p>
    </section>

    {rangeInvalid ? <Alert tone="danger" title="Invalid date range">From 不能晚于 To。</Alert> : null}
    {links.isError || domains.isError || organization.isError ? <Alert tone="warning" title="部分筛选元数据暂时不可用">{[links.error, domains.error, organization.error].filter(Boolean).map((error) => errorMessage(error)).join(" · ")}</Alert> : null}

    {linkId ? <>
      <section className="analytics-context"><div><span className="analytics-eyebrow">RESOURCE ANALYTICS</span><h2>{selectedLink?.title || selectedLink?.code || `Link #${linkId}`}</h2><p>{selectedLink ? `https://${selectedLink.domain}/${selectedLink.code}` : "Selected link"} · {from} → {to}</p></div>{compare ? <Badge tone="info">Comparing {previousPeriod.from} → {addDays(from, -1)}</Badge> : null}</section>
      {current.isPending || (compare && previous.isPending) ? <div className="analytics-centered"><Spinner label="正在加载链接分析" /></div> : linkError ? <ErrorState title="无法加载链接分析" description={errorMessage(linkError)} action={<Button type="button" onClick={() => { current.refetch(); if (compare) previous.refetch(); }}>重试</Button>} /> : current.data ? <>
        <section className="analytics-metrics" aria-label="Link analytics metrics">
          <ComparedMetric label="Clicks" value={current.data.clicks.toLocaleString()} change={compare ? percent(current.data.clicks, previous.data?.clicks) : undefined} />
          <ComparedMetric label="Unique visitors" value={current.data.unique_visitors.toLocaleString()} change={compare ? percent(current.data.unique_visitors, previous.data?.unique_visitors) : undefined} />
          <ComparedMetric label="Human visits" value={humanVisits(current.data).toLocaleString()} change={compare && previous.data ? percent(humanVisits(current.data), humanVisits(previous.data)) : undefined} />
          <ComparedMetric label="Bot visits" value={current.data.bot_visits.toLocaleString()} change={compare ? percent(current.data.bot_visits, previous.data?.bot_visits) : undefined} />
        </section>
        <div className="analytics-dimension-grid">
          <DimensionList title="Countries" items={current.data.countries} focus={countryFocus} />
          <DimensionList title="Devices" items={current.data.devices} focus={deviceFocus} />
          <DimensionList title="Sources" items={current.data.sources} />
          <DimensionList title="Browsers" items={current.data.browsers} />
          <DimensionList title="Operating systems" items={current.data.operating_systems} />
          <DimensionList title="UTM sources" items={current.data.utm_sources} />
        </div>
      </> : <EmptyState title="No analytics events" description="该链接在当前日期范围内还没有分析事件。" />}
    </> : <>
      {overview.isPending ? <div className="analytics-centered"><Spinner label="正在加载工作区分析" /></div> : overview.isError ? <ErrorState title="无法加载工作区分析" description={errorMessage(overview.error)} action={<Button type="button" onClick={() => overview.refetch()}>重试</Button>} /> : overview.data ? <>
        <section className="analytics-metrics" aria-label="Workspace analytics metrics"><Metric label="Today clicks" value={overview.data.today_clicks.toLocaleString()} /><Metric label="Month clicks" value={overview.data.month_clicks.toLocaleString()} /><Metric label="Unique visitors" value={overview.data.unique_visitors.toLocaleString()} /><Metric label="Active links" value={overview.data.active_links.toLocaleString()} /></section>
        <ChartFrame title="30-day click trend" description={overview.data.source ? `Source: ${overview.data.source}` : "Workspace click history"}><div className="analytics-trend"><Sparkline values={overview.data.trend.map((point) => point.clicks)} label="30-day click trend" /><div className="analytics-trend-meta"><span>{overview.data.trend.at(0)?.date ?? "—"}</span><strong>{overview.data.trend.reduce((total, point) => total + point.clicks, 0).toLocaleString()} clicks</strong><span>{overview.data.trend.at(-1)?.date ?? "—"}</span></div></div></ChartFrame>
        {overview.data.anomalies?.length ? <Alert tone="warning" title="Analytics anomalies">{overview.data.anomalies.map((item) => item.message ?? item.type ?? "Analytics anomaly").join(" · ")}</Alert> : null}
      </> : null}

      <section className="analytics-resource-activity"><div className="analytics-section-heading"><div><span className="analytics-eyebrow">RESOURCE ACTIVITY</span><h2>Legacy resource counters</h2><p>保留 V4 已有 QR / Files / Text / Bio 活动计数能力；这些资源当前不伪装成可按日期交叉分析的数据。</p></div></div>{activity.isPending ? <Spinner label="正在加载资源活动" /> : activity.isError ? <ErrorState title="资源活动暂时不可用" description={errorMessage(activity.error)} /> : activity.data ? <><div className="analytics-activity-grid"><Metric label="QR visits" value={activity.data.qr_visits.toLocaleString()} /><Metric label="File downloads" value={activity.data.file_downloads.toLocaleString()} /><Metric label="Text views" value={activity.data.text_views.toLocaleString()} /><Metric label="Bio views" value={activity.data.bio_views.toLocaleString()} /></div>{activity.data.partial_errors.length ? <Alert tone="warning" title="Partial resource data">以下资源接口暂时失败：{activity.data.partial_errors.join(", ")}。其余计数仍保持可用。</Alert> : null}</> : null}</section>
    </>}
  </Page>;
}
