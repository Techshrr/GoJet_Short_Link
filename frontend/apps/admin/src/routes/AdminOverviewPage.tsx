import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, Page, PageHeader } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";
import { useLocale } from "@gojet/ui/locale";

type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function numberValue(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminOverviewPage() {
  const { text } = useLocale();
  const overview = useQuery({
    queryKey: ["admin", "v503", "overview"],
    queryFn: () => api.get<unknown>("/api/admin/overview"),
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const diagnostics = useQuery({
    queryKey: ["admin", "v503", "diagnostics"],
    queryFn: () => api.get<unknown>("/api/admin/diagnostics"),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const summary = asObject(overview.data);
  const health = asObject(diagnostics.data);
  const metrics: Row[] = [
    { metric: text("Users", "用户"), value: numberValue(summary, "users", "user_count") },
    { metric: text("Workspaces", "工作区"), value: numberValue(summary, "workspaces", "workspace_count") },
    { metric: text("Links", "短链接"), value: numberValue(summary, "links", "link_count") },
    { metric: text("Open alerts", "待处理提醒"), value: numberValue(health, "alert_count", "alerts") },
  ];

  const columns: ColumnDef<Row>[] = [
    { header: text("Item", "项目"), accessorFn: (row) => String(row.metric ?? "—") },
    { header: text("Current value", "当前值"), accessorFn: (row) => String(row.value ?? 0) },
  ];
  const loading = overview.isPending || diagnostics.isPending || overview.isFetching || diagnostics.isFetching;
  const refresh = () => { void overview.refetch(); void diagnostics.refetch(); };
  const hasError = overview.isError || diagnostics.isError;

  return <Page data-p17-admin="overview">
    <PageHeader
      title={text("Overview", "概览")}
      description={text(
        "See the current platform totals and operational alerts. Values are read from the server when this page opens and can be refreshed at any time.",
        "查看平台当前的用户、工作区、短链接和待处理提醒。页面打开时会直接读取服务器最新数据，也可以随时手动刷新。"
      )}
      actions={<Button variant="outline" loading={loading} onClick={refresh}>{text("Refresh", "刷新概览")}</Button>}
    />
    {hasError ? <Alert tone="danger" title={text("Some overview data is unavailable", "部分概览数据暂时不可用")}>
      {errorText(overview.error || diagnostics.error, text("Please try again shortly.", "请稍后重试。"))}
    </Alert> : null}
    <DataRegion
      title={text("Current status", "当前状况")}
      description={text(
        "These values come from the Admin APIs. The page does not substitute cached browser data or example values.",
        "以下数据直接来自管理后台接口，不会使用浏览器缓存或示例数据替代真实结果。"
      )}
    >
      <DataTable data={metrics} columns={columns} label={text("Admin overview", "管理后台概览")} density="compact" loading={loading} />
    </DataRegion>
    {!loading && !hasError ? <Badge tone="success">{text("Server data loaded", "服务器数据已加载")}</Badge> : null}
  </Page>;
}
