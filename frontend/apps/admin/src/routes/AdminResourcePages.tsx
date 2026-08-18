import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, DataRegion, Field, Page, PageHeader, Textarea } from "@gojet/ui";
import { DataTable, type ColumnDef } from "@gojet/ui/data";

type Row = Record<string, unknown>;
type ResourceKind = "link" | "qr" | "file" | "text" | "bio";
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Row[];
  const data = object(value).data;
  return Array.isArray(data) ? data.filter((item) => item && typeof item === "object") as Row[] : [];
}
function text(row: Row, key: string, fallback = "—") { const value = row[key]; return value === undefined || value === null || value === "" ? fallback : String(value); }
function numericId(row: Row) { return text(row, "resource_id", text(row, "id", "")); }
function date(row: Row, key = "created_at") { const raw = text(row, key, ""); if (!raw) return "—"; const parsed = new Date(raw); return Number.isNaN(parsed.valueOf()) ? raw : parsed.toLocaleString(); }
function errorText(error: unknown) { return error instanceof Error ? error.message : "请求失败，请稍后重试。"; }
function tone(value: string): Tone { const normalized = value.toLowerCase(); if (["active", "ready", "published"].includes(normalized)) return "success"; if (["paused", "quarantined", "pending"].includes(normalized)) return "warning"; if (["blocked", "infected", "failed"].includes(normalized)) return "danger"; return "neutral"; }

function mergeGovernanceRows(kind: ResourceKind, inventoryValue: unknown, quarantineValue: unknown): Row[] {
  const inventory = rows(inventoryValue).filter((row) => text(row, "resource_type", "").toLowerCase() === kind);
  const quarantines = rows(quarantineValue).filter((row) => text(row, "resource_type", "").toLowerCase() === kind && text(row, "status", "").toLowerCase() === "quarantined");
  const currentByResource = new Map(quarantines.map((row) => [text(row, "resource_id", ""), row]));
  const seen = new Set<string>();
  const merged = inventory.map((row) => {
    const resourceId = text(row, "id", text(row, "resource_id", ""));
    seen.add(resourceId);
    const quarantine = currentByResource.get(resourceId);
    if (!quarantine) return row;
    return { ...row, status: "quarantined", quarantine_id: quarantine.id, quarantine_reason: quarantine.reason, quarantined_at: quarantine.quarantined_at };
  });
  for (const quarantine of quarantines) {
    const resourceId = text(quarantine, "resource_id", "");
    if (seen.has(resourceId)) continue;
    merged.push({
      resource_type: kind,
      resource_id: resourceId,
      id: resourceId,
      name: `#${resourceId}`,
      workspace: quarantine.workspace,
      workspace_id: quarantine.workspace_id,
      status: "quarantined",
      quarantine_id: quarantine.id,
      quarantine_reason: quarantine.reason,
      created_at: quarantine.quarantined_at,
      quarantined_at: quarantine.quarantined_at,
    });
  }
  return merged;
}

function ResourceGovernancePage({ kind, title }: { kind: ResourceKind; title: string }) {
  const inventory = useQuery({ queryKey: ["admin", "p17", "resource-inventory"], queryFn: () => api.get<unknown>("/api/admin/resource-inventory?limit=500") });
  const quarantine = useQuery({ queryKey: ["admin", "p17", "resource-quarantine"], queryFn: () => api.get<unknown>("/api/admin/resources") });
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const data = mergeGovernanceRows(kind, inventory.data, quarantine.data);
  const mutation = useMutation({
    mutationFn: () => {
      if (!selected || reason.trim().length < 3) throw new Error("Governance reason must contain at least 3 characters.");
      const quarantineId = text(selected, "quarantine_id", "");
      if (quarantineId) return api.post(`/api/admin/quarantine/${quarantineId}/restore`, { reason: reason.trim() });
      return api.post(`/api/admin/resources/${kind}/${numericId(selected)}/quarantine`, { reason: reason.trim() });
    },
    onSuccess: async () => {
      setSelected(null); setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "p17", "resource-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "p17", "resource-quarantine"] }),
      ]);
    },
  });
  const columns: ColumnDef<Row>[] = [
    { header: "Resource", accessorFn: (row) => text(row, "title", text(row, "name", `#${numericId(row)}`)) },
    { header: "Workspace", accessorFn: (row) => text(row, "workspace", text(row, "workspace_id")) },
    { header: "Status", accessorFn: (row) => text(row, "status"), cell: ({ row }) => <Badge tone={tone(text(row.original, "status"))}>{text(row.original, "status")}</Badge> },
    { header: "Quarantine reason", accessorFn: (row) => text(row, "quarantine_reason") },
    { header: "Created / quarantined", accessorFn: (row) => date(row, row.quarantined_at ? "quarantined_at" : "created_at") },
    { id: "actions", header: "Governance", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => { setSelected(row.original); setReason(""); }}>{row.original.quarantine_id ? "Restore" : "Quarantine"}</Button> },
  ];
  const combinedError = inventory.error || quarantine.error;
  return <Page data-p17-admin={`resource-${kind}`}>
    <PageHeader title={title} description="Cross-workspace resource governance. Active inventory is reconciled with current quarantine records so quarantine and restore remain symmetric for every resource type." />
    {combinedError ? <Alert tone="danger" title="Resource governance partially unavailable">{errorText(combinedError)}</Alert> : null}
    <DataRegion title={`${title} inventory`} description="Restore is available only from an authoritative current quarantine record.">
      <DataTable data={data} columns={columns} label={`Admin ${title}`} density="compact" loading={inventory.isLoading || quarantine.isLoading} />
    </DataRegion>
    {selected ? <section className="p17-action-card">
      <h2>{selected.quarantine_id ? "Restore" : "Quarantine"} {title.toLowerCase()} #{numericId(selected)}</h2>
      <Field label="Governance reason" htmlFor={`${kind}-reason`} required help="At least 3 characters; retained in the server-side governance record.">
        <Textarea id={`${kind}-reason`} rows={4} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
      </Field>
      {mutation.error ? <Alert tone="danger" title="Governance action failed">{errorText(mutation.error)}</Alert> : null}
      <div className="p17-actions">
        <Button variant={selected.quarantine_id ? "outline" : "destructive"} disabled={reason.trim().length < 3} loading={mutation.isPending} onClick={() => mutation.mutate()}>{selected.quarantine_id ? "Restore resource" : "Quarantine resource"}</Button>
        <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
      </div>
    </section> : null}
  </Page>;
}

export const AdminLinksPage = () => <ResourceGovernancePage kind="link" title="Links" />;
export const AdminQRPage = () => <ResourceGovernancePage kind="qr" title="QR Codes" />;
export const AdminFilesPage = () => <ResourceGovernancePage kind="file" title="Files" />;
export const AdminTextPage = () => <ResourceGovernancePage kind="text" title="Text" />;
export const AdminBioPage = () => <ResourceGovernancePage kind="bio" title="Bio Pages" />;
