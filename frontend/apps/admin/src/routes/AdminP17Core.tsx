import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, Field, Page, PageHeader, Select, Textarea, useLocale } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";

type Row = Record<string, unknown>;
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const asObject = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const asRows = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value.filter((entry) => entry && typeof entry === "object") as Row[];
  const record = asObject(value);
  for (const key of ["data", "items", "users", "workspaces", "resources"]) if (Array.isArray(record[key])) return record[key] as Row[];
  return [];
};
const str = (row: Row, key: string, fallback = "—") => row[key] === undefined || row[key] === null || row[key] === "" ? fallback : String(row[key]);
const rid = (row: Row) => str(row, "id", str(row, "resource_id", ""));
const when = (row: Row, key = "created_at") => { const raw = str(row, key, ""); if (!raw) return "—"; const value = new Date(raw); return Number.isNaN(value.valueOf()) ? raw : value.toLocaleString(); };
const err = (value: unknown) => value instanceof Error ? value.message : "请求失败，请稍后重试。";
const tone = (value: string): Tone => { const v = value.toLowerCase(); if (["active", "healthy", "ready", "verified", "success", "published"].includes(v)) return "success"; if (["pending", "unknown", "warning", "quarantined", "suspended"].includes(v)) return "warning"; if (["blocked", "failed", "error", "deleted", "critical"].includes(v)) return "danger"; return "neutral"; };
const useAdmin = (key: string, endpoint: string) => useQuery({ queryKey: ["admin", "p17", key], queryFn: () => api.get<unknown>(endpoint) });

export function AdminOverviewPage() {
  const { text } = useLocale();
  const overview = useAdmin("overview", "/api/admin/overview");
  const diagnostics = useAdmin("diagnostics", "/api/admin/diagnostics");
  const summary = asObject(overview.data); const health = asObject(diagnostics.data);
  const metrics: Row[] = [
    { metric: "Users", value: summary.users ?? summary.user_count ?? "—" },
    { metric: "Workspaces", value: summary.workspaces ?? summary.workspace_count ?? "—" },
    { metric: "Links", value: summary.links ?? summary.link_count ?? "—" },
    { metric: "Open alerts", value: health.alert_count ?? health.alerts ?? "—" },
  ];
  const columns: ColumnDef<Row>[] = [{ header: "Signal", accessorFn: (row) => str(row, "metric") }, { header: "Current", accessorFn: (row) => str(row, "value") }];
  return <Page data-p17-admin="overview"><PageHeader title="Overview" description="Platform-wide operational and governance summary sourced from the Admin overview and diagnostics APIs." />{overview.error || diagnostics.error ? <Alert tone="danger" title="Overview partially unavailable">{err(overview.error || diagnostics.error)}</Alert> : null}<DataRegion title="Platform signals"><DataTable data={metrics} columns={columns} label={text("Admin overview", "后台概览")} density="compact" loading={overview.isLoading || diagnostics.isLoading} /></DataRegion></Page>;
}

export function AdminUsersPage() {
  const { text } = useLocale();
  const query = useAdmin("users", "/api/admin/users?limit=200"); const qc = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null); const [status, setStatus] = useState("suspended"); const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: () => { if (!selected || reason.trim().length < 3) throw new Error("Governance reason must contain at least 3 characters."); return api.patch(`/api/admin/governance/users/${rid(selected)}/status`, { status, reason: reason.trim() }); }, onSuccess: async () => { setSelected(null); setReason(""); await qc.invalidateQueries({ queryKey: ["admin", "p17", "users"] }); } });
  const columns: ColumnDef<Row>[] = [
    { header: "User", accessorFn: (row) => str(row, "email") }, { header: "Name", accessorFn: (row) => str(row, "display_name", str(row, "name")) },
    { header: "Status", accessorFn: (row) => str(row, "status"), cell: ({ row }) => <Badge tone={tone(str(row.original, "status"))}>{str(row.original, "status")}</Badge> },
    { header: "Verified", accessorFn: (row) => str(row, "email_verified_at", str(row, "email_verified")) }, { header: "Created", accessorFn: (row) => when(row) },
    { id: "actions", header: "Governance", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setStatus(str(row.original, "status") === "suspended" ? "active" : "suspended"); setReason(""); }}>Change status</Button> },
  ];
  return <Page data-p17-admin="users"><PageHeader title="Users" description="Global user governance. Suspend/restore is server-enforced, audited, and requires a reason; suspension revokes active sessions." /><DataRegion title="User directory"><DataTable data={asRows(query.data)} columns={columns} label={text("Admin users", "后台用户") } density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion>{selected ? <section className="p17-action-card"><h2>{text("Change user account", "修改用户账号")} · {str(selected, "email")}</h2><Field label="New status" htmlFor="user-status"><Select id="user-status" value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="active">Active</option><option value="suspended">Suspended</option></Select></Field><Field label="Governance reason" htmlFor="user-reason" required help="3–500 characters. Stored in the audit trail."><Textarea id="user-reason" rows={4} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field>{mutation.error ? <Alert tone="danger" title={text("User action failed", "用户操作失败")}>{err(mutation.error)}</Alert> : null}<div className="p17-actions"><Button disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>Apply status</Button><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button></div></section> : null}</Page>;
}

export function AdminWorkspacesPage() {
  const { text } = useLocale();
  const query = useAdmin("workspaces", "/api/admin/workspaces?limit=200");
  const columns: ColumnDef<Row>[] = [{ header: "Workspace", accessorFn: (row) => str(row, "name") }, { header: "ID", accessorFn: (row) => str(row, "id") }, { header: "Owner", accessorFn: (row) => str(row, "owner_email", str(row, "owner_id")) }, { header: "Plan", accessorFn: (row) => str(row, "plan", str(row, "plan_code")) }, { header: "Status", accessorFn: (row) => str(row, "status"), cell: ({ row }) => <Badge tone={tone(str(row.original, "status"))}>{str(row.original, "status")}</Badge> }, { header: "Created", accessorFn: (row) => when(row) }];
  return <Page data-p17-admin="workspaces"><PageHeader title="Workspaces" description="Cross-tenant workspace inventory and lifecycle state. Workspace mutations remain RBAC-protected on the server." /><DataRegion title="Workspace inventory"><DataTable data={asRows(query.data)} columns={columns} label={text("Admin workspaces", "后台工作区")} density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion></Page>;
}

export function AdminMembershipsPage() {
  const { text } = useLocale();
  const query = useAdmin("memberships", "/api/admin/memberships?limit=200");
  const columns: ColumnDef<Row>[] = [{ header: "Workspace", accessorFn: (row) => str(row, "workspace") }, { header: "User", accessorFn: (row) => str(row, "email") }, { header: "Role", accessorFn: (row) => str(row, "role") }, { header: "Status", accessorFn: (row) => str(row, "status"), cell: ({ row }) => <Badge tone={tone(str(row.original, "status"))}>{str(row.original, "status")}</Badge> }, { header: "Joined", accessorFn: (row) => when(row, "joined_at") }];
  return <Page data-p17-admin="memberships"><PageHeader title="Memberships" description="Global workspace membership view backed by the workspace membership authority, not duplicated browser state." /><DataRegion title="Membership inventory"><DataTable data={asRows(query.data)} columns={columns} label={text("Admin memberships", "后台成员关系")} density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion></Page>;
}

type ResourceKind = "link" | "qr" | "file" | "text" | "bio";
function ResourceGovernancePage({ kind, title }: { kind: ResourceKind; title: string }) {
  const query = useAdmin(`resources-${kind}`, "/api/admin/resource-inventory?limit=500"); const qc = useQueryClient(); const [selected, setSelected] = useState<Row | null>(null); const [reason, setReason] = useState("");
  const data = asRows(query.data).filter((row) => str(row, "resource_type", "").toLowerCase() === kind);
  const mutation = useMutation({ mutationFn: () => { if (!selected || reason.trim().length < 3) throw new Error("Governance reason must contain at least 3 characters."); const qid = str(selected, "quarantine_id", ""); if (str(selected, "status", "").toLowerCase() === "quarantined" && qid) return api.post(`/api/admin/quarantine/${qid}/restore`, { reason: reason.trim() }); return api.post(`/api/admin/resources/${kind}/${rid(selected)}/quarantine`, { reason: reason.trim() }); }, onSuccess: async () => { setSelected(null); setReason(""); await qc.invalidateQueries({ queryKey: ["admin", "p17", `resources-${kind}`] }); } });
  const columns: ColumnDef<Row>[] = [{ header: "Resource", accessorFn: (row) => str(row, "title", str(row, "name", `#${rid(row)}`)) }, { header: "Workspace", accessorFn: (row) => str(row, "workspace", str(row, "workspace_id")) }, { header: "Owner", accessorFn: (row) => str(row, "owner", str(row, "owner_id")) }, { header: "Visibility", accessorFn: (row) => str(row, "visibility") }, { header: "Status", accessorFn: (row) => str(row, "status"), cell: ({ row }) => <Badge tone={tone(str(row.original, "status"))}>{str(row.original, "status")}</Badge> }, { header: "Created", accessorFn: (row) => when(row) }, { id: "actions", header: "Governance", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setReason(""); }}>{str(row.original, "status", "").toLowerCase() === "quarantined" ? "Restore" : "Quarantine"}</Button> }];
  return <Page data-p17-admin={`resource-${kind}`}><PageHeader title={title} description="Cross-workspace resource governance with server-side quarantine controls and mandatory audit reason." /><DataRegion title={`${title} inventory`}><DataTable data={data} columns={columns} label={`Admin ${title}`} density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion>{selected ? <section className="p17-action-card"><h2>{str(selected, "status", "").toLowerCase() === "quarantined" ? "Restore" : "Quarantine"} {title.toLowerCase()} #{rid(selected)}</h2><Field label="Governance reason" htmlFor={`${kind}-reason`} required><Textarea id={`${kind}-reason`} rows={4} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field><div className="p17-actions"><Button variant={str(selected, "status", "").toLowerCase() === "quarantined" ? "outline" : "destructive"} disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>{str(selected, "status", "").toLowerCase() === "quarantined" ? "Restore resource" : "Quarantine resource"}</Button><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button></div></section> : null}</Page>;
}
export const AdminLinksPage = () => <ResourceGovernancePage kind="link" title="Links" />;
export const AdminQRPage = () => <ResourceGovernancePage kind="qr" title="QR Codes" />;
export const AdminFilesPage = () => <ResourceGovernancePage kind="file" title="Files" />;
export const AdminTextPage = () => <ResourceGovernancePage kind="text" title="Text" />;
export const AdminBioPage = () => <ResourceGovernancePage kind="bio" title="Bio Pages" />;

export function AdminDomainsPage() {
  const { text } = useLocale();
  const query = useAdmin("domains", "/api/admin/domains?limit=200");
  const columns: ColumnDef<Row>[] = [{ header: "Domain", accessorFn: (row) => str(row, "hostname", str(row, "domain")) }, { header: "Workspace", accessorFn: (row) => str(row, "workspace", str(row, "workspace_id")) }, { header: "Status", accessorFn: (row) => str(row, "status"), cell: ({ row }) => <Badge tone={tone(str(row.original, "status"))}>{str(row.original, "status")}</Badge> }, { header: "Verification", accessorFn: (row) => str(row, "verification_status", str(row, "verified_at")) }, { header: "Created", accessorFn: (row) => when(row) }];
  return <Page data-p17-admin="domains"><PageHeader title="Domains" description="Cross-workspace custom-domain governance and verification state." /><DataRegion title="Domain inventory"><DataTable data={asRows(query.data)} columns={columns} label={text("Admin domains", "后台域名")} density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion></Page>;
}

function adminPayload(value: unknown) { const payload = asObject(value); return { rows: asRows(value), roles: asObject(payload.role_templates), permissions: payload.permission_catalog }; }
export function AdministratorsPage() {
  const query = useAdmin("administrators", "/api/admin/administrators"); const qc = useQueryClient(); const payload = adminPayload(query.data); const [selected, setSelected] = useState<Row | null>(null); const [role, setRole] = useState("operator"); const [status, setStatus] = useState("active");
  const mutation = useMutation({ mutationFn: () => selected ? api.patch(`/api/admin/administrators/${rid(asObject(selected.administrator ?? selected))}`, { role, status, permissions: [] }) : Promise.reject(new Error("Select an administrator.")), onSuccess: async () => { setSelected(null); await qc.invalidateQueries({ queryKey: ["admin", "p17", "administrators"] }); } });
  const columns: ColumnDef<Row>[] = [{ header: "Administrator", accessorFn: (row) => str(asObject(row.administrator ?? row), "email") }, { header: "Name", accessorFn: (row) => str(asObject(row.administrator ?? row), "display_name") }, { header: "Role", accessorFn: (row) => str(asObject(row.administrator ?? row), "role") }, { header: "Status", accessorFn: (row) => str(asObject(row.administrator ?? row), "status") }, { id: "actions", header: "Governance", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { const admin = asObject(row.original.administrator ?? row.original); setSelected(row.original); setRole(str(admin, "role", "operator")); setStatus(str(admin, "status", "active")); }}>Edit</Button> }];
  return <Page data-p17-admin="administrators"><PageHeader title="Administrators" description="Privileged administrator inventory. Server-side super-administrator checks remain authoritative for role changes." /><DataRegion title="Administrator accounts"><DataTable data={payload.rows} columns={columns} label="Administrators" density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion>{selected ? <section className="p17-action-card"><h2>Administrator access</h2><Field label="Role" htmlFor="admin-role"><Select id="admin-role" value={role} onChange={(event) => setRole(event.currentTarget.value)}>{Object.keys(payload.roles).map((name) => <option key={name} value={name}>{name}</option>)}</Select></Field><Field label="Status" htmlFor="admin-status"><Select id="admin-status" value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="active">Active</option><option value="disabled">Disabled</option></Select></Field><div className="p17-actions"><Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Save access</Button><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button></div></section> : null}</Page>;
}

export function RolesPage() {
  const { text } = useLocale();
  const query = useAdmin("role-catalog", "/api/admin/administrators"); const roles = asObject(asObject(query.data).role_templates); const data = Object.entries(roles).map(([name, value]) => ({ name, permissions: Array.isArray(value) ? value.join(", ") : String(value ?? "") }));
  const columns: ColumnDef<Row>[] = [{ header: "Role", accessorFn: (row) => str(row, "name") }, { header: "Effective permissions", accessorFn: (row) => str(row, "permissions") }];
  return <Page data-p17-admin="roles"><PageHeader title="Roles" description="Effective Admin role templates returned by the same server authority used during authorization." /><DataRegion title="Role templates"><DataTable data={data} columns={columns} label={text("Admin role templates", "后台管理员角色模板")} density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion></Page>;
}

export function PermissionsPage() {
  const { text } = useLocale();
  const query = useAdmin("permission-catalog", "/api/admin/administrators"); const raw = asObject(query.data).permission_catalog;
  const data: Row[] = Array.isArray(raw) ? raw.map((entry) => typeof entry === "string" ? { permission: entry } : asObject(entry)) : Object.entries(asObject(raw)).map(([permission, description]) => ({ permission, description: String(description ?? "") }));
  const columns: ColumnDef<Row>[] = [{ header: "Permission", accessorFn: (row) => str(row, "permission", str(row, "name")) }, { header: "Description", accessorFn: (row) => str(row, "description", str(row, "label")) }];
  return <Page data-p17-admin="permissions"><PageHeader title="Permissions" description="Permission catalog used by Admin RBAC. Client rendering is informational; the server remains the enforcement boundary." /><DataRegion title="Permission catalog"><DataTable data={data} columns={columns} label={text("Admin permission catalog", "后台权限目录")} density="compact" loading={query.isLoading} error={query.error ? err(query.error) : ""} /></DataRegion></Page>;
}
