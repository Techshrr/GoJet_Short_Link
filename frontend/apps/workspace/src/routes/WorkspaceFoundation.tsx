import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, EmptyState, ErrorState, Page, PageHeader, Spinner } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";
import { useLocale } from "@gojet/ui/locale";
import { normalizeWorkspaces, requestedWorkspaceId } from "../links/client";
import type { WorkspaceSummary } from "@gojet/api-client";

type Overview = {
  today_clicks: number;
  month_clicks: number;
  unique_visitors: number;
  active_links: number;
  usage?: Record<string, unknown>;
  trend?: Array<{ date: string; clicks: number }>;
  recent?: Array<{ id: number; code: string; title: string; destination: string; status: string; created_at: string; clicks: number }>;
  anomalies?: Array<{ type: string; message: string }>;
  generated_at?: string;
};

type MetricRow = { item: string; value: string | number };

const taskClass = "workspace-overview-task";

export default function WorkspaceFoundation() {
  const { text } = useLocale();
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => normalizeWorkspaces((await api.get<{ data: WorkspaceSummary[] } | WorkspaceSummary[]>("/api/workspaces")) as { data: WorkspaceSummary[] } | WorkspaceSummary[]),
  });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  const overview = useQuery({
    queryKey: ["workspace", "v503", "overview", workspace?.id],
    queryFn: () => api.get<Overview>(`/api/workspaces/${workspace!.id}/overview`),
    enabled: Boolean(workspace?.id),
    retry: 1,
  });

  if (workspaces.isPending) return <Page><Spinner label={text("Loading workspace", "正在读取工作区")} /></Page>;
  if (workspaces.isError) return <Page><ErrorState title={text("Unable to load workspace", "无法读取工作区")} description={workspaces.error instanceof Error ? workspaces.error.message : text("Please try again.", "请稍后重试。")}/></Page>;
  if (!workspace) return <Page><EmptyState title={text("No workspace yet", "还没有工作区")} description={text("Create a workspace to start using GoJet.", "创建工作区后即可开始使用 GoJet。")}/></Page>;

  const data = overview.data;
  const metrics: MetricRow[] = [
    { item: text("Visits today", "今日访问"), value: data?.today_clicks ?? 0 },
    { item: text("Visits this month", "本月访问"), value: data?.month_clicks ?? 0 },
    { item: text("Unique visitors", "独立访客"), value: data?.unique_visitors ?? 0 },
    { item: text("Active short links", "正常短链接"), value: data?.active_links ?? 0 },
  ];
  const metricColumns: ColumnDef<MetricRow>[] = [
    { header: text("Item", "项目"), accessorKey: "item" },
    { header: text("Current value", "当前值"), accessorKey: "value" },
  ];
  const recentColumns: ColumnDef<NonNullable<Overview["recent"]>[number]>[] = [
    { header: text("Short code", "短路径"), accessorKey: "code" },
    { header: text("Title", "标题"), accessorFn: (row) => row.title || text("Untitled", "未命名") },
    { header: text("Visits", "访问次数"), accessorKey: "clicks" },
    { header: text("Status", "状态"), accessorFn: (row) => row.status === "active" ? text("Active", "正常") : row.status === "paused" ? text("Paused", "已暂停") : text("Expired", "已过期") },
  ];

  const tasks = [
    { href: `/app/links?workspace=${workspace.id}&create=1`, title: text("Create short link", "创建短链接"), body: text("Create a new public short link and configure optional access or routing rules only when needed.", "创建新的公开短链接；只有确实需要时，再增加访问限制或跳转规则。") },
    { href: `/app/domains?workspace=${workspace.id}`, title: text("Manage domains", "管理域名"), body: text("Connect and verify the domains used by this workspace.", "绑定并验证当前工作区用于公开内容的域名。") },
    { href: `/app/analytics?workspace=${workspace.id}`, title: text("Review analytics", "查看访问分析"), body: text("Review recorded visits, sources, locations and devices.", "查看已记录的访问、来源、地区和设备数据。") },
    { href: `/app/members?workspace=${workspace.id}`, title: text("Manage members", "管理成员"), body: text("Invite members and review their workspace permissions.", "邀请成员并检查他们在当前工作区的权限。") },
  ];

  return <Page className="workspace-overview-page">
    <PageHeader
      title={text("Workspace overview", "工作区概览")}
      description={text(
        `Current activity and key resources for ${workspace.name}.`,
        `查看 ${workspace.name} 当前的访问、短链接和需要处理的异常。`
      )}
      actions={<Button variant="outline" loading={overview.isFetching} onClick={() => overview.refetch()}>{text("Refresh", "刷新")}</Button>}
    />

    {overview.isPending ? <Spinner label={text("Loading overview", "正在加载概览")} /> : overview.isError ? <ErrorState title={text("Overview unavailable", "概览暂时不可用")} description={overview.error instanceof Error ? overview.error.message : text("Please try again.", "请稍后重试。")}/> : <>
      <DataRegion title={text("Current activity", "当前数据")}>
        <DataTable data={metrics} columns={metricColumns} label={text("Workspace activity", "工作区当前数据")} density="compact" />
      </DataRegion>

      {data?.anomalies?.length ? <Alert tone="warning" title={text("Items need attention", "有项目需要处理")}>
        <ul>{data.anomalies.map((item, index) => <li key={`${item.type}-${index}`}>{item.message}</li>)}</ul>
      </Alert> : <Badge tone="success">{text("No current warnings", "当前没有待处理异常")}</Badge>}

      <DataRegion title={text("Recent short links", "最近创建的短链接")}>
        {data?.recent?.length ? <DataTable data={data.recent} columns={recentColumns} label={text("Recent short links", "最近短链接")} density="compact" /> : <EmptyState title={text("No short links yet", "还没有短链接")} description={text("Create the first short link for this workspace.", "为当前工作区创建第一条短链接。")}/>} 
      </DataRegion>
    </>}

    <section className="workspace-overview-tasks" aria-label={text("Common actions", "常用操作")}>
      {tasks.map((task) => <a className={taskClass} href={task.href} key={task.href}><strong>{task.title}</strong><p>{task.body}</p><span>{text("Open", "进入")}</span></a>)}
    </section>
  </Page>;
}
