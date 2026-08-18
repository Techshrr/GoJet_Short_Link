import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Button, DataRegion, Page, PageHeader } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";

type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function text(row: Row, key: string, fallback = "—") {
  const value = row[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

export default function AdminOverviewPage() {
  const overview = useQuery({
    queryKey: ["admin", "p17", "overview"],
    queryFn: () => api.get<unknown>("/api/admin/overview"),
    enabled: false,
    retry: false,
  });
  const diagnostics = useQuery({
    queryKey: ["admin", "p17", "diagnostics"],
    queryFn: () => api.get<unknown>("/api/admin/diagnostics"),
    enabled: false,
    retry: false,
  });
  const summary = asObject(overview.data);
  const health = asObject(diagnostics.data);
  const metrics: Row[] = [
    { metric: "Users", value: summary.users ?? summary.user_count ?? "—" },
    { metric: "Workspaces", value: summary.workspaces ?? summary.workspace_count ?? "—" },
    { metric: "Links", value: summary.links ?? summary.link_count ?? "—" },
    { metric: "Open alerts", value: health.alert_count ?? health.alerts ?? "—" },
  ];
  const columns: ColumnDef<Row>[] = [
    { header: "Signal", accessorFn: (row) => text(row, "metric") },
    { header: "Current", accessorFn: (row) => text(row, "value") },
  ];
  const loading = overview.isFetching || diagnostics.isFetching;
  const load = () => { void overview.refetch(); void diagnostics.refetch(); };

  return <Page data-p17-admin="overview">
    <PageHeader
      title="Overview"
      description="Platform-wide operational and governance summary. Live values are loaded on demand so the Admin shell remains resilient while the API tier is starting or temporarily unavailable."
      actions={<Button variant="outline" loading={loading} onClick={load}>Load live overview</Button>}
    />
    {overview.error || diagnostics.error ? <Alert tone="danger" title="Overview partially unavailable">{errorText(overview.error || diagnostics.error)}</Alert> : null}
    <DataRegion title="Platform signals" description="No cached browser copy is used; values come from the Admin overview and diagnostics authorities.">
      <DataTable data={metrics} columns={columns} label="Admin overview signals" density="compact" loading={loading} />
    </DataRegion>
  </Page>;
}
