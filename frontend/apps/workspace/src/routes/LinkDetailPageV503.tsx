import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkRecord, LinkRiskPresentation, LinkWriteInput, WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, ErrorState, Page, SettingsSection, Spinner, Tabs, useLocale } from "@gojet/ui";
import { DropdownMenu } from "@gojet/ui/overlays";
import { ABPanelV503, AccessPanelV503, AnalyticsPanelV503, HistoryPanelV503, QRPanelV503, RoutingPanelV503, SettingsPanelV503, SummaryCardV503, UTMPanelV503, type EditorProps } from "../links/LinkDetailPanelsV503";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

type Copy = (en: string, zh: string) => string;
type CustomerState = "active" | "review" | "blocked" | "paused" | "expired" | "unavailable";

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
  const output: LinkWriteInput = { destination: link.destination, title: link.title, status: link.status, redirect_status: link.redirect_status, one_time: link.one_time, utm: link.utm ?? {}, routing_rules: link.routing_rules ?? [], ab_destinations: link.ab_destinations ?? [] };
  output.expires_at = link.expires_at ?? null; output.max_clicks = link.max_clicks ?? null; output.folder_id = link.folder_id ?? null; output.campaign_id = link.campaign_id ?? null; if (link.tag_ids?.length) output.tag_ids = link.tag_ids;
  return output;
}

function effectiveState(item: LinkRecord, risk: LinkRiskPresentation | undefined, loaded: boolean, failed: boolean): CustomerState {
  if (item.status === "paused") return "paused";
  if (item.status === "expired") return "expired";
  if (failed) return "unavailable";
  if (!loaded || !risk || risk.pending || risk.effective_decision === "review") return "review";
  if (risk.effective_decision === "block") return "blocked";
  return "active";
}

function StatusBadgeV503({ state, c }: { state: CustomerState; c: Copy }) {
  const label: Record<CustomerState, string> = { active: c("Active", "正常"), review: c("Safety review", "安全审核中"), blocked: c("Blocked", "已阻止"), paused: c("Paused", "已暂停"), expired: c("Expired", "已过期"), unavailable: c("Status unavailable", "安全状态不可用") };
  const tone: Record<CustomerState, "success" | "warning" | "danger" | "neutral"> = { active: "success", review: "warning", blocked: "danger", paused: "warning", expired: "neutral", unavailable: "danger" };
  return <Badge tone={tone[state]}>{label[state]}</Badge>;
}

function activateTab(label: string) { Array.from(document.querySelectorAll<HTMLButtonElement>(".gj-tab")).find((node) => node.textContent?.trim() === label)?.click(); }

export default function LinkDetailPageV503() {
  const { locale } = useLocale(); const zh = locale === "zh-CN"; const c: Copy = (en, cn) => zh ? cn : en;
  const queryClient = useQueryClient(); const linkId = currentLinkId(); const { workspaces, workspace } = useDetailWorkspace(); const workspaceId = workspace?.id;
  const capabilities = useQuery({ queryKey: ["link-capabilities", workspaceId], queryFn: () => linksClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const link = useQuery({ queryKey: ["link", workspaceId, linkId], queryFn: () => linksClient.get(workspaceId!, linkId!), enabled: Boolean(workspaceId && linkId) });
  const risks = useQuery({ queryKey: ["link-risks", workspaceId], queryFn: () => linksClient.risks(workspaceId!), enabled: Boolean(workspaceId), refetchInterval: 15_000 });
  const update = useMutation({ mutationFn: ({ patch, reason }: { patch: Partial<LinkWriteInput>; reason: string }) => { if (!link.data || !workspaceId || !linkId) throw new Error(c("Link context is unavailable.", "短链接上下文不可用。")); return linksClient.update(workspaceId, linkId, { ...editable(link.data), ...patch }, reason); }, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["link", workspaceId, linkId] }), queryClient.invalidateQueries({ queryKey: ["links", workspaceId] }), queryClient.invalidateQueries({ queryKey: ["link-history", workspaceId, linkId] }), queryClient.invalidateQueries({ queryKey: ["link-risks", workspaceId] })]); } });

  if (!linkId) return <Page className="links-page"><ErrorState title={c("Invalid link", "短链接编号无效")} description={c("The link ID in this address is invalid.", "当前地址中的短链接编号无效。")}/></Page>;
  if (workspaces.isPending || link.isPending) return <Page className="links-page"><div className="links-centered"><Spinner label={c("Loading link details", "正在加载短链接详情")} /></div></Page>;
  if (workspaces.isError || !workspace) return <Page className="links-page"><ErrorState title={c("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)}/></Page>;
  if (link.isError || !link.data) return <Page className="links-page"><ErrorState title={c("Link not found", "短链接不存在或无权访问")} description={errorMessage(link.error)} action={<a className="gj-button" data-variant="outline" data-size="md" href={`/app/links?workspace=${workspace.id}`}>{c("Back to links", "返回短链接")}</a>}/></Page>;

  const item = link.data; const short = shortUrl(item.domain, item.code); const canEdit = capabilities.data?.can_edit === true; const canAnalytics = capabilities.data?.can_analytics === true; const risk = risks.data?.data.find((entry) => entry.link_id === item.id); const state = effectiveState(item, risk, risks.isSuccess, risks.isError); const readyToVisit = state === "active";
  const save = (patch: Partial<LinkWriteInput>, reason: string) => update.mutate({ patch, reason: reason.trim() }); const editorProps: EditorProps = { link: item, canEdit, save, pending: update.isPending, mutationError: update.error };
  const tabLabels = { overview: c("Overview", "概览"), analytics: c("Analytics", "访问分析"), routing: c("Routing", "跳转规则"), ab: c("A/B test", "A/B 测试"), utm: "UTM", access: c("Access", "访问控制"), qr: c("QR code", "二维码"), settings: c("Settings", "设置"), history: c("History", "版本历史") };
  const safetyAlert = state === "review" ? <Alert tone="warning" title={c("Safety review in progress", "目标安全审核中")}>{c("GoJet is still checking the destination. The link will not be shown as ready until the safety decision is complete.", "GoJet 正在检查目标地址。在安全审核完成前，这条短链接不会显示为正常状态。")}</Alert> : state === "blocked" ? <Alert tone="danger" title={c("Destination blocked", "目标地址已阻止")}>{c("This destination did not pass the current safety policy. Public visits are blocked until the destination or review outcome changes.", "当前目标地址未通过安全策略。修改目标地址或安全审核结果发生变化前，公开访问会保持阻止状态。")}</Alert> : state === "unavailable" ? <Alert tone="danger" title={c("Safety status unavailable", "安全状态暂时不可用")}>{c("GoJet cannot currently verify the destination safety state, so the link is not presented as healthy.", "GoJet 当前无法核验目标地址的安全状态，因此不会把这条链接显示为正常。")}</Alert> : null;

  const tabs = [
    { value: "overview", label: tabLabels.overview, content: <div className="link-panel-stack"><div className="link-summary-grid"><SummaryCardV503 label={c("Destination", "目标地址")} value={item.destination}/><SummaryCardV503 label={c("Clicks", "访问次数")} value={item.clicks ?? 0}/><SummaryCardV503 label={c("Created", "创建时间")} value={formatDate(item.created_at)}/><SummaryCardV503 label={c("Domain", "域名")} value={item.domain || c("Default", "默认")}/></div>{safetyAlert}<SettingsSection title={c("Current behavior", "当前访问规则")}><dl className="link-definition-list"><div><dt>{c("Redirect", "跳转类型")}</dt><dd>{item.redirect_status}</dd></div><div><dt>{c("Password", "密码保护")}</dt><dd>{item.password_protected ? c("Enabled", "已启用") : c("Off", "未启用")}</dd></div><div><dt>{c("Expires", "有效期")}</dt><dd>{formatDate(item.expires_at)}</dd></div><div><dt>{c("Click limit", "访问次数上限")}</dt><dd>{item.max_clicks ?? c("Unlimited", "不限制")}</dd></div><div><dt>{c("One-time", "一次性访问")}</dt><dd>{item.one_time ? c("On", "已启用") : c("Off", "未启用")}</dd></div></dl></SettingsSection></div> },
    { value: "analytics", label: tabLabels.analytics, content: <AnalyticsPanelV503 workspaceId={workspace.id} linkId={item.id} canAnalytics={canAnalytics}/> },
    { value: "routing", label: tabLabels.routing, content: <RoutingPanelV503 {...editorProps}/> },
    { value: "ab", label: tabLabels.ab, content: <ABPanelV503 {...editorProps}/> },
    { value: "utm", label: tabLabels.utm, content: <UTMPanelV503 {...editorProps}/> },
    { value: "access", label: tabLabels.access, content: <AccessPanelV503 {...editorProps}/> },
    { value: "qr", label: tabLabels.qr, content: <QRPanelV503 workspaceId={workspace.id} linkId={item.id} short={short}/> },
    { value: "settings", label: tabLabels.settings, content: <SettingsPanelV503 {...editorProps} workspaceId={workspace.id} onDeleted={() => window.location.assign(`/app/links?workspace=${workspace.id}`)}/> },
    { value: "history", label: tabLabels.history, content: <HistoryPanelV503 workspaceId={workspace.id} linkId={item.id} canEdit={canEdit}/> }
  ];

  return <Page className="links-page link-detail-page" data-v503-link-detail>
    <div className="link-detail-header"><div><a className="links-back" href={`/app/links?workspace=${workspace.id}`}>← {c("Links", "短链接")}</a><div className="link-title-row"><h1>{short}</h1><StatusBadgeV503 state={state} c={c}/></div><p>{item.title || c("Untitled link", "未命名短链接")}</p></div><div className="link-header-actions"><Button variant="outline" type="button" onClick={() => navigator.clipboard.writeText(short)}>{c("Copy", "复制")}</Button><Button variant="outline" type="button" disabled={!readyToVisit} onClick={() => window.open(short, "_blank", "noopener,noreferrer")}>{c("Visit", "访问")}</Button>{canEdit ? <Button type="button" onClick={() => activateTab(tabLabels.settings)}>{c("Edit", "编辑")}</Button> : null}<DropdownMenu actions={[{ id: "copy-destination", label: c("Copy destination", "复制目标地址"), onSelect: () => navigator.clipboard.writeText(item.destination) }, { id: "history", label: c("Open version history", "查看版本历史"), onSelect: () => activateTab(tabLabels.history) }]}/></div></div>
    {capabilities.data && !canEdit ? <Alert tone="warning" title={c("Read-only link", "只读短链接")}>{c(`Your current role is ${capabilities.data.role}. Editing and deletion are disabled.`, `你当前的角色为 ${capabilities.data.role}，不能编辑或删除这条短链接。`)}</Alert> : null}
    <Tabs items={tabs} defaultValue="overview"/>
  </Page>;
}
