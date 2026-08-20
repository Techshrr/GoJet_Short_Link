import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createBillingClient, type BillingInvoice, type BillingPlan, type PaymentCheckout, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Page, PageHeader, Select, Spinner } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { useLocale } from "@gojet/ui/locale";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const billingClient = createBillingClient(api);
const cycleValues = ["monthly", "quarterly", "semiannual", "annual"] as const;

function money(cents: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}
function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}
function usagePercent(value: number, limit: number) { return limit <= 0 ? 0 : Math.min(100, Math.round((value / limit) * 100)); }

function PlanRequest({ plan, currentCode, workspaceId, onDone }: { plan: BillingPlan; currentCode: string; workspaceId: number; onDone: () => void }) {
  const { text } = useLocale();
  const labels: Record<(typeof cycleValues)[number], string> = {
    monthly: text("Monthly · 1 month", "月付 · 1 个月"),
    quarterly: text("Quarterly · 3 months", "季付 · 3 个月"),
    semiannual: text("Semiannual · 6 months", "半年付 · 6 个月"),
    annual: text("Annual · 12 months", "年付 · 12 个月"),
  };
  const allowedCycles = cycleValues.filter((item) => plan.billing_periods.includes(item));
  const [cycle, setCycle] = useState<string>(allowedCycles[0] ?? "monthly");
  const mutation = useMutation({ mutationFn: () => billingClient.createInvoice(workspaceId, plan.code, plan.code === currentCode ? "renewal" : "upgrade", cycle), onSuccess: onDone });
  return <div className="billing-plan-request">
    <p>{text(
      `Create an invoice for ${plan.name}. The subscription changes only after the payment is confirmed by the server.`,
      `为 ${plan.name} 创建账单。只有服务器确认支付成功后，套餐状态才会发生变化。`
    )}</p>
    <Field label={text("Billing cycle", "计费周期")} htmlFor={`billing-cycle-${plan.id}`} help={text("Only billing periods enabled for this plan can be selected.", "这里只显示当前套餐允许使用的计费周期。") }>
      <Select id={`billing-cycle-${plan.id}`} value={cycle} onChange={(event) => setCycle(event.target.value)}>{allowedCycles.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</Select>
    </Field>
    {mutation.isError ? <Alert tone="danger" title={text("Invoice could not be created", "账单创建失败")}>{errorMessage(mutation.error)}</Alert> : null}
    <Button type="button" loading={mutation.isPending} disabled={!allowedCycles.length} onClick={() => mutation.mutate()}>{plan.code === currentCode ? text("Create renewal invoice", "创建续费账单") : text("Create plan-change invoice", "创建套餐变更账单")}</Button>
  </div>;
}

function InvoicePayment({ invoice, workspaceId, onCheckout }: { invoice: BillingInvoice; workspaceId: number; onCheckout: (checkout: PaymentCheckout) => void }) {
  const { text } = useLocale();
  const methods = useQuery({ queryKey: ["billing-methods", workspaceId], queryFn: () => billingClient.paymentMethods(workspaceId) });
  const [provider, setProvider] = useState("");
  const mutation = useMutation({ mutationFn: () => billingClient.checkout(workspaceId, invoice.id, provider), onSuccess: onCheckout });
  const enabled = methods.data?.data ?? [];
  return <div className="billing-payment-form">
    <Field label={text("Payment method", "支付方式")} htmlFor={`payment-method-${invoice.id}`}>
      <Select id={`payment-method-${invoice.id}`} value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">{text("Select a payment method", "请选择支付方式")}</option>{enabled.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</Select>
    </Field>
    {methods.isError ? <Alert tone="danger" title={text("Payment methods unavailable", "支付方式暂时不可用")}>{errorMessage(methods.error)}</Alert> : null}
    {mutation.isError ? <Alert tone="danger" title={text("Unable to start payment", "无法发起支付")}>{errorMessage(mutation.error)}</Alert> : null}
    <Button type="button" loading={mutation.isPending || methods.isPending} disabled={!provider} onClick={() => mutation.mutate()}>{text("Continue to payment", "继续支付")}</Button>
  </div>;
}

export default function BillingPage() {
  const { text } = useLocale();
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const billing = useQuery({ queryKey: ["workspace-billing", workspaceId], queryFn: () => billingClient.workspace(workspaceId!), enabled: Boolean(workspaceId) });
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["workspace-billing", workspaceId] });
  const cancel = useMutation({ mutationFn: (value: boolean) => billingClient.cancellation(workspaceId!, value), onSuccess: refresh });

  if (workspaces.isPending) return <Page className="billing-page"><div className="workspace-centered"><Spinner label={text("Loading workspace", "正在读取工作区")} /></div></Page>;
  if (workspaces.isError) return <Page className="billing-page"><ErrorState title={text("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)} /></Page>;
  if (!workspace) return <Page className="billing-page"><EmptyState title={text("No workspace", "还没有工作区")} description={text("Create a workspace before managing billing.", "创建工作区后才能管理账单和套餐。")}/></Page>;

  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const data = billing.data;
  const usage = data?.usage;
  const usageRows = usage ? [
    [text("Short links", "短链接"), usage.links, usage.link_limit],
    [text("QR codes", "二维码"), usage.qr_codes, usage.qr_limit],
    [text("Text shares", "文本分享"), usage.text_shares, usage.text_limit],
    [text("Bio pages", "个人主页"), usage.bio_pages, usage.bio_limit],
    [text("File storage", "文件存储"), usage.file_bytes, usage.file_storage_bytes],
    [text("Members", "成员"), usage.members, usage.member_limit],
  ] as const : [];
  const subscriptionStatus = (status: string) => status === "active" ? text("Active", "正常") : status === "past_due" ? text("Past due", "逾期") : status === "cancelled" ? text("Cancelled", "已取消") : status;
  const invoiceStatus = (status: string) => status === "paid" ? text("Paid", "已支付") : status === "pending" ? text("Pending", "待支付") : status === "overdue" ? text("Overdue", "已逾期") : status === "void" ? text("Voided", "已作废") : status;

  return <Page className="billing-page" data-p13-billing>
    <PageHeader title={text("Billing & plans", "账单与套餐")} description={text(`Manage plans, usage, invoices and payments for ${workspace.name}.`, `管理 ${workspace.name} 的套餐、用量、账单和支付。`)}/>
    {billing.isPending ? <div className="workspace-centered"><Spinner label={text("Loading billing", "正在加载账单数据")} /></div> : billing.isError ? <ErrorState title={text("Unable to load billing", "无法加载账单数据")} description={errorMessage(billing.error)} action={<Button type="button" onClick={() => billing.refetch()}>{text("Retry", "重试")}</Button>} /> : data ? <div className="billing-stack">
      {checkout ? <Alert tone="warning" title={checkout.reused ? text("Existing payment resumed", "继续已有支付") : text("Payment started", "支付已发起")}>
        {text(`Payment order ${checkout.merchant_order_no} is waiting for the payment provider to confirm the result.`, `支付订单 ${checkout.merchant_order_no} 正在等待支付渠道确认结果。`)}
        {checkout.redirect_url ? <a className="billing-inline-link" href={checkout.redirect_url}>{text("Open payment page", "打开支付页面")}</a> : null}
        {checkout.qr_content ? <a className="billing-inline-link" href={`/api/workspaces/${workspace.id}/billing/payments/${checkout.transaction_id}/qr.png`} target="_blank" rel="noreferrer">{text("Open payment QR code", "打开支付二维码")}</a> : null}
      </Alert> : null}

      <section className="billing-summary-grid">
        <article className="billing-summary-card"><span>{text("CURRENT PLAN", "当前套餐")}</span><h2>{data.subscription.plan_name || usage?.plan_name || text("No active plan", "暂无有效套餐")}</h2><p>{subscriptionStatus(data.subscription.status)} · {data.subscription.period_ends_at ? text(`Current period ends ${formatDate(data.subscription.period_ends_at)}`, `当前周期结束时间 ${formatDate(data.subscription.period_ends_at)}`) : text("No fixed end date", "没有固定结束时间")}</p><Badge tone={data.subscription.cancel_at_period_end ? "warning" : "success"}>{data.subscription.cancel_at_period_end ? text("Stops at period end", "周期结束后停止续费") : text("Renewal active", "自动续费有效")}</Badge></article>
        <article className="billing-summary-card"><span>{text("CURRENCY", "结算币种")}</span><h2>{data.invoices[0]?.currency || data.plans[0]?.currency || "—"}</h2><p>{text("Each invoice preserves the amount and exchange-rate snapshot used when it was created.", "每张账单都会保留创建时的金额和汇率快照。")}</p></article>
        <article className="billing-summary-card"><span>{text("ANALYTICS RETENTION", "访问数据保留")}</span><h2>{usage?.analytics_retention_days ?? 0} {text("days", "天")}</h2><p>{text("The active plan determines how long analytics records are retained.", "当前套餐决定访问分析数据的保留时间。")}</p></article>
      </section>

      <section className="workspace-section"><div className="workspace-section-head"><div><span className="workspace-eyebrow">{text("USAGE", "用量")}</span><h2>{text("Quota usage", "套餐用量")}</h2><p>{text("Usage is calculated from the current workspace records.", "以下用量根据当前工作区的实际数据计算。")}</p></div></div><div className="billing-usage-grid">{usageRows.map(([label, value, limit]) => <article key={label}><div><strong>{label}</strong><span>{value.toLocaleString()} / {limit.toLocaleString()}</span></div><div className="billing-progress" aria-label={`${label} ${usagePercent(value, limit)}%`}><span style={{ width: `${usagePercent(value, limit)}%` }} /></div></article>)}</div></section>

      <section className="workspace-section"><div className="workspace-section-head"><div><span className="workspace-eyebrow">{text("PLANS", "套餐")}</span><h2>{text("Available plans", "可选套餐")}</h2><p>{text("Prices and quotas are loaded from the same plan records used by the public pricing page.", "价格和额度来自与官网价格页一致的套餐数据。")}</p></div></div><div className="billing-plan-grid">{data.plans.map((plan) => <article className={plan.code === data.subscription.plan_code ? "billing-plan-card is-current" : "billing-plan-card"} key={plan.id}><div><Badge tone={plan.code === data.subscription.plan_code ? "success" : "neutral"}>{plan.code === data.subscription.plan_code ? text("Current plan", "当前套餐") : plan.status === "active" ? text("Available", "可购买") : text("Unavailable", "不可购买")}</Badge><h3>{plan.name}</h3><strong className="billing-price">{money(plan.monthly_price_cents, plan.currency)}<small>{text("/month base", "/月基础价")}</small></strong><p>{plan.description}</p></div>{canManage ? <SideSheet triggerLabel={plan.code === data.subscription.plan_code ? text("Renew", "续费") : text("Choose plan", "选择套餐")} title={plan.code === data.subscription.plan_code ? text(`Renew ${plan.name}`, `续费 ${plan.name}`) : text(`Choose ${plan.name}`, `选择 ${plan.name}`)} description={text("Creating an invoice does not change the active plan until payment is confirmed.", "创建账单不会立即变更套餐，支付确认成功后才会生效。") }><PlanRequest plan={plan} currentCode={data.subscription.plan_code} workspaceId={workspace.id} onDone={refresh} /></SideSheet> : null}</article>)}</div></section>

      <section className="workspace-section"><div className="workspace-section-head"><div><span className="workspace-eyebrow">{text("INVOICES", "账单")}</span><h2>{text("Orders & invoices", "订单与账单")}</h2><p>{text("Review invoice amounts, settlement currency, status and due dates.", "查看账单金额、结算币种、状态和到期时间。")}</p></div><Badge tone="neutral">{text(`${data.invoices.length} invoices`, `${data.invoices.length} 张账单`)}</Badge></div>{data.invoices.length ? <div className="workspace-table-wrap"><table className="workspace-table billing-invoice-table"><thead><tr><th>{text("Invoice", "账单")}</th><th>{text("Plan / cycle", "套餐 / 周期")}</th><th>{text("Original amount", "原始金额")}</th><th>{text("Settlement / FX", "结算 / 汇率")}</th><th>{text("Status", "状态")}</th><th>{text("Due", "到期时间")}</th><th>{text("Actions", "操作")}</th></tr></thead><tbody>{data.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong><small>{formatDate(invoice.created_at)}</small></td><td>{invoice.plan_name}<small>{invoice.billing_cycle}</small></td><td>{money(invoice.source_amount_cents, invoice.source_currency)}</td><td>{money(invoice.amount_cents, invoice.currency)}<small>{invoice.fx_provider}{invoice.fx_rate ? ` · ${invoice.fx_rate}` : ""}{invoice.fx_quoted_at ? ` · ${formatDate(invoice.fx_quoted_at)}` : ""}</small></td><td><Badge tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : invoice.status === "void" ? "neutral" : "warning"}>{invoiceStatus(invoice.status)}</Badge></td><td>{formatDate(invoice.due_at)}</td><td><div className="workspace-card-actions"><a className="billing-inline-link" href={`/api/workspaces/${workspace.id}/billing/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>{canManage && (invoice.status === "pending" || invoice.status === "overdue") ? <SideSheet triggerLabel={text("Pay", "支付")} title={text(`Pay ${invoice.invoice_number}`, `支付 ${invoice.invoice_number}`)} description={text("Select an enabled payment method to continue.", "选择已经启用的支付方式继续。") }><InvoicePayment invoice={invoice} workspaceId={workspace.id} onCheckout={(value) => { setCheckout(value); void refresh(); }} /></SideSheet> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState title={text("No invoices", "暂无账单")} description={text("A renewal or plan change will create an invoice here.", "续费或更换套餐后，会在这里生成账单。")}/>} </section>

      {canManage && data.subscription.plan_id ? <section className="workspace-section billing-danger"><div><span className="workspace-eyebrow">{text("RENEWAL", "续费")}</span><h2>{data.subscription.cancel_at_period_end ? text("Cancellation scheduled", "已安排到期取消") : text("Automatic renewal", "自动续费")}</h2><p>{data.subscription.cancel_at_period_end ? text("The current plan remains active until the end of this paid period. You can restore renewal before then.", "当前套餐会继续使用到本付费周期结束。在结束前可以恢复自动续费。") : text("If you no longer want this workspace to renew, schedule cancellation for the end of the current paid period.", "如果不再续费，可以设置为当前付费周期结束后停止续费。")}</p></div><Button type="button" variant="outline" loading={cancel.isPending} onClick={() => cancel.mutate(!data.subscription.cancel_at_period_end)}>{data.subscription.cancel_at_period_end ? text("Restore renewal", "恢复自动续费") : text("Cancel at period end", "到期后取消")}</Button>{cancel.isError ? <Alert tone="danger" title={text("Unable to update renewal", "续费设置更新失败")}>{errorMessage(cancel.error)}</Alert> : null}</section> : null}
    </div> : null}
  </Page>;
}
