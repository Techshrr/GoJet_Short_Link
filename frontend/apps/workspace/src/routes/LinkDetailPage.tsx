import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkRecord, LinkWriteInput, WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, ErrorState, Page, SettingsSection, Spinner, Tabs } from "@gojet/ui";
import { DropdownMenu } from "@gojet/ui/overlays";
import {
  ABPanel,
  AccessPanel,
  AnalyticsPanel,
  HistoryPanel,
  QRPanel,
  RoutingPanel,
  SettingsPanel,
  SummaryCard,
  UTMPanel,
  type EditorProps
} from "../links/LinkDetailPanels";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

function useDetailWorkspace() {
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[])
  });
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
  const output: LinkWriteInput = {
    destination: link.destination,
    title: link.title,
    status: link.status,
    redirect_status: link.redirect_status,
    one_time: link.one_time,
    utm: link.utm ?? {},
    routing_rules: link.routing_rules ?? [],
    ab_destinations: link.ab_destinations ?? []
  };
  output.expires_at = link.expires_at ?? null;
  output.max_clicks = link.max_clicks ?? null;
  output.folder_id = link.folder_id ?? null;
  output.campaign_id = link.campaign_id ?? null;
  if (link.tag_ids?.length) output.tag_ids = link.tag_ids;
  return output;
}

function StatusBadge({ status }: { status: LinkRecord["status"] }) {
  return <Badge tone={status === "active" ? "success" : status === "paused" ? "warning" : "neutral"}>{status}</Badge>;
}

export default function LinkDetailPage() {
  const queryClient = useQueryClient();
  const linkId = currentLinkId();
  const { workspaces, workspace } = useDetailWorkspace();
  const workspaceId = workspace?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const capabilities = useQuery({
    queryKey: ["link-capabilities", workspaceId],
    queryFn: () => linksClient.capabilities(workspaceId!),
    enabled: Boolean(workspaceId)
  });
  const link = useQuery({
    queryKey: ["link", workspaceId, linkId],
    queryFn: () => linksClient.get(workspaceId!, linkId!),
    enabled: Boolean(workspaceId && linkId)
  });
  const risks = useQuery({
    queryKey: ["link-risks", workspaceId],
    queryFn: () => linksClient.risks(workspaceId!),
    enabled: Boolean(workspaceId)
  });
  const update = useMutation({
    mutationFn: ({ patch, reason }: { patch: Partial<LinkWriteInput>; reason: string }) => {
      if (!link.data || !workspaceId || !linkId) throw new Error("Link context unavailable");
      return linksClient.update(workspaceId, linkId, { ...editable(link.data), ...patch }, reason);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["link", workspaceId, linkId] }),
        queryClient.invalidateQueries({ queryKey: ["links", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["link-history", workspaceId, linkId] })
      ]);
    }
  });

  if (!linkId) return <Page className="links-page"><ErrorState title="Invalid link" description="链接编号无效。" /></Page>;
  if (workspaces.isPending || link.isPending) return <Page className="links-page"><div className="links-centered"><Spinner label="正在加载链接详情" /></div></Page>;
  if (workspaces.isError || !workspace) return <Page className="links-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} /></Page>;
  if (link.isError || !link.data) return <Page className="links-page"><ErrorState title="链接不存在或无权访问" description={errorMessage(link.error)} action={<a className="gj-button" data-variant="outline" data-size="md" href={`/app/links?workspace=${workspace.id}`}>Back to links</a>} /></Page>;

  const item = link.data;
  const short = shortUrl(item.domain, item.code);
  const canEdit = capabilities.data?.can_edit === true;
  const canAnalytics = capabilities.data?.can_analytics === true;
  const risk = risks.data?.data.find((entry) => entry.link_id === item.id);
  const save = (patch: Partial<LinkWriteInput>, reason: string) => update.mutate({ patch, reason: reason.trim() });
  const editorProps: EditorProps = { link: item, canEdit, save, pending: update.isPending, mutationError: update.error };

  const tabs = [
    {
      value: "overview",
      label: "Overview",
      content: <div className="link-panel-stack">
        <div className="link-summary-grid"><SummaryCard label="Destination" value={item.destination} /><SummaryCard label="Clicks" value={item.clicks ?? 0} /><SummaryCard label="Created" value={formatDate(item.created_at)} /><SummaryCard label="Domain" value={item.domain || "Default"} /></div>
        {risk ? <Alert tone={risk.effective_decision === "block" ? "danger" : risk.pending || risk.effective_decision === "review" ? "warning" : "info"} title={`Destination risk · ${risk.effective_decision}`}>{risk.pending ? "安全扫描待处理或已到复检时间。" : `Provider ${risk.provider} · score ${risk.score}.`}{risk.manual ? " 当前状态包含管理员人工决策。" : ""}</Alert> : null}
        <SettingsSection title="Current behavior"><dl className="link-definition-list"><div><dt>Redirect</dt><dd>{item.redirect_status}</dd></div><div><dt>Password</dt><dd>{item.password_protected ? "Protected" : "Off"}</dd></div><div><dt>Expires</dt><dd>{formatDate(item.expires_at)}</dd></div><div><dt>Click limit</dt><dd>{item.max_clicks ?? "Unlimited"}</dd></div><div><dt>One-time</dt><dd>{item.one_time ? "On" : "Off"}</dd></div></dl></SettingsSection>
      </div>
    },
    { value: "analytics", label: "Analytics", content: <AnalyticsPanel workspaceId={workspace.id} linkId={item.id} canAnalytics={canAnalytics} /> },
    { value: "routing", label: "Routing", content: <RoutingPanel {...editorProps} /> },
    { value: "ab", label: "A/B Test", content: <ABPanel {...editorProps} /> },
    { value: "utm", label: "UTM", content: <UTMPanel {...editorProps} /> },
    { value: "access", label: "Access", content: <AccessPanel {...editorProps} /> },
    { value: "qr", label: "QR", content: <QRPanel workspaceId={workspace.id} linkId={item.id} short={short} /> },
    { value: "settings", label: "Settings", content: <SettingsPanel {...editorProps} workspaceId={workspace.id} onDeleted={() => window.location.assign(`/app/links?workspace=${workspace.id}`)} /> },
    { value: "history", label: "History", content: <HistoryPanel workspaceId={workspace.id} linkId={item.id} canEdit={canEdit} /> }
  ];

  return <Page className="links-page link-detail-page" data-p05-link-detail>
    <div className="link-detail-header">
      <div><a className="links-back" href={`/app/links?workspace=${workspace.id}`}>← Links</a><div className="link-title-row"><h1>{short}</h1><StatusBadge status={item.status} /></div><p>{item.title || "Untitled link"}</p></div>
      <div className="link-header-actions"><Button variant="outline" type="button" onClick={() => navigator.clipboard.writeText(short)}>Copy</Button><Button variant="outline" type="button" onClick={() => window.open(short, "_blank", "noopener,noreferrer")}>Visit</Button>{canEdit ? <Button type="button" onClick={() => setActiveTab("settings")}>Edit</Button> : null}<DropdownMenu actions={[{ id: "copy-destination", label: "Copy destination", onSelect: () => navigator.clipboard.writeText(item.destination) }, { id: "history", label: "Open history", onSelect: () => setActiveTab("history") }]} /></div>
    </div>
    {capabilities.data && !canEdit ? <Alert tone="warning" title="Read-only link">当前角色为 {capabilities.data.role}。编辑、恢复和删除操作已禁用。</Alert> : null}
    <Tabs items={tabs} defaultValue="overview" value={activeTab} onValueChange={setActiveTab} />
  </Page>;
}
