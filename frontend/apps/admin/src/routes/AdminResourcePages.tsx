import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, Field, Page, PageHeader, Textarea, useLocale } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";

type Row = Record<string, unknown>;
type ResourceKind = "link" | "qr" | "file" | "text" | "bio";
type Tone = "neutral" | "success" | "warning" | "danger" | "info";
type Copy = (en: string, zh: string) => string;

function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] { if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Row[]; const data = object(value).data; return Array.isArray(data) ? data.filter((item) => item && typeof item === "object") as Row[] : []; }
function cellText(row: Row, key: string, fallback = "—") { const value = row[key]; return value === undefined || value === null || value === "" ? fallback : String(value); }
function numericId(row: Row) { return cellText(row, "resource_id", cellText(row, "id", "")); }
function date(row: Row, key = "created_at") { const raw = cellText(row, key, ""); if (!raw) return "—"; const parsed = new Date(raw); return Number.isNaN(parsed.valueOf()) ? raw : parsed.toLocaleString(); }
function errorText(error: unknown, c: Copy) { return error instanceof Error ? error.message : c("Request failed. Please try again.", "请求失败，请稍后重试。"); }
function tone(value: string): Tone { const normalized = value.toLowerCase(); if (["active", "ready", "published"].includes(normalized)) return "success"; if (["paused", "quarantined", "pending"].includes(normalized)) return "warning"; if (["blocked", "infected", "failed"].includes(normalized)) return "danger"; return "neutral"; }
function statusLabel(value: string, c: Copy) { const key = value.toLowerCase(); if (key === "active") return c("Active", "正常"); if (key === "ready") return c("Ready", "可用"); if (key === "published") return c("Published", "已发布"); if (key === "paused") return c("Paused", "已暂停"); if (key === "quarantined") return c("Restricted", "已限制"); if (key === "pending") return c("Pending", "等待处理"); if (key === "blocked") return c("Blocked", "已阻止"); if (key === "infected") return c("Unsafe", "不安全"); if (key === "failed") return c("Failed", "失败"); return value; }

function mergeGovernanceRows(kind: ResourceKind, inventoryValue: unknown, quarantineValue: unknown): Row[] {
  const inventory = rows(inventoryValue).filter((row) => cellText(row, "resource_type", "").toLowerCase() === kind);
  const quarantines = rows(quarantineValue).filter((row) => cellText(row, "resource_type", "").toLowerCase() === kind && cellText(row, "status", "").toLowerCase() === "quarantined");
  const currentByResource = new Map(quarantines.map((row) => [cellText(row, "resource_id", ""), row]));
  const seen = new Set<string>();
  const merged = inventory.map((row) => { const resourceId = cellText(row, "id", cellText(row, "resource_id", "")); seen.add(resourceId); const quarantine = currentByResource.get(resourceId); if (!quarantine) return row; return { ...row, status: "quarantined", quarantine_id: quarantine.id, quarantine_reason: quarantine.reason, quarantined_at: quarantine.quarantined_at }; });
  for (const quarantine of quarantines) { const resourceId = cellText(quarantine, "resource_id", ""); if (seen.has(resourceId)) continue; merged.push({ resource_type: kind, resource_id: resourceId, id: resourceId, name: `#${resourceId}`, workspace: quarantine.workspace, workspace_id: quarantine.workspace_id, status: "quarantined", quarantine_id: quarantine.id, quarantine_reason: quarantine.reason, created_at: quarantine.quarantined_at, quarantined_at: quarantine.quarantined_at }); }
  return merged;
}

function ResourceGovernancePage({ kind, titleEn, titleZh }: { kind: ResourceKind; titleEn: string; titleZh: string }) {
  const { locale } = useLocale(); const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en; const title = c(titleEn, titleZh);
  const inventory = useQuery({ queryKey: ["admin", "p17", "resource-inventory"], queryFn: () => api.get<unknown>("/api/admin/resource-inventory?limit=500") });
  const quarantine = useQuery({ queryKey: ["admin", "p17", "resource-quarantine"], queryFn: () => api.get<unknown>("/api/admin/resources") });
  const queryClient = useQueryClient(); const [selected, setSelected] = useState<Row | null>(null); const [reason, setReason] = useState(""); const data = mergeGovernanceRows(kind, inventory.data, quarantine.data);
  const mutation = useMutation({ mutationFn: () => { if (!selected || reason.trim().length < 3) throw new Error(c("Enter a reason with at least 3 characters.", "请输入至少 3 个字符的操作原因。")); const quarantineId = cellText(selected, "quarantine_id", ""); if (quarantineId) return api.post(`/api/admin/quarantine/${quarantineId}/restore`, { reason: reason.trim() }); return api.post(`/api/admin/resources/${kind}/${numericId(selected)}/quarantine`, { reason: reason.trim() }); }, onSuccess: async () => { setSelected(null); setReason(""); await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "p17", "resource-inventory"] }), queryClient.invalidateQueries({ queryKey: ["admin", "p17", "resource-quarantine"] })]); } });
  const columns: ColumnDef<Row>[] = [
    { header: c("Content", "内容"), accessorFn: (row) => cellText(row, "title", cellText(row, "name", `#${numericId(row)}`)) },
    { header: c("Workspace", "工作区"), accessorFn: (row) => cellText(row, "workspace", cellText(row, "workspace_id")) },
    { header: c("Status", "状态"), accessorFn: (row) => cellText(row, "status"), cell: ({ row }) => <Badge tone={tone(cellText(row.original, "status"))}>{statusLabel(cellText(row.original, "status"), c)}</Badge> },
    { header: c("Restriction reason", "限制原因"), accessorFn: (row) => cellText(row, "quarantine_reason") },
    { header: c("Created / restricted", "创建 / 限制时间"), accessorFn: (row) => date(row, row.quarantined_at ? "quarantined_at" : "created_at") },
    { id: "actions", header: c("Action", "操作"), enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setReason(""); }}>{row.original.quarantine_id ? c("Restore", "恢复") : c("Restrict", "限制")}</Button> },
  ];
  const combinedError = inventory.error || quarantine.error;
  return <Page data-p17-admin={`resource-${kind}`}>
    <PageHeader title={title} description={c("Review content across workspaces and restrict or restore items when moderation is required.", "查看各工作区中的内容，并在需要处置时限制或恢复对应资源。")}/>
    {combinedError ? <Alert tone="danger" title={c("Some moderation data is unavailable", "部分内容管理数据暂不可用")}>{errorText(combinedError, c)}</Alert> : null}
    <DataRegion title={c(`${titleEn} inventory`, `${titleZh}列表`)} description={c("Restricted items can be restored from their current moderation record.", "已限制的资源可以根据当前处置记录执行恢复。") }>
      <DataTable data={data} columns={columns} label={c(`${titleEn} moderation list`, `${titleZh}管理列表`)} density="compact" loading={inventory.isLoading || quarantine.isLoading} />
    </DataRegion>
    {selected ? <section className="p17-action-card">
      <h2>{selected.quarantine_id ? c(`Restore ${titleEn.toLowerCase()}`, `恢复${titleZh}`) : c(`Restrict ${titleEn.toLowerCase()}`, `限制${titleZh}`)} #{numericId(selected)}</h2>
      <Field label={c("Administrator reason", "管理员操作原因")} htmlFor={`${kind}-reason`} required help={c("Enter at least 3 characters. The reason is saved with this action.", "请输入至少 3 个字符，原因会随本次操作一并保存。") }><Textarea id={`${kind}-reason`} rows={4} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field>
      {mutation.error ? <Alert tone="danger" title={c("Action failed", "操作失败")}>{errorText(mutation.error, c)}</Alert> : null}
      <div className="p17-actions"><Button variant={selected.quarantine_id ? "outline" : "destructive"} disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>{selected.quarantine_id ? c("Restore content", "恢复内容") : c("Restrict content", "限制内容")}</Button><Button variant="ghost" onClick={() => setSelected(null)}>{c("Cancel", "取消")}</Button></div>
    </section> : null}
  </Page>;
}

export const AdminLinksPage = () => <ResourceGovernancePage kind="link" titleEn="Links" titleZh="短链接" />;
export const AdminQRPage = () => <ResourceGovernancePage kind="qr" titleEn="QR Codes" titleZh="二维码" />;
export const AdminFilesPage = () => <ResourceGovernancePage kind="file" titleEn="Files" titleZh="文件" />;
export const AdminTextPage = () => <ResourceGovernancePage kind="text" titleEn="Text" titleZh="文本分享" />;
export const AdminBioPage = () => <ResourceGovernancePage kind="bio" titleEn="Bio Pages" titleZh="个人主页" />;
