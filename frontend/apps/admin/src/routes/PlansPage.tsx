import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingPlan, PlanCreateInput, PlanWriteInput } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Page, PageHeader, Spinner } from "@gojet/ui";
import { AlertDialog, SideSheet } from "@gojet/ui/overlays";
import { useLocale } from "@gojet/ui/locale";
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
  const { text } = useLocale();
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => commerceClient.adminPlans() });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
  const archive = useMutation({ mutationFn: (id: number) => commerceClient.archivePlan(id), onSuccess: refresh });
  const data = plans.data?.data ?? [];
  const periodLabel = (period: string) => period === "monthly" ? text("Monthly", "月付") : period === "quarterly" ? text("Quarterly", "季付") : period === "semiannual" ? text("Semiannual", "半年付") : period === "annual" ? text("Annual", "年付") : period;

  return <Page className="commerce-page" data-p13-admin-plans>
    <PageHeader
      title={text("Plans", "套餐")}
      description={text("Manage public pricing, billing periods, quotas and availability from one plan source.", "统一管理公开价格、计费周期、套餐额度和可用状态。")}
      actions={<SideSheet triggerLabel={text("New plan", "新建套餐")} title={text("Create plan", "创建套餐")} description={text("The new plan will be used by both the public pricing page and Workspace Billing.", "新套餐会同时用于公开价格页和工作区账单页面。") }><CreatePlan onDone={refresh} /></SideSheet>}
    />
    {archive.isError ? <Alert tone="danger" title={text("Plan could not be archived", "套餐归档失败")}>{adminError(archive.error)}</Alert> : null}
    {plans.isPending ? <div className="commerce-centered"><Spinner label={text("Loading plans", "正在加载套餐")} /></div> : plans.isError ? <ErrorState title={text("Unable to load plans", "无法加载套餐")} description={adminError(plans.error)} action={<Button type="button" onClick={() => plans.refetch()}>{text("Retry", "重试")}</Button>} /> : data.length ? <div className="commerce-plan-grid">{data.map((plan) => <article className="commerce-plan-card" key={plan.id}>
      <div className="commerce-plan-head"><div><span>{plan.code}</span><h2>{plan.name}</h2></div><div className="commerce-badges"><Badge tone={plan.status === "active" ? "success" : "neutral"}>{plan.status === "active" ? text("Active", "正常") : text("Archived", "已归档")}</Badge><Badge tone={plan.is_public ? "info" : "neutral"}>{plan.is_public ? text("Public", "公开") : text("Hidden", "不公开")}</Badge></div></div>
      <strong className="commerce-plan-price">{adminMoney(plan.monthly_price_cents, plan.currency)}<small>{text("/month base", "/月基础价")}</small></strong>
      <p>{plan.description}</p>
      <dl className="commerce-plan-meta"><div><dt>{text("Display order", "显示顺序")}</dt><dd>{plan.display_order}</dd></div><div><dt>{text("Billing periods", "计费周期")}</dt><dd>{plan.billing_periods.map(periodLabel).join("、")}</dd></div><div><dt>{text("Members", "成员")}</dt><dd>{plan.member_limit}</dd></div><div><dt>{text("Analytics retention", "访问数据保留")}</dt><dd>{plan.analytics_retention_days} {text("days", "天")}</dd></div></dl>
      <div className="commerce-actions"><SideSheet triggerLabel={text("Edit", "编辑")} title={text(`Edit ${plan.name}`, `编辑 ${plan.name}`)} description={text("Change pricing, billing periods, quotas, visibility and customer-facing feature descriptions.", "修改价格、计费周期、套餐额度、公开状态和面向客户的功能说明。") }><EditPlan plan={plan} onDone={refresh} /></SideSheet>{plan.status === "active" ? <AlertDialog triggerLabel={text("Archive", "归档")} title={text("Archive this plan?", "确定归档这个套餐？")} description={text("A plan cannot be archived while active subscriptions or unsettled invoices still depend on it.", "如果仍有有效订阅或未结清账单引用该套餐，服务器会阻止归档。") } confirmLabel={text("Archive plan", "确认归档")} onConfirm={() => archive.mutate(plan.id)} /> : null}</div>
    </article>)}</div> : <EmptyState title={text("No plans", "暂无套餐")} description={text("Create the first managed billing plan.", "创建第一个可管理的套餐。")}/>} 
  </Page>;
}
