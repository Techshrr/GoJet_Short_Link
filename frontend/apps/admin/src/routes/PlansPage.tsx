import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingPlan, PlanCreateInput, PlanWriteInput } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Page, PageHeader, Spinner } from "@gojet/ui";
import { AlertDialog, SideSheet } from "@gojet/ui/overlays";
import { PlanForm } from "../PlanForm";
import { adminError, adminMoney, commerceClient } from "../commerce";

function EditPlan({ plan, onDone }: { plan: BillingPlan; onDone: () => void }) {
  const mutation = useMutation({ mutationFn: (input: PlanWriteInput) => commerceClient.updatePlan(plan.id, input), onSuccess: onDone });
  return <PlanForm plan={plan} busy={mutation.isPending} error={mutation.error} onSubmit={(input) => mutation.mutate(input as PlanWriteInput)} />;
}

function CreatePlan({ onDone }: { onDone: () => void }) {
  const mutation = useMutation({ mutationFn: (input: PlanCreateInput) => commerceClient.createPlan(input), onSuccess: onDone });
  return <PlanForm busy={mutation.isPending} error={mutation.error} onSubmit={(input) => mutation.mutate(input as PlanCreateInput)} />;
}

export default function PlansPage() {
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => commerceClient.adminPlans() });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
  const archive = useMutation({ mutationFn: (id: number) => commerceClient.archivePlan(id), onSuccess: refresh });
  const data = plans.data?.data ?? [];
  return <Page className="commerce-page" data-p13-admin-plans>
    <PageHeader title="Plans" description="Public pricing, billing periods, quotas and plan lifecycle." actions={<SideSheet triggerLabel="New plan" title="Create plan" description="The same server plan source powers public pricing and Workspace Billing."><CreatePlan onDone={refresh} /></SideSheet>} />
    {archive.isError ? <Alert tone="danger" title="Plan archive failed">{adminError(archive.error)}</Alert> : null}
    {plans.isPending ? <div className="commerce-centered"><Spinner label="Loading plans" /></div> : plans.isError ? <ErrorState title="Unable to load plans" description={adminError(plans.error)} action={<Button type="button" onClick={() => plans.refetch()}>Retry</Button>} /> : data.length ? <div className="commerce-plan-grid">{data.map((plan) => <article className="commerce-plan-card" key={plan.id}><div className="commerce-plan-head"><div><span>{plan.code}</span><h2>{plan.name}</h2></div><div className="commerce-badges"><Badge tone={plan.status === "active" ? "success" : "neutral"}>{plan.status}</Badge><Badge tone={plan.is_public ? "info" : "neutral"}>{plan.is_public ? "Public" : "Private"}</Badge></div></div><strong className="commerce-plan-price">{adminMoney(plan.monthly_price_cents, plan.currency)}<small>/mo</small></strong><p>{plan.description}</p><dl className="commerce-plan-meta"><div><dt>Order</dt><dd>{plan.display_order}</dd></div><div><dt>Periods</dt><dd>{plan.billing_periods.join(", ")}</dd></div><div><dt>Members</dt><dd>{plan.member_limit}</dd></div><div><dt>Retention</dt><dd>{plan.analytics_retention_days}d</dd></div></dl><div className="commerce-actions"><SideSheet triggerLabel="Edit" title={`Edit ${plan.name}`} description="Currency, public state, display order, periods, quotas and features are persisted server-side."><EditPlan plan={plan} onDone={refresh} /></SideSheet>{plan.status === "active" ? <AlertDialog triggerLabel="Archive" title="Archive plan?" description="Archiving is blocked while active subscriptions or unsettled invoices still reference this plan." confirmLabel="Archive plan" onConfirm={() => archive.mutate(plan.id)} /> : null}</div></article>)}</div> : <EmptyState title="No plans" description="Create the first managed billing plan." />}
  </Page>;
}
