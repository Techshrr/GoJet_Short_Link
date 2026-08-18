import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingInvoice } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { adminDate, adminError, adminMoney, commerceClient } from "../commerce";

function Settlement({ invoice, onDone }: { invoice: BillingInvoice; onDone: () => void }) {
  const [status, setStatus] = useState<"paid" | "void">("paid");
  const [note, setNote] = useState("");
  const mutation = useMutation({ mutationFn: () => commerceClient.settleInvoice(invoice.id, status, note.trim()), onSuccess: onDone });
  return <div className="commerce-settlement-form"><Alert tone="warning" title="Audited manual settlement">A manual settlement changes billing truth. The server blocks settlement while an active provider payment is still in progress and records the administrator action.</Alert><Field label="Result" htmlFor={`settle-status-${invoice.id}`}><Select id={`settle-status-${invoice.id}`} value={status} onChange={(event) => setStatus(event.target.value as "paid" | "void")}><option value="paid">Paid</option><option value="void">Void</option></Select></Field><Field label="Reason / note" htmlFor={`settle-note-${invoice.id}`} help="Give operators enough context to understand why provider settlement was bypassed."><Textarea id={`settle-note-${invoice.id}`} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></Field>{mutation.isError ? <Alert tone="danger" title="Settlement failed">{adminError(mutation.error)}</Alert> : null}<Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>Apply settlement</Button></div>;
}

export default function AdminBillingPage() {
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const invoices = useQuery({ queryKey: ["admin-invoices", status], queryFn: () => commerceClient.adminInvoices(status) });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
  const data = invoices.data?.data ?? [];
  return <Page className="commerce-page" data-p13-admin-billing>
    <PageHeader title="Billing" description="Orders, invoices, settlement snapshots and audited manual handling." actions={<Field label="Status filter" htmlFor="billing-status-filter"><Select id="billing-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option><option value="pending">Pending</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="void">Void</option></Select></Field>} />
    {invoices.isPending ? <div className="commerce-centered"><Spinner label="Loading invoices" /></div> : invoices.isError ? <ErrorState title="Unable to load invoices" description={adminError(invoices.error)} action={<Button type="button" onClick={() => invoices.refetch()}>Retry</Button>} /> : data.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>Invoice</th><th>Workspace</th><th>Plan / cycle</th><th>Original</th><th>Settlement / FX</th><th>Status</th><th>Due</th><th>Action</th></tr></thead><tbody>{data.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong><small>{adminDate(invoice.created_at)}</small></td><td>#{invoice.workspace_id}</td><td>{invoice.plan_name}<small>{invoice.invoice_type} · {invoice.billing_cycle}</small></td><td>{adminMoney(invoice.source_amount_cents, invoice.source_currency)}</td><td>{adminMoney(invoice.amount_cents, invoice.currency)}<small>{invoice.fx_provider} · {invoice.fx_rate}{invoice.fx_quoted_at ? ` · ${adminDate(invoice.fx_quoted_at)}` : ""}</small></td><td><Badge tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : invoice.status === "void" ? "neutral" : "warning"}>{invoice.status}</Badge></td><td>{adminDate(invoice.due_at)}</td><td>{invoice.status === "pending" || invoice.status === "overdue" ? <SideSheet triggerLabel="Settle" title={`Settle ${invoice.invoice_number}`} description="Use only when provider settlement cannot complete normally."><Settlement invoice={invoice} onDone={refresh} /></SideSheet> : <span className="commerce-muted">—</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No invoices" description="No invoices match the current filter." />}
  </Page>;
}
