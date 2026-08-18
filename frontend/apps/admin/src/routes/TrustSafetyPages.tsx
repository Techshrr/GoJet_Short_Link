import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, Field, Page, PageHeader, Select, Textarea } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";

type Row = Record<string, unknown>;
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Row[];
  const record = object(value);
  for (const key of ["data", "items", "risks", "reports", "events", "logs"]) if (Array.isArray(record[key])) return record[key] as Row[];
  return [];
}
function text(row: Row, key: string, fallback = "—") { const value = row[key]; return value === undefined || value === null || value === "" ? fallback : String(value); }
function id(row: Row) { return text(row, "id", text(row, "link_id", "")); }
function date(row: Row, key = "created_at") { const value = text(row, key, ""); if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString(); }
function tone(value: string): Tone { const v = value.toLowerCase(); if (["active", "allow", "resolved", "clean", "success"].includes(v)) return "success"; if (["review", "investigating", "pending", "warning", "scanning"].includes(v)) return "warning"; if (["block", "blocked", "infected", "critical", "high", "error", "open"].includes(v)) return "danger"; return "neutral"; }
function message(error: unknown) { return error instanceof Error ? error.message : "请求失败，请稍后重试。"; }
function useQueue(endpoint: string, key: string) { return useQuery({ queryKey: ["admin", "p16", key], queryFn: () => api.get<unknown>(endpoint) }); }
function DetailPathId() { return useRouterState({ select: (state) => state.location.pathname.split("/").filter(Boolean).at(-1) ?? "" }); }

export function DestinationRiskPage() {
  const query = useQueue("/api/admin/destination-risks?limit=100", "destination-risk");
  const columns: ColumnDef<Row>[] = [
    { header: "Link", accessorFn: (row) => text(row, "code", `#${text(row, "link_id")}`) },
    { header: "Workspace", accessorFn: (row) => text(row, "workspace_id") },
    { header: "Destination", accessorFn: (row) => text(row, "destination") },
    { header: "Automatic", accessorFn: (row) => text(row, "decision"), cell: ({ row }) => <Badge tone={tone(text(row.original, "decision"))}>{text(row.original, "decision")}</Badge> },
    { header: "Effective", accessorFn: (row) => text(row, "effective_decision"), cell: ({ row }) => <Badge tone={tone(text(row.original, "effective_decision"))}>{text(row.original, "effective_decision")}</Badge> },
    { header: "Score", accessorFn: (row) => Number(row.score ?? 0) },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => <a className="admin-table-link" href={`/admin/destination-risk/${text(row.original, "link_id")}`}>Review</a> },
  ];
  return <Page data-p16-trust-safety="destination-risk"><PageHeader title="Destination Risk" description="Review automatic link-destination decisions, stale scans and manual overrides. Provider evidence remains restricted to Admin detail." /><DataRegion title="Risk queue" description="Manual overrides fail closed and require an operator reason."><DataTable data={rows(query.data)} columns={columns} label="Destination risk review queue" density="compact" loading={query.isLoading} error={query.error ? message(query.error) : undefined} emptyTitle="No destinations awaiting review" emptyDescription="Risk assessments will appear here when they are available." /></DataRegion></Page>;
}

export function DestinationRiskDetailPage() {
  const linkId = DetailPathId();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "p16", "destination-risk", linkId], queryFn: () => api.get<unknown>(`/api/admin/destination-risks/${linkId}`), enabled: Boolean(linkId) });
  const [decision, setDecision] = useState("review");
  const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: async (kind: "override" | "rescan" | "clear") => {
    if (reason.trim().length < 3) throw new Error("Reason must contain at least 3 characters.");
    if (kind === "override") return api.post(`/api/admin/destination-risks/${linkId}/override`, { decision, reason: reason.trim() });
    if (kind === "rescan") return api.post(`/api/admin/destination-risks/${linkId}/rescan`, { reason: reason.trim() });
    return api.delete(`/api/admin/destination-risks/${linkId}/override`, { body: JSON.stringify({ reason: reason.trim() }) });
  }, onSuccess: async () => { setReason(""); await queryClient.invalidateQueries({ queryKey: ["admin", "p16", "destination-risk"] }); } });
  const payload = object(query.data); const risk = object(payload.risk); const targets = Array.isArray(payload.targets) ? payload.targets.map(String) : [];
  return <Page data-p16-trust-safety="destination-risk-detail"><PageHeader title={`Destination Risk · #${linkId}`} description="Admin-only decision detail. Customer-facing surfaces never expose provider identity or internal evidence." actions={<a className="admin-table-link" href="/admin/destination-risk">Back to queue</a>} />{query.error ? <Alert tone="danger" title="Risk detail unavailable">{message(query.error)}</Alert> : null}<div className="admin-governance-grid"><section className="admin-governance-card"><h2>Assessment</h2><dl className="admin-kv"><div><dt>Automatic</dt><dd><Badge tone={tone(text(risk, "decision"))}>{text(risk, "decision")}</Badge></dd></div><div><dt>Effective</dt><dd><Badge tone={tone(text(risk, "effective_decision"))}>{text(risk, "effective_decision")}</Badge></dd></div><div><dt>Score</dt><dd>{text(risk, "score")}</dd></div><div><dt>Provider</dt><dd>{text(risk, "provider")}</dd></div><div><dt>Scanned URL</dt><dd className="admin-break">{text(risk, "scanned_url")}</dd></div><div><dt>Targets</dt><dd className="admin-break">{targets.join(" · ") || "—"}</dd></div><div><dt>Stale</dt><dd>{payload.stale ? "Yes" : "No"}</dd></div><div><dt>Last scan</dt><dd>{date(risk, "scanned_at")}</dd></div></dl></section><section className="admin-governance-card"><h2>Governance action</h2><p className="admin-muted">Overrides, override removal and rescan requests require an explicit reason before execution.</p><Field label="Decision" htmlFor="risk-decision"><Select id="risk-decision" value={decision} onChange={(event) => setDecision(event.currentTarget.value)}><option value="allow">Allow</option><option value="review">Review</option><option value="block">Block</option></Select></Field><Field label="Reason" htmlFor="risk-reason" required help="3–500 characters. This is governance evidence, not customer-facing content."><Textarea id="risk-reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} rows={5} /></Field>{mutation.error ? <Alert tone="danger" title="Action failed">{message(mutation.error)}</Alert> : null}<div className="admin-action-row"><Button disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate("override")}>Apply override</Button><Button variant="outline" disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate("rescan")}>Queue rescan</Button><Button variant="destructive" disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate("clear")}>Clear override</Button></div></section></div></Page>;
}

export function FileSecurityPage() {
  const queryClient = useQueryClient(); const query = useQueue("/api/admin/files", "file-security");
  const mutation = useMutation({ mutationFn: (fileId: string) => api.post(`/api/admin/files/${fileId}/retry-scan`, {}), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "p16", "file-security"] }) });
  const columns: ColumnDef<Row>[] = [
    { header: "File", accessorFn: (row) => text(row, "name") }, { header: "Workspace", accessorFn: (row) => text(row, "workspace") }, { header: "MIME", accessorFn: (row) => text(row, "mime") }, { header: "Size", accessorFn: (row) => Number(row.size ?? 0) },
    { header: "Scan", accessorFn: (row) => text(row, "scan_status"), cell: ({ row }) => <Badge tone={tone(text(row.original, "scan_status"))}>{text(row.original, "scan_status")}</Badge> }, { header: "Attempts", accessorFn: (row) => Number(row.scan_attempts ?? 0) }, { header: "Created", accessorFn: (row) => date(row) },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => text(row.original, "scan_status") === "error" ? <Button size="sm" variant="outline" loading={mutation.isPending} onClick={() => mutation.mutate(id(row.original))}>Retry scan</Button> : <span className="admin-muted">Policy locked</span> },
  ];
  return <Page data-p16-trust-safety="file-security"><PageHeader title="File Security" description="Inspect scan state, MIME, retry backlog and immutable infected-file policy. Files are never rendered in an iframe from this console." />{mutation.error ? <Alert tone="danger" title="Scan action failed">{message(mutation.error)}</Alert> : null}<DataRegion title="Security queue"><DataTable data={rows(query.data)} columns={columns} label="File security queue" density="compact" loading={query.isLoading} error={query.error ? message(query.error) : undefined} /></DataRegion></Page>;
}

export function AbuseReportsPage() {
  const query = useQueue("/api/admin/abuse", "abuse"); const queryClient = useQueryClient(); const [selected, setSelected] = useState<Row | null>(null); const [status, setStatus] = useState("investigating"); const [resolution, setResolution] = useState("");
  const mutation = useMutation({ mutationFn: () => { if (!selected || resolution.trim().length < 3) throw new Error("Resolution reason must contain at least 3 characters."); return api.patch(`/api/admin/abuse/${id(selected)}`, { status, resolution: resolution.trim() }); }, onSuccess: async () => { setSelected(null); setResolution(""); await queryClient.invalidateQueries({ queryKey: ["admin", "p16", "abuse"] }); } });
  const columns: ColumnDef<Row>[] = [ { header: "Report", accessorFn: (row) => `#${id(row)}` }, { header: "Link", accessorFn: (row) => text(row, "code", text(row, "link_id")) }, { header: "Reason", accessorFn: (row) => text(row, "reason") }, { header: "Reporter", accessorFn: (row) => text(row, "reporter") }, { header: "Status", accessorFn: (row) => text(row, "status"), cell: ({ row }) => <Badge tone={tone(text(row.original, "status"))}>{text(row.original, "status")}</Badge> }, { header: "Created", accessorFn: (row) => date(row) }, { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setStatus(text(row.original, "status") === "open" ? "investigating" : text(row.original, "status")); setResolution(""); }}>Handle</Button> } ];
  return <Page data-p16-trust-safety="abuse"><PageHeader title="Abuse Reports" description="Triage reports, investigate linked resources and record a mandatory resolution reason." /><DataRegion title="Moderation queue"><DataTable data={rows(query.data)} columns={columns} label="Abuse reports" density="compact" loading={query.isLoading} error={query.error ? message(query.error) : undefined} /></DataRegion>{selected ? <section className="admin-governance-card admin-action-panel"><h2>Handle report #{id(selected)}</h2><p className="admin-muted admin-break">{text(selected, "details")}</p><Field label="Outcome" htmlFor="abuse-status"><Select id="abuse-status" value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></Select></Field><Field label="Resolution reason" htmlFor="abuse-resolution" required><Textarea id="abuse-resolution" rows={4} value={resolution} onChange={(event) => setResolution(event.currentTarget.value)} /></Field>{mutation.error ? <Alert tone="danger" title="Moderation action failed">{message(mutation.error)}</Alert> : null}<div className="admin-action-row"><Button disabled={resolution.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>Save decision</Button><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button></div></section> : null}</Page>;
}

export function SecurityEventsPage() {
  const query = useQueue("/api/admin/security", "security-events"); const queryClient = useQueryClient(); const [selected, setSelected] = useState<Row | null>(null); const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: () => { if (!selected || reason.trim().length < 3) throw new Error("Resolution reason must contain at least 3 characters."); return api.patch(`/api/admin/security/${id(selected)}`, { reason: reason.trim() }); }, onSuccess: async () => { setSelected(null); setReason(""); await queryClient.invalidateQueries({ queryKey: ["admin", "p16", "security-events"] }); } });
  const columns: ColumnDef<Row>[] = [ { header: "Event", accessorFn: (row) => text(row, "event_type") }, { header: "Severity", accessorFn: (row) => text(row, "severity"), cell: ({ row }) => <Badge tone={tone(text(row.original, "severity"))}>{text(row.original, "severity")}</Badge> }, { header: "Source", accessorFn: (row) => text(row, "source") }, { header: "Description", accessorFn: (row) => text(row, "description") }, { header: "Status", accessorFn: (row) => text(row, "status") }, { header: "Created", accessorFn: (row) => date(row) }, { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => text(row.original, "status") === "open" ? <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setReason(""); }}>Resolve</Button> : <span className="admin-muted">Resolved</span> } ];
  return <Page data-p16-trust-safety="security-events"><PageHeader title="Security Events" description="Review platform security signals and explicitly close investigated events." /><DataRegion title="Event queue"><DataTable data={rows(query.data)} columns={columns} label="Security events" density="compact" loading={query.isLoading} error={query.error ? message(query.error) : undefined} /></DataRegion>{selected ? <section className="admin-governance-card admin-action-panel"><h2>Resolve event #{id(selected)}</h2><p>{text(selected, "description")}</p><Field label="Resolution reason" htmlFor="security-resolution" required><Textarea id="security-resolution" rows={4} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field><div className="admin-action-row"><Button disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>Resolve event</Button><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button></div></section> : null}</Page>;
}

export function AuditPage() {
  const query = useQueue("/api/admin/audit?limit=100", "audit");
  const columns: ColumnDef<Row>[] = [ { header: "Time", accessorFn: (row) => date(row) }, { header: "Actor", accessorFn: (row) => text(row, "actor") }, { header: "Workspace", accessorFn: (row) => text(row, "workspace") }, { header: "Action", accessorFn: (row) => text(row, "action") }, { header: "Target type", accessorFn: (row) => text(row, "target_type") }, { header: "Target", accessorFn: (row) => text(row, "target_id") } ];
  return <Page data-p16-trust-safety="audit"><PageHeader title="Audit Log" description="Read-only governance history. Secrets and raw internal evidence are intentionally excluded from this table." /><DataRegion title="Audit trail" description="Administrator and workspace audit streams are normalized into a single timeline."><DataTable data={rows(query.data)} columns={columns} label="Audit log" density="compact" loading={query.isLoading} error={query.error ? message(query.error) : undefined} /></DataRegion></Page>;
}
