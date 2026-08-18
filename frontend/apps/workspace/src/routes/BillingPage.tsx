import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createBillingClient, type BillingInvoice, type BillingPlan, type PaymentCheckout, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Page, PageHeader, Select, Spinner } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const billingClient = createBillingClient(api);
const cycles = [
  { value: "monthly", label: "Monthly · 1 month" },
  { value: "quarterly", label: "Quarterly · 3 months" },
  { value: "semiannual", label: "Semiannual · 6 months" },
  { value: "annual", label: "Annual · 12 months" }
] as const;

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
  const allowedCycles = cycles.filter((item) => plan.billing_periods.includes(item.value));
  const [cycle, setCycle] = useState(allowedCycles[0]?.value ?? "monthly");
  const mutation = useMutation({ mutationFn: () => billingClient.createInvoice(workspaceId, plan.code, plan.code === currentCode ? "renewal" : "upgrade", cycle), onSuccess: onDone });
  return <div className="billing-plan-request">
    <p>Generate a server-side invoice for <strong>{plan.name}</strong>. Payment remains pending until a verified provider callback or an audited admin settlement updates the invoice.</p>
    <Field label="Billing cycle" htmlFor={`billing-cycle-${plan.id}`} help="Only billing periods enabled for this plan are selectable; the API enforces the same rule."><Select id={`billing-cycle-${plan.id}`} value={cycle} onChange={(event) => setCycle(event.target.value)}>{allowedCycles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
    {mutation.isError ? <Alert tone="danger" title="Invoice request failed">{errorMessage(mutation.error)}</Alert> : null}
    <Button type="button" loading={mutation.isPending} disabled={!allowedCycles.length} onClick={() => mutation.mutate()}>{plan.code === currentCode ? "Create renewal invoice" : "Create change invoice"}</Button>
  </div>;
}

function InvoicePayment({ invoice, workspaceId, onCheckout }: { invoice: BillingInvoice; workspaceId: number; onCheckout: (checkout: PaymentCheckout) => void }) {
  const methods = useQuery({ queryKey: ["billing-methods", workspaceId], queryFn: () => billingClient.paymentMethods(workspaceId) });
  const [provider, setProvider] = useState("");
  const mutation = useMutation({ mutationFn: () => billingClient.checkout(workspaceId, invoice.id, provider), onSuccess: onCheckout });
  const enabled = methods.data?.data ?? [];
  return <div className="billing-payment-form">
    <Field label="Payment method" htmlFor={`payment-method-${invoice.id}`}><Select id={`payment-method-${invoice.id}`} value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">Select method</option>{enabled.map((method) => <option key={method.code} value={method.code}>{method.name} · {method.mode}</option>)}</Select></Field>
    {mutation.isError ? <Alert tone="danger" title="Unable to start payment">{errorMessage(mutation.error)}</Alert> : null}
    <Button type="button" loading={mutation.isPending} disabled={!provider} onClick={() => mutation.mutate()}>Start payment</Button>
  </div>;
}

export default function BillingPage() {
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const billing = useQuery({ queryKey: ["workspace-billing", workspaceId], queryFn: () => billingClient.workspace(workspaceId!), enabled: Boolean(workspaceId) });
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["workspace-billing", workspaceId] });
  const cancel = useMutation({ mutationFn: (value: boolean) => billingClient.cancellation(workspaceId!, value), onSuccess: refresh });

  if (workspaces.isPending) return <Page className="billing-page"><div className="workspace-centered"><Spinner label="Loading workspace" /></div></Page>;
  if (workspaces.isError) return <Page className="billing-page"><ErrorState title="Unable to load workspace" description={errorMessage(workspaces.error)} /></Page>;
  if (!workspace) return <Page className="billing-page"><EmptyState title="No workspace" description="Create a workspace before managing billing." /></Page>;
  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const data = billing.data;
  const usage = data?.usage;
  const usageRows = useMemo(() => usage ? [
    ["Links", usage.links, usage.link_limit], ["QR", usage.qr_codes, usage.qr_limit], ["Text", usage.text_shares, usage.text_limit], ["Bio", usage.bio_pages, usage.bio_limit], ["Files", usage.file_bytes, usage.file_storage_bytes], ["Members", usage.members, usage.member_limit]
  ] as const : [], [usage]);

  return <Page className="billing-page" data-p13-billing>
    <PageHeader title="Billing" description={`Plans, usage, invoices, payments & currency · ${workspace.name}`} />
    {billing.isPending ? <div className="workspace-centered"><Spinner label="Loading billing" /></div> : billing.isError ? <ErrorState title="Unable to load billing" description={errorMessage(billing.error)} action={<Button type="button" onClick={() => billing.refetch()}>Retry</Button>} /> : data ? <div className="billing-stack">
      {checkout ? <Alert tone="warning" title={checkout.reused ? "Existing payment resumed" : "Payment started"}>Payment order <strong>{checkout.merchant_order_no}</strong> is still controlled by the provider callback. The invoice is not shown as paid until the server confirms it.{checkout.redirect_url ? <a className="billing-inline-link" href={checkout.redirect_url}>Continue to provider</a> : null}{checkout.qr_content ? <a className="billing-inline-link" href={`/api/workspaces/${workspace.id}/billing/payments/${checkout.transaction_id}/qr.png`} target="_blank" rel="noreferrer">Open payment QR</a> : null}</Alert> : null}
      <section className="billing-summary-grid">
        <article className="billing-summary-card"><span>CURRENT PLAN</span><h2>{data.subscription.plan_name || usage?.plan_name || "No active plan"}</h2><p>{data.subscription.status} · {data.subscription.period_ends_at ? `period ends ${formatDate(data.subscription.period_ends_at)}` : "no fixed end date"}</p><Badge tone={data.subscription.cancel_at_period_end ? "warning" : "success"}>{data.subscription.cancel_at_period_end ? "Stops at period end" : "Renewal active"}</Badge></article>
        <article className="billing-summary-card"><span>CURRENCY</span><h2>{data.invoices[0]?.currency || data.plans[0]?.currency || "—"}</h2><p>Each invoice freezes original amount, settlement amount, FX provider, rate and quoted time.</p></article>
        <article className="billing-summary-card"><span>RETENTION</span><h2>{usage?.analytics_retention_days ?? 0} days</h2><p>Analytics retention is enforced by the active plan quota.</p></article>
      </section>

      <section className="workspace-section"><div className="workspace-section-head"><div><span className="workspace-eyebrow">USAGE</span><h2>Quota usage</h2><p>Usage is calculated by the billing service from the current workspace records.</p></div></div><div className="billing-usage-grid">{usageRows.map(([label, value, limit]) => <article key={label}><div><strong>{label}</strong><span>{value.toLocaleString()} / {limit.toLocaleString()}</span></div><div className="billing-progress" aria-label={`${label} ${usagePercent(value, limit)}%`}><span style={{ width: `${usagePercent(value, limit)}%` }} /></div></article>)}</div></section>

      <section className="workspace-section"><div className="workspace-section-head"><div><span className="workspace-eyebrow">PLANS</span><h2>Plans</h2><p>Pricing and quotas use the same server plan source as the public pricing surface.</p></div></div><div className="billing-plan-grid">{data.plans.map((plan) => <article className={plan.code === data.subscription.plan_code ? "billing-plan-card is-current" : "billing-plan-card"} key={plan.id}><div><Badge tone={plan.code === data.subscription.plan_code ? "success" : "neutral"}>{plan.code === data.subscription.plan_code ? "Current" : plan.status}</Badge><h3>{plan.name}</h3><strong className="billing-price">{money(plan.monthly_price_cents, plan.currency)}<small>/mo base</small></strong><p>{plan.description}</p></div>{canManage ? <SideSheet triggerLabel={plan.code === data.subscription.plan_code ? "Renew" : "Choose plan"} title={`${plan.name} invoice`} description="Invoice creation is server-side and does not change subscription state before settlement."><PlanRequest plan={plan} currentCode={data.subscription.plan_code} workspaceId={workspace.id} onDone={refresh} /></SideSheet> : null}</article>)}</div></section>

      <section className="workspace-section"><div className="workspace-section-head"><div><span className="workspace-eyebrow">INVOICES</span><h2>Orders & invoices</h2><p>Original pricing and settlement/FX snapshots are retained together.</p></div><Badge tone="neutral">{data.invoices.length} invoices</Badge></div>{data.invoices.length ? <div className="workspace-table-wrap"><table className="workspace-table billing-invoice-table"><thead><tr><th>Invoice</th><th>Plan / cycle</th><th>Original</th><th>Settlement / FX</th><th>Status</th><th>Due</th><th>Actions</th></tr></thead><tbody>{data.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong><small>{formatDate(invoice.created_at)}</small></td><td>{invoice.plan_name}<small>{invoice.billing_cycle}</small></td><td>{money(invoice.source_amount_cents, invoice.source_currency)}</td><td>{money(invoice.amount_cents, invoice.currency)}<small>{invoice.fx_provider} · {invoice.fx_rate}{invoice.fx_quoted_at ? ` · ${formatDate(invoice.fx_quoted_at)}` : ""}</small></td><td><Badge tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : invoice.status === "void" ? "neutral" : "warning"}>{invoice.status}</Badge></td><td>{formatDate(invoice.due_at)}</td><td><div className="workspace-card-actions"><a className="billing-inline-link" href={`/api/workspaces/${workspace.id}/billing/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>{canManage && (invoice.status === "pending" || invoice.status === "overdue") ? <SideSheet triggerLabel="Pay" title={`Pay ${invoice.invoice_number}`} description="Starting checkout never marks an invoice paid optimistically."><InvoicePayment invoice={invoice} workspaceId={workspace.id} onCheckout={(value) => { setCheckout(value); void refresh(); }} /></SideSheet> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No invoices" description="Create a plan change or renewal invoice when needed." />}</section>

      {canManage && data.subscription.plan_id ? <section className="workspace-section billing-danger"><div><span className="workspace-eyebrow">RENEWAL</span><h2>{data.subscription.cancel_at_period_end ? "Cancellation scheduled" : "Automatic renewal"}</h2><p>{data.subscription.cancel_at_period_end ? "The subscription remains active through the current period and can be restored before it ends." : "Schedule cancellation only if this workspace should stop at the end of its current paid period."}</p></div><Button type="button" variant="outline" loading={cancel.isPending} onClick={() => cancel.mutate(!data.subscription.cancel_at_period_end)}>{data.subscription.cancel_at_period_end ? "Restore renewal" : "Cancel at period end"}</Button>{cancel.isError ? <Alert tone="danger" title="Unable to update renewal">{errorMessage(cancel.error)}</Alert> : null}</section> : null}
    </div> : null}
  </Page>;
}
