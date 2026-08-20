import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, Field, Page, PageHeader, Select, Textarea, localizedError, useLocale, type GoJetLocale } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";

type Row = Record<string, unknown>;
type Tone = "neutral" | "success" | "warning" | "danger" | "info";
type Copy = (en: string, zh: string) => string;

function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Row[];
  const record = object(value);
  for (const key of ["data", "items", "risks", "reports", "events", "logs"]) if (Array.isArray(record[key])) return record[key] as Row[];
  return [];
}
function valueText(row: Row, key: string, fallback = "—") { const value = row[key]; return value === undefined || value === null || value === "" ? fallback : String(value); }
function id(row: Row) { return valueText(row, "id", valueText(row, "link_id", "")); }
function date(row: Row, key = "created_at") { const value = valueText(row, key, ""); if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString(); }
function tone(value: string): Tone { const normalized = value.toLowerCase(); if (["active", "allow", "resolved", "clean", "success"].includes(normalized)) return "success"; if (["review", "investigating", "pending", "warning", "scanning"].includes(normalized)) return "warning"; if (["block", "blocked", "infected", "critical", "high", "error", "open"].includes(normalized)) return "danger"; return "neutral"; }
function errorStatus(error: unknown): number | undefined { if (!error || typeof error !== "object" || !("status" in error)) return undefined; const status = (error as { status?: unknown }).status; return typeof status === "number" ? status : undefined; }
function message(error: unknown, locale: GoJetLocale) { return localizedError(error instanceof Error ? error.message : undefined, locale, errorStatus(error)); }
function useQueue(endpoint: string, key: string) { return useQuery({ queryKey: ["admin", "p16", key], queryFn: () => api.get<unknown>(endpoint) }); }
function DetailPathId() { return useRouterState({ select: (state) => state.location.pathname.split("/").filter(Boolean).at(-1) ?? "" }); }
function decisionLabel(value: string, c: Copy) { return value === "allow" ? c("Allowed", "允许访问") : value === "review" ? c("Needs review", "需要复核") : value === "block" || value === "blocked" ? c("Blocked", "已阻止") : value; }
function statusLabel(value: string, c: Copy) { return value === "open" ? c("Open", "待处理") : value === "investigating" ? c("Investigating", "调查中") : value === "resolved" ? c("Resolved", "已解决") : value === "rejected" ? c("Rejected", "已驳回") : value === "clean" ? c("Ready", "检查通过") : value === "scanning" || value === "pending" ? c("Checking", "检查中") : value === "infected" || value === "blocked" ? c("Blocked", "已阻止") : value === "error" || value === "failed" ? c("Check failed", "检查失败") : value; }

export function DestinationRiskPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const query = useQueue("/api/admin/destination-risks?limit=100", "destination-risk");
  const columns: ColumnDef<Row>[] = [
    { header: c("Link", "短链接"), accessorFn: (row) => valueText(row, "code", `#${valueText(row, "link_id")}`) },
    { header: c("Workspace", "工作区"), accessorFn: (row) => valueText(row, "workspace_id") },
    { header: c("Destination", "目标地址"), accessorFn: (row) => valueText(row, "destination") },
    { header: c("Automatic result", "自动检测结果"), accessorFn: (row) => valueText(row, "decision"), cell: ({ row }) => <Badge tone={tone(valueText(row.original, "decision"))}>{decisionLabel(valueText(row.original, "decision"), c)}</Badge> },
    { header: c("Current result", "当前生效结果"), accessorFn: (row) => valueText(row, "effective_decision"), cell: ({ row }) => <Badge tone={tone(valueText(row.original, "effective_decision"))}>{decisionLabel(valueText(row.original, "effective_decision"), c)}</Badge> },
    { header: c("Score", "评分"), accessorFn: (row) => Number(row.score ?? 0) },
    { id: "actions", header: c("Action", "操作"), enableSorting: false, cell: ({ row }) => <a className="admin-table-link" href={`/admin/destination-risk/${valueText(row.original, "link_id")}`}>{c("Review", "复核")}</a> },
  ];
  return <Page data-p16-trust-safety="destination-risk"><PageHeader title={c("Destination checks", "目标地址检测")} description={c("Review link destinations that need attention, including outdated checks and administrator decisions that differ from the latest automatic result.", "查看需要关注的短链接目标地址，包括检测结果已过期或管理员处理结果与最新自动检测不同的项目。")}/><DataRegion title={c("Review list", "待复核列表")} description={c("Open an item to inspect the current assessment and record a reviewed decision when necessary.", "打开项目后可查看当前检测详情，并在确有需要时记录人工复核结果。")}><DataTable data={rows(query.data)} columns={columns} label={c("Destination review list", "目标地址复核列表")} density="compact" loading={query.isLoading} error={query.error ? message(query.error, locale) : ""} emptyTitle={c("Nothing needs review", "暂无待复核项目")} emptyDescription={c("Items that require administrator attention will appear here.", "需要管理员处理的目标地址会显示在这里。")}/></DataRegion></Page>;
}

export function DestinationRiskDetailPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const linkId = DetailPathId();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "p16", "destination-risk", linkId], queryFn: () => api.get<unknown>(`/api/admin/destination-risks/${linkId}`), enabled: Boolean(linkId) });
  const [decision, setDecision] = useState("review");
  const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: async (kind: "override" | "rescan" | "clear") => {
    if (reason.trim().length < 3) throw new Error(c("Please enter at least 3 characters explaining the change.", "请至少填写 3 个字符说明处理原因。"));
    if (kind === "override") return api.post(`/api/admin/destination-risks/${linkId}/override`, { decision, reason: reason.trim() });
    if (kind === "rescan") return api.post(`/api/admin/destination-risks/${linkId}/rescan`, { reason: reason.trim() });
    return api.delete(`/api/admin/destination-risks/${linkId}/override`, { body: JSON.stringify({ reason: reason.trim() }) });
  }, onSuccess: async () => { setReason(""); await queryClient.invalidateQueries({ queryKey: ["admin", "p16", "destination-risk"] }); } });
  const payload = object(query.data); const risk = object(payload.risk); const targets = Array.isArray(payload.targets) ? payload.targets.map(String) : [];
  return <Page data-p16-trust-safety="destination-risk-detail"><PageHeader title={c(`Destination check · #${linkId}`, `目标地址检测 · #${linkId}`)} description={c("Review the automatic assessment, affected destinations and any previous administrator decision before making a change.", "在调整处理结果前，请先核对自动检测结果、涉及的目标地址以及此前的管理员处理记录。") } actions={<a className="admin-table-link" href="/admin/destination-risk">{c("Back to review list", "返回复核列表")}</a>} />{query.error ? <Alert tone="danger" title={c("Unable to load destination details", "无法加载目标地址详情")}>{message(query.error, locale)}</Alert> : null}<div className="admin-governance-grid"><section className="admin-governance-card"><h2>{c("Assessment details", "检测详情")}</h2><dl className="admin-kv"><div><dt>{c("Automatic result", "自动检测结果")}</dt><dd><Badge tone={tone(valueText(risk, "decision"))}>{decisionLabel(valueText(risk, "decision"), c)}</Badge></dd></div><div><dt>{c("Current result", "当前生效结果")}</dt><dd><Badge tone={tone(valueText(risk, "effective_decision"))}>{decisionLabel(valueText(risk, "effective_decision"), c)}</Badge></dd></div><div><dt>{c("Score", "评分")}</dt><dd>{valueText(risk, "score")}</dd></div><div><dt>{c("Detection provider", "检测服务")}</dt><dd>{valueText(risk, "provider")}</dd></div><div><dt>{c("Checked address", "已检测地址")}</dt><dd className="admin-break">{valueText(risk, "scanned_url")}</dd></div><div><dt>{c("Affected destinations", "涉及目标地址")}</dt><dd className="admin-break">{targets.join(" · ") || "—"}</dd></div><div><dt>{c("Needs a fresh check", "是否需要重新检测")}</dt><dd>{payload.stale ? c("Yes", "是") : c("No", "否")}</dd></div><div><dt>{c("Last checked", "最近检测时间")}</dt><dd>{date(risk, "scanned_at")}</dd></div></dl></section><section className="admin-governance-card"><h2>{c("Administrator decision", "管理员处理")}</h2><p className="admin-muted">{c("Choose a result only after reviewing the destination. Every change and rescan request must include a reason so it can be reviewed later.", "请在核对目标地址后再选择处理结果。每次修改或重新检测都必须填写原因，便于后续核对。")}</p><Field label={c("Decision", "处理结果")} htmlFor="risk-decision"><Select id="risk-decision" value={decision} onChange={(event) => setDecision(event.currentTarget.value)}><option value="allow">{c("Allow", "允许访问")}</option><option value="review">{c("Keep under review", "继续复核")}</option><option value="block">{c("Block", "阻止访问")}</option></Select></Field><Field label={c("Reason", "处理原因")} htmlFor="risk-reason" required help={c("Enter 3–500 characters explaining why this action is appropriate.", "填写 3–500 个字符说明本次处理原因。") }><Textarea id="risk-reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} rows={5}/></Field>{mutation.error ? <Alert tone="danger" title={c("Action could not be completed", "操作未完成")}>{message(mutation.error, locale)}</Alert> : null}<div className="admin-action-row"><Button disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate("override")}>{c("Save decision", "保存处理结果")}</Button><Button variant="outline" disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate("rescan")}>{c("Request a new check", "重新检测")}</Button><Button variant="destructive" disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate("clear")}>{c("Remove administrator decision", "移除人工处理结果")}</Button></div></section></div></Page>;
}

export function FileSecurityPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const queryClient = useQueryClient();
  const query = useQueue("/api/admin/files", "file-security");
  const mutation = useMutation({ mutationFn: (fileId: string) => api.post(`/api/admin/files/${fileId}/retry-scan`, {}), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "p16", "file-security"] }) });
  const columns: ColumnDef<Row>[] = [
    { header: c("File", "文件"), accessorFn: (row) => valueText(row, "name") },
    { header: c("Workspace", "工作区"), accessorFn: (row) => valueText(row, "workspace") },
    { header: "MIME", accessorFn: (row) => valueText(row, "mime") },
    { header: c("Size", "大小"), accessorFn: (row) => Number(row.size ?? 0) },
    { header: c("Check status", "检查状态"), accessorFn: (row) => valueText(row, "scan_status"), cell: ({ row }) => <Badge tone={tone(valueText(row.original, "scan_status"))}>{statusLabel(valueText(row.original, "scan_status"), c)}</Badge> },
    { header: c("Attempts", "检查次数"), accessorFn: (row) => Number(row.scan_attempts ?? 0) },
    { header: c("Created", "创建时间"), accessorFn: (row) => date(row) },
    { id: "actions", header: c("Action", "操作"), enableSorting: false, cell: ({ row }) => valueText(row.original, "scan_status") === "error" ? <Button size="sm" variant="outline" loading={mutation.isPending} onClick={() => mutation.mutate(id(row.original))}>{c("Retry check", "重新检查")}</Button> : <span className="admin-muted">{c("No action needed", "无需操作")}</span> },
  ];
  return <Page data-p16-trust-safety="file-security"><PageHeader title={c("File protection", "文件安全") } description={c("Review file scan results and retry files whose safety check ended with an error. Files identified as unsafe remain unavailable for download.", "查看文件安全检查结果，并对因错误中断的文件重新执行检查。被识别为不安全的文件会继续保持不可下载状态。")}/>{mutation.error ? <Alert tone="danger" title={c("File check could not be retried", "文件重新检查失败")}>{message(mutation.error, locale)}</Alert> : null}<DataRegion title={c("File review list", "文件检查列表")}><DataTable data={rows(query.data)} columns={columns} label={c("File protection list", "文件安全列表")} density="compact" loading={query.isLoading} error={query.error ? message(query.error, locale) : ""}/></DataRegion></Page>;
}

export function AbuseReportsPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const query = useQueue("/api/admin/abuse", "abuse");
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);
  const [status, setStatus] = useState("investigating");
  const [resolution, setResolution] = useState("");
  const mutation = useMutation({ mutationFn: () => { if (!selected || resolution.trim().length < 3) throw new Error(c("Please enter at least 3 characters describing the outcome.", "请至少填写 3 个字符说明处理结果。")); return api.patch(`/api/admin/abuse/${id(selected)}`, { status, resolution: resolution.trim() }); }, onSuccess: async () => { setSelected(null); setResolution(""); await queryClient.invalidateQueries({ queryKey: ["admin", "p16", "abuse"] }); } });
  const columns: ColumnDef<Row>[] = [
    { header: c("Report", "举报") , accessorFn: (row) => `#${id(row)}` },
    { header: c("Link", "短链接"), accessorFn: (row) => valueText(row, "code", valueText(row, "link_id")) },
    { header: c("Reason", "举报原因"), accessorFn: (row) => valueText(row, "reason") },
    { header: c("Reporter", "举报人"), accessorFn: (row) => valueText(row, "reporter") },
    { header: c("Status", "状态"), accessorFn: (row) => valueText(row, "status"), cell: ({ row }) => <Badge tone={tone(valueText(row.original, "status"))}>{statusLabel(valueText(row.original, "status"), c)}</Badge> },
    { header: c("Created", "提交时间"), accessorFn: (row) => date(row) },
    { id: "actions", header: c("Action", "操作"), enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setStatus(valueText(row.original, "status") === "open" ? "investigating" : valueText(row.original, "status")); setResolution(""); }}>{c("Handle", "处理")}</Button> },
  ];
  return <Page data-p16-trust-safety="abuse"><PageHeader title={c("Abuse reports", "滥用举报")} description={c("Review reports about links or shared content, investigate the reported resource and record the outcome before closing the case.", "查看针对短链接或分享内容的举报，核对被举报资源，并在结束处理前记录明确的处理结果。")}/><DataRegion title={c("Reports awaiting review", "待处理举报")}><DataTable data={rows(query.data)} columns={columns} label={c("Abuse report list", "滥用举报列表")} density="compact" loading={query.isLoading} error={query.error ? message(query.error, locale) : ""}/></DataRegion>{selected ? <section className="admin-governance-card admin-action-panel"><h2>{c(`Handle report #${id(selected)}`, `处理举报 #${id(selected)}`)}</h2><p className="admin-muted admin-break">{valueText(selected, "details")}</p><Field label={c("Outcome", "处理状态")} htmlFor="abuse-status"><Select id="abuse-status" value={status} onChange={(event) => setStatus(event.currentTarget.value)}><option value="investigating">{c("Investigating", "调查中")}</option><option value="resolved">{c("Resolved", "已解决")}</option><option value="rejected">{c("Rejected", "已驳回")}</option></Select></Field><Field label={c("Resolution note", "处理说明")} htmlFor="abuse-resolution" required><Textarea id="abuse-resolution" rows={4} value={resolution} onChange={(event) => setResolution(event.currentTarget.value)}/></Field>{mutation.error ? <Alert tone="danger" title={c("Report could not be updated", "举报处理失败")}>{message(mutation.error, locale)}</Alert> : null}<div className="admin-action-row"><Button disabled={resolution.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>{c("Save outcome", "保存处理结果")}</Button><Button variant="ghost" onClick={() => setSelected(null)}>{c("Cancel", "取消")}</Button></div></section> : null}</Page>;
}

export function SecurityEventsPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const query = useQueue("/api/admin/security", "security-events");
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: () => { if (!selected || reason.trim().length < 3) throw new Error(c("Please enter at least 3 characters describing the resolution.", "请至少填写 3 个字符说明处理情况。")); return api.patch(`/api/admin/security/${id(selected)}`, { reason: reason.trim() }); }, onSuccess: async () => { setSelected(null); setReason(""); await queryClient.invalidateQueries({ queryKey: ["admin", "p16", "security-events"] }); } });
  const columns: ColumnDef<Row>[] = [
    { header: c("Event", "事件"), accessorFn: (row) => valueText(row, "event_type") },
    { header: c("Severity", "严重程度"), accessorFn: (row) => valueText(row, "severity"), cell: ({ row }) => <Badge tone={tone(valueText(row.original, "severity"))}>{valueText(row.original, "severity")}</Badge> },
    { header: c("Source", "来源"), accessorFn: (row) => valueText(row, "source") },
    { header: c("Description", "说明"), accessorFn: (row) => valueText(row, "description") },
    { header: c("Status", "状态"), accessorFn: (row) => valueText(row, "status"), cell: ({ row }) => statusLabel(valueText(row.original, "status"), c) },
    { header: c("Created", "记录时间"), accessorFn: (row) => date(row) },
    { id: "actions", header: c("Action", "操作"), enableSorting: false, cell: ({ row }) => valueText(row.original, "status") === "open" ? <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setReason(""); }}>{c("Resolve", "处理")}</Button> : <span className="admin-muted">{c("Resolved", "已处理")}</span> },
  ];
  return <Page data-p16-trust-safety="security-events"><PageHeader title={c("Security events", "安全事件")} description={c("Review recorded security-related events, investigate open items and add a resolution note when an event has been handled.", "查看已记录的安全相关事件，调查尚未处理的项目，并在完成处理后填写处理说明。")}/><DataRegion title={c("Event list", "事件列表")}><DataTable data={rows(query.data)} columns={columns} label={c("Security event list", "安全事件列表")} density="compact" loading={query.isLoading} error={query.error ? message(query.error, locale) : ""}/></DataRegion>{selected ? <section className="admin-governance-card admin-action-panel"><h2>{c(`Resolve event #${id(selected)}`, `处理事件 #${id(selected)}`)}</h2><p>{valueText(selected, "description")}</p><Field label={c("Resolution note", "处理说明")} htmlFor="security-resolution" required><Textarea id="security-resolution" rows={4} value={reason} onChange={(event) => setReason(event.currentTarget.value)}/></Field>{mutation.error ? <Alert tone="danger" title={c("Event could not be updated", "事件处理失败")}>{message(mutation.error, locale)}</Alert> : null}<div className="admin-action-row"><Button disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>{c("Mark as resolved", "标记为已处理")}</Button><Button variant="ghost" onClick={() => setSelected(null)}>{c("Cancel", "取消")}</Button></div></section> : null}</Page>;
}

export function AuditPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const query = useQueue("/api/admin/audit?limit=100", "audit");
  const columns: ColumnDef<Row>[] = [
    { header: c("Time", "时间"), accessorFn: (row) => date(row) },
    { header: c("Actor", "操作人"), accessorFn: (row) => valueText(row, "actor") },
    { header: c("Workspace", "工作区"), accessorFn: (row) => valueText(row, "workspace") },
    { header: c("Action", "操作"), accessorFn: (row) => valueText(row, "action") },
    { header: c("Target type", "对象类型"), accessorFn: (row) => valueText(row, "target_type") },
    { header: c("Target", "对象"), accessorFn: (row) => valueText(row, "target_id") },
  ];
  return <Page data-p16-trust-safety="audit"><PageHeader title={c("Audit log", "审计日志")} description={c("Review administrator and workspace changes in chronological order. Sensitive credentials and private raw payloads are not shown in this list.", "按时间顺序查看管理员和工作区的重要操作记录。敏感凭据和私密原始内容不会显示在此列表中。")}/><DataRegion title={c("Activity history", "操作记录")} description={c("Use this history to confirm who changed an item, when it changed and which resource was affected.", "可通过这里核对由谁、在什么时间修改了哪个资源。") }><DataTable data={rows(query.data)} columns={columns} label={c("Audit activity", "审计记录")} density="compact" loading={query.isLoading} error={query.error ? message(query.error, locale) : ""}/></DataRegion></Page>;
}
