import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingInvoice } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { useLocale } from "@gojet/ui/locale";
import { adminDate, adminError, adminMoney, commerceClient } from "../commerce";

function Settlement({ invoice, onDone }: { invoice: BillingInvoice; onDone: () => void }) {
  const { text } = useLocale();
  const [status, setStatus] = useState<"paid" | "void">("paid");
  const [note, setNote] = useState("");
  const mutation = useMutation({ mutationFn: () => commerceClient.settleInvoice(invoice.id, status, note.trim()), onSuccess: onDone });
  return <div className="commerce-settlement-form">
    <Alert tone="warning" title={text("Manual invoice settlement", "手工处理账单")}>
      {text(
        "Use this only when a payment cannot be completed through its normal channel. GoJet prevents the change while a provider payment is still processing and records the administrator action for later review.",
        "仅在支付无法通过正常渠道完成时使用。支付渠道仍在处理中时 GoJet 会阻止修改，并记录管理员操作，便于后续核对。"
      )}
    </Alert>
    <Field label={text("Result", "处理结果")} htmlFor={`settle-status-${invoice.id}`}>
      <Select id={`settle-status-${invoice.id}`} value={status} onChange={(event) => setStatus(event.target.value as "paid" | "void")}>
        <option value="paid">{text("Mark as paid", "标记为已支付")}</option>
        <option value="void">{text("Void invoice", "作废账单")}</option>
      </Select>
    </Field>
    <Field label={text("Reason or note", "原因或备注")} htmlFor={`settle-note-${invoice.id}`} help={text("Describe why the normal payment flow could not be used so another administrator can understand the change later.", "说明为什么无法使用正常支付流程，方便其他管理员之后核对这次修改。") }>
      <Textarea id={`settle-note-${invoice.id}`} rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
    </Field>
    {mutation.isError ? <Alert tone="danger" title={text("Invoice could not be updated", "账单处理失败")}>{adminError(mutation.error)}</Alert> : null}
    <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>{text("Apply change", "确认处理")}</Button>
  </div>;
}

export default function AdminBillingPage() {
  const { text } = useLocale();
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const invoices = useQuery({ queryKey: ["admin-invoices", status], queryFn: () => commerceClient.adminInvoices(status) });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
  const data = invoices.data?.data ?? [];
  const statusLabel = (value: string) => value === "pending" ? text("Pending", "待支付") : value === "overdue" ? text("Overdue", "已逾期") : value === "paid" ? text("Paid", "已支付") : value === "void" ? text("Voided", "已作废") : value;

  return <Page className="commerce-page" data-p13-admin-billing>
    <PageHeader
      title={text("Billing", "账单管理")}
      description={text("Review invoices, payment amounts, exchange-rate snapshots and exceptional settlement changes across all workspaces.", "查看所有工作区的账单、支付金额、汇率快照，以及需要人工处理的异常结算记录。")}
      actions={<Field label={text("Status", "状态")} htmlFor="billing-status-filter"><Select id="billing-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text("All", "全部")}</option><option value="pending">{text("Pending", "待支付")}</option><option value="overdue">{text("Overdue", "已逾期")}</option><option value="paid">{text("Paid", "已支付")}</option><option value="void">{text("Voided", "已作废")}</option></Select></Field>}
    />
    {invoices.isPending ? <div className="commerce-centered"><Spinner label={text("Loading invoices", "正在加载账单")} /></div> : invoices.isError ? <ErrorState title={text("Unable to load invoices", "无法加载账单")} description={adminError(invoices.error)} action={<Button type="button" onClick={() => invoices.refetch()}>{text("Retry", "重试")}</Button>} /> : data.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{text("Invoice", "账单")}</th><th>{text("Workspace", "工作区")}</th><th>{text("Plan / cycle", "套餐 / 周期")}</th><th>{text("Original amount", "原始金额")}</th><th>{text("Paid amount / exchange rate", "结算金额 / 汇率")}</th><th>{text("Status", "状态")}</th><th>{text("Due", "到期时间")}</th><th>{text("Action", "操作")}</th></tr></thead><tbody>{data.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong><small>{adminDate(invoice.created_at)}</small></td><td>#{invoice.workspace_id}</td><td>{invoice.plan_name}<small>{invoice.invoice_type} · {invoice.billing_cycle}</small></td><td>{adminMoney(invoice.source_amount_cents, invoice.source_currency)}</td><td>{adminMoney(invoice.amount_cents, invoice.currency)}<small>{invoice.fx_provider} · {invoice.fx_rate}{invoice.fx_quoted_at ? ` · ${adminDate(invoice.fx_quoted_at)}` : ""}</small></td><td><Badge tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : invoice.status === "void" ? "neutral" : "warning"}>{statusLabel(invoice.status)}</Badge></td><td>{adminDate(invoice.due_at)}</td><td>{invoice.status === "pending" || invoice.status === "overdue" ? <SideSheet triggerLabel={text("Review", "处理")} title={text(`Review ${invoice.invoice_number}`, `处理 ${invoice.invoice_number}`)} description={text("Use manual handling only when the normal payment channel cannot complete the invoice.", "仅在正常支付渠道无法完成账单时进行人工处理。") }><Settlement invoice={invoice} onDone={refresh} /></SideSheet> : <span className="commerce-muted">—</span>}</td></tr>)}</tbody></table></div> : <EmptyState title={text("No invoices", "暂无账单")} description={text("No invoices match the current filter.", "当前筛选条件下没有账单。")}/>} 
  </Page>;
}