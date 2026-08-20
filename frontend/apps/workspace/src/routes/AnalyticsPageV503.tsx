import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createAnalyticsClient, type AnalyticsDimension, type LinkAnalytics, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Page, PageHeader, Select, Spinner, useLocale } from "@gojet/ui";
import { DatePicker, Metric } from "@gojet/ui/patterns";
import { errorMessage, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const analyticsClient = createAnalyticsClient(api);
const DAY = 86_400_000;
type Copy = (en: string, zh: string) => string;

function isoDay(date: Date) { return date.toISOString().slice(0, 10); }
function defaultRange() { const to = new Date(); const from = new Date(to.getTime() - 29 * DAY); return { from: isoDay(from), to: isoDay(to) }; }
function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}
function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function DimensionList({ title, items, c }: { title: string; items: AnalyticsDimension[]; c: Copy }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <section className="analytics-dimension" aria-label={title}><div className="analytics-section-heading"><h3>{title}</h3><Badge tone="neutral">{c(`Top ${items.length}`, `前 ${items.length} 项`)}</Badge></div>{items.length ? <div className="analytics-dimension-list">{items.slice(0, 10).map((item) => <div key={item.name || "unknown"} className="analytics-dimension-row"><div><strong>{item.name || c("Unknown", "未知")}</strong><span>{item.count.toLocaleString()}</span></div><div className="analytics-bar" aria-hidden="true"><span style={{ width: `${Math.max(3, (item.count / max) * 100)}%` }} /></div></div>)}</div> : <EmptyState title={c("No data", "暂无数据")} description={c("There are no events for this dimension in the selected range.", "当前时间范围内没有该维度的访问数据。")}/>}</section>;
}

export default function AnalyticsPageV503() {
  const { locale } = useLocale(); const zh = locale === "zh-CN"; const c: Copy = (en, cn) => zh ? cn : en;
  const { workspaces, workspace } = useWorkspace(); const range = useMemo(defaultRange, []); const [from, setFrom] = useState(range.from); const [to, setTo] = useState(range.to); const [domain, setDomain] = useState(""); const [campaign, setCampaign] = useState(""); const [linkId, setLinkId] = useState(""); const workspaceId = workspace?.id;
  const capabilities = useQuery({ queryKey: ["analytics-capabilities", workspaceId], queryFn: () => linksClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const canAnalytics = capabilities.data?.can_analytics === true;
  const domains = useQuery({ queryKey: ["analytics-domains", workspaceId], queryFn: () => linksClient.domains(workspaceId!), enabled: Boolean(workspaceId && canAnalytics) });
  const organization = useQuery({ queryKey: ["analytics-organization", workspaceId], queryFn: () => linksClient.organization(workspaceId!), enabled: Boolean(workspaceId && canAnalytics) });
  const links = useQuery({ queryKey: ["analytics-links", workspaceId, domain, campaign], queryFn: () => linksClient.list(workspaceId!, { limit: 100, offset: 0, ...(domain ? { domain } : {}), ...(campaign ? { campaign: Number(campaign) } : {}) }), enabled: Boolean(workspaceId && canAnalytics) });
  const selectedId = linkId ? Number(linkId) : undefined;
  const linkAnalytics = useQuery({ queryKey: ["analytics-link", workspaceId, selectedId, from, to], queryFn: () => linksClient.analytics(workspaceId!, selectedId!, from, to), enabled: Boolean(workspaceId && canAnalytics && selectedId) });
  const overview = useQuery({ queryKey: ["analytics-overview", workspaceId], queryFn: () => analyticsClient.overview(workspaceId!), enabled: Boolean(workspaceId && canAnalytics && !selectedId) });
  const resourceActivity = useQuery({ queryKey: ["analytics-resource-activity", workspaceId], queryFn: () => analyticsClient.resourceActivity(workspaceId!), enabled: Boolean(workspaceId && canAnalytics && !selectedId) });

  if (workspaces.isPending) return <Page className="analytics-page"><div className="workspace-centered"><Spinner label={c("Loading workspace", "正在读取工作区")}/></div></Page>;
  if (workspaces.isError) return <Page className="analytics-page"><ErrorState title={c("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)} action={<Button onClick={() => workspaces.refetch()}>{c("Retry", "重试")}</Button>}/></Page>;
  if (!workspace) return <Page className="analytics-page"><EmptyState title={c("No workspace", "还没有工作区")} description={c("Create or join a workspace before reviewing analytics.", "创建或加入工作区后才能查看访问分析。")}/></Page>;
  if (capabilities.isPending) return <Page className="analytics-page"><PageHeader title={c("Analytics", "访问分析")}/><Spinner label={c("Checking permissions", "正在确认访问权限")}/></Page>;
  if (!canAnalytics) return <Page className="analytics-page"><PageHeader title={c("Analytics", "访问分析")}/><Alert tone="warning" title={c("Analytics permission required", "需要访问分析权限")}>{c("Your current workspace role cannot view analytics.", "你当前的工作区角色无权查看访问分析。")}</Alert></Page>;

  const selected = links.data?.data.find((item) => item.id === selectedId);
  const data: LinkAnalytics | undefined = linkAnalytics.data;
  const exportRows = data ? [[c("Metric", "指标"), c("Value", "数值")], [c("Clicks", "访问次数"), data.clicks], [c("Unique visitors", "独立访客"), data.unique_visitors], [c("Automated traffic", "自动化流量"), data.bot_visits]] : overview.data ? [[c("Metric", "指标"), c("Value", "数值")], [c("Today", "今日访问"), overview.data.today_clicks], [c("This month", "本月访问"), overview.data.month_clicks], [c("Unique visitors", "独立访客"), overview.data.unique_visitors], [c("Active links", "有效短链接"), overview.data.active_links]] : [];

  return <Page className="analytics-page" data-v503-analytics>
    <PageHeader title={c("Analytics", "访问分析")} description={c(`Review actual visits and content activity for ${workspace.name}.`, `查看 ${workspace.name} 的真实访问数据和内容使用情况。`)} actions={<Button variant="outline" type="button" disabled={!exportRows.length} onClick={() => downloadCsv(`gojet-analytics-${from}-${to}.csv`, exportRows)}>{c("Export CSV", "导出 CSV")}</Button>}/>
    <section className="analytics-toolbar" aria-label={c("Analytics filters", "访问分析筛选")}><DatePicker id="analytics-from" label={c("From", "开始日期")} value={from} onChange={setFrom}/><DatePicker id="analytics-to" label={c("To", "结束日期")} value={to} onChange={setTo}/><Select aria-label={c("Domain", "域名")} value={domain} onChange={(event) => { setDomain(event.target.value); setLinkId(""); }}><option value="">{c("All domains", "全部域名")}</option>{(domains.data?.data ?? []).map((item) => <option key={`${item.source}-${item.hostname}`} value={item.hostname}>{item.hostname}</option>)}</Select><Select aria-label={c("Campaign", "推广活动")} value={campaign} onChange={(event) => { setCampaign(event.target.value); setLinkId(""); }}><option value="">{c("All campaigns", "全部推广活动")}</option>{(organization.data?.campaigns ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select aria-label={c("Link", "短链接")} value={linkId} onChange={(event) => setLinkId(event.target.value)}><option value="">{c("Workspace overview", "工作区总体数据")}</option>{(links.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.title || item.code}</option>)}</Select></section>

    {selectedId ? linkAnalytics.isPending ? <div className="workspace-centered"><Spinner label={c("Loading link analytics", "正在加载短链接分析")}/></div> : linkAnalytics.isError ? <ErrorState title={c("Unable to load link analytics", "无法加载短链接分析")} description={errorMessage(linkAnalytics.error)} action={<Button onClick={() => linkAnalytics.refetch()}>{c("Retry", "重试")}</Button>}/> : data ? <>
      <section className="analytics-metrics"><Metric label={c("Clicks", "访问次数")} value={String(data.clicks)}/><Metric label={c("Unique visitors", "独立访客")} value={String(data.unique_visitors)}/><Metric label={c("Automated traffic", "自动化流量")} value={String(data.bot_visits)}/><Metric label={c("Human visits", "人工访问")} value={String(Math.max(0, data.clicks - data.bot_visits))}/></section>
      <p className="analytics-context">{c("Selected link", "当前短链接")}: <strong>{selected?.title || selected?.code || linkId}</strong></p>
      <div className="analytics-dimensions-grid"><DimensionList title={c("Sources", "来源")} items={data.sources} c={c}/><DimensionList title={c("Countries / regions", "国家或地区")} items={data.countries} c={c}/><DimensionList title={c("Devices", "设备")} items={data.devices} c={c}/><DimensionList title={c("Browsers", "浏览器")} items={data.browsers} c={c}/></div>
      {data.recent.length ? <section className="workspace-section"><h2>{c("Recent visits", "最近访问")}</h2><div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>{c("Time", "时间")}</th><th>{c("Source", "来源")}</th><th>{c("Country / region", "国家或地区")}</th><th>{c("Device", "设备")}</th></tr></thead><tbody>{data.recent.slice(0, 50).map((event, index) => <tr key={index}><td>{String(event.timestamp ?? "—")}</td><td>{String(event.source ?? c("Unknown", "未知"))}</td><td>{String(event.country ?? "—")}</td><td>{String(event.device ?? "—")}</td></tr>)}</tbody></table></div></section> : <EmptyState title={c("No visits", "暂无访问记录")} description={c("There are no visits in the selected date range.", "所选日期范围内还没有访问记录。")}/>}</> : null : overview.isPending ? <div className="workspace-centered"><Spinner label={c("Loading workspace analytics", "正在加载工作区分析")}/></div> : overview.isError ? <ErrorState title={c("Unable to load workspace analytics", "无法加载工作区分析")} description={errorMessage(overview.error)} action={<Button onClick={() => overview.refetch()}>{c("Retry", "重试")}</Button>}/> : overview.data ? <>
      <section className="analytics-metrics"><Metric label={c("Today", "今日访问")} value={String(overview.data.today_clicks)}/><Metric label={c("This month", "本月访问")} value={String(overview.data.month_clicks)}/><Metric label={c("Unique visitors", "独立访客")} value={String(overview.data.unique_visitors)}/><Metric label={c("Active links", "有效短链接")} value={String(overview.data.active_links)}/></section>
      <section className="workspace-section"><div className="workspace-section-head"><div><h2>{c("Content activity", "内容访问情况")}</h2><p>{c("Views and downloads recorded for other shareable content in this workspace.", "查看工作区内其他公开内容记录到的访问和下载次数。")}</p></div></div>{resourceActivity.isPending ? <Spinner label={c("Loading content activity", "正在加载内容访问情况")}/> : resourceActivity.data ? <div className="analytics-metrics"><Metric label={c("QR scans", "二维码扫码")} value={String(resourceActivity.data.qr_visits)}/><Metric label={c("File downloads", "文件下载")} value={String(resourceActivity.data.file_downloads)}/><Metric label={c("Text views", "文本访问")} value={String(resourceActivity.data.text_views)}/><Metric label={c("Bio views", "个人主页访问")} value={String(resourceActivity.data.bio_views)}/></div> : null}{resourceActivity.data?.partial_errors.length ? <Alert tone="warning" title={c("Some content data is temporarily unavailable", "部分内容数据暂时不可用")}>{c("The available totals are shown; unavailable content categories were not replaced with sample values.", "页面会显示当前能够读取的真实数据，不会用示例值补齐暂时不可用的内容分类。")}</Alert> : null}</section>
      {overview.data.anomalies?.length ? <section className="workspace-section"><h2>{c("Needs attention", "需要关注")}</h2>{overview.data.anomalies.map((item, index) => <Alert key={index} tone={item.severity === "critical" ? "danger" : "warning"} title={c("Detected activity", "检测到异常活动")}>{item.message || c("An analytics anomaly was reported.", "系统报告了一项访问分析异常。")}</Alert>)}</section> : null}</> : null}
  </Page>;
}
