import { useMemo, useState, type FormEvent } from "react";
import type { BillingPlan, PlanCreateInput, PlanWriteInput } from "@gojet/api-client";
import { Alert, Button, Checkbox, Field, Input, Select, Switch, Textarea } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";
import { adminError, billingPeriods } from "./commerce";

interface Props {
  plan?: BillingPlan;
  busy?: boolean;
  error?: unknown;
  onSubmit: (input: PlanCreateInput | PlanWriteInput) => void;
}

function featureText(value: unknown) { return Array.isArray(value) ? value.map(String).join("\n") : ""; }

export function PlanForm({ plan, busy = false, error, onSubmit }: Props) {
  const { text } = useLocale();
  const editing = Boolean(plan);
  const initialPeriods = useMemo(() => new Set(plan?.billing_periods?.length ? plan.billing_periods : billingPeriods), [plan]);
  const [code, setCode] = useState(plan?.code ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [status, setStatus] = useState<"active" | "archived">(plan?.status ?? "active");
  const [currency, setCurrency] = useState(plan?.currency ?? "USD");
  const [isPublic, setIsPublic] = useState(plan?.is_public ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(plan?.display_order ?? 100));
  const [price, setPrice] = useState(String(plan?.monthly_price_cents ?? 0));
  const [links, setLinks] = useState(String(plan?.link_limit ?? 100));
  const [qr, setQR] = useState(String(plan?.qr_limit ?? 25));
  const [textLimit, setTextLimit] = useState(String(plan?.text_limit ?? 25));
  const [bio, setBio] = useState(String(plan?.bio_limit ?? 3));
  const [storage, setStorage] = useState(String(plan?.file_storage_bytes ?? 1073741824));
  const [members, setMembers] = useState(String(plan?.member_limit ?? 3));
  const [retention, setRetention] = useState(String(plan?.analytics_retention_days ?? 30));
  const [features, setFeatures] = useState(featureText(plan?.features));
  const [periods, setPeriods] = useState(initialPeriods);

  const periodLabel: Record<string, string> = {
    monthly: text("Monthly", "月付"), quarterly: text("Quarterly", "季付"), semiannual: text("Semiannual", "半年付"), annual: text("Annual", "年付"),
  };
  const togglePeriod = (period: string, checked: boolean) => setPeriods((current) => { const next = new Set(current); if (checked) next.add(period); else next.delete(period); return next; });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const base: PlanWriteInput = {
      name: name.trim(), description: description.trim(), status, currency: currency.trim().toUpperCase(), is_public: isPublic,
      display_order: Number(displayOrder), billing_periods: billingPeriods.filter((item) => periods.has(item)), monthly_price_cents: Number(price),
      link_limit: Number(links), qr_limit: Number(qr), text_limit: Number(textLimit), bio_limit: Number(bio), file_storage_bytes: Number(storage),
      member_limit: Number(members), analytics_retention_days: Number(retention), features: features.split("\n").map((item) => item.trim()).filter(Boolean),
    };
    onSubmit(editing ? base : { ...base, code: code.trim().toLowerCase() });
  };

  return <form className="commerce-plan-form commerce-plan-form-v503" onSubmit={submit}>
    {error ? <Alert tone="danger" title={text("Plan was not saved", "套餐保存失败")}>{adminError(error)}</Alert> : null}

    <section className="commerce-plan-form-section">
      <h3>{text("Plan identity", "套餐信息")}</h3>
      {!editing ? <Field label={text("Plan code", "套餐代码")} htmlFor="plan-code" required help={text("A stable lowercase identifier used internally. It cannot be changed after creation.", "内部使用的稳定小写标识，创建后不可修改。") }><Input id="plan-code" value={code} onChange={(event) => setCode(event.target.value)} required /></Field> : null}
      <div className="commerce-form-grid">
        <Field label={text("Name", "套餐名称")} htmlFor="plan-name" required><Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label={text("Currency", "币种")} htmlFor="plan-currency" required help={text("Use a three-letter ISO currency code such as CNY or USD.", "填写三位 ISO 币种代码，例如 CNY 或 USD。") }><Input id="plan-currency" value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={3} required /></Field>
        <Field label={text("Monthly base price (cents)", "月基础价格（分）")} htmlFor="plan-price" required help={text("Enter the amount in the smallest currency unit. For CNY 69.00, enter 6900.", "按最小货币单位填写。例如人民币 ¥69.00 填写 6900。") }><Input id="plan-price" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required /></Field>
        <Field label={text("Display order", "显示顺序")} htmlFor="plan-order" required><Input id="plan-order" type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} required /></Field>
      </div>
      <Field label={text("Description", "套餐说明")} htmlFor="plan-description"><Textarea id="plan-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <div className="commerce-inline-controls">
        <Switch checked={isPublic} onCheckedChange={setIsPublic} label={text("Show on public pricing page", "在公开价格页显示")} />
        <Field label={text("Status", "状态")} htmlFor="plan-status"><Select id="plan-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived")}><option value="active">{text("Active", "正常")}</option><option value="archived">{text("Archived", "已归档")}</option></Select></Field>
      </div>
    </section>

    <section className="commerce-plan-form-section">
      <h3>{text("Billing periods", "计费周期")}</h3>
      <p className="commerce-form-help">{text("Choose the periods customers may use when creating a new invoice for this plan.", "选择客户购买或续费此套餐时可以使用的计费周期。")}</p>
      <fieldset className="commerce-periods"><legend className="sr-only">{text("Billing periods", "计费周期")}</legend>{billingPeriods.map((period) => <Checkbox key={period} checked={periods.has(period)} onCheckedChange={(checked) => togglePeriod(period, checked)} label={periodLabel[period] ?? period} />)}</fieldset>
    </section>

    <section className="commerce-plan-form-section">
      <h3>{text("Usage limits", "套餐额度")}</h3>
      <div className="commerce-quota-grid">
        <Field label={text("Short links", "短链接数量")} htmlFor="quota-links"><Input id="quota-links" type="number" min="1" value={links} onChange={(event) => setLinks(event.target.value)} /></Field>
        <Field label={text("QR codes", "二维码数量")} htmlFor="quota-qr"><Input id="quota-qr" type="number" min="1" value={qr} onChange={(event) => setQR(event.target.value)} /></Field>
        <Field label={text("Text shares", "文本分享数量")} htmlFor="quota-text"><Input id="quota-text" type="number" min="1" value={textLimit} onChange={(event) => setTextLimit(event.target.value)} /></Field>
        <Field label={text("Bio pages", "个人主页数量")} htmlFor="quota-bio"><Input id="quota-bio" type="number" min="1" value={bio} onChange={(event) => setBio(event.target.value)} /></Field>
        <Field label={text("File storage (bytes)", "文件存储空间（字节）")} htmlFor="quota-storage"><Input id="quota-storage" type="number" min="1" value={storage} onChange={(event) => setStorage(event.target.value)} /></Field>
        <Field label={text("Workspace members", "工作区成员数量")} htmlFor="quota-members"><Input id="quota-members" type="number" min="1" value={members} onChange={(event) => setMembers(event.target.value)} /></Field>
        <Field label={text("Analytics retention (days)", "访问数据保留（天）")} htmlFor="quota-retention"><Input id="quota-retention" type="number" min="1" value={retention} onChange={(event) => setRetention(event.target.value)} /></Field>
      </div>
    </section>

    <section className="commerce-plan-form-section">
      <h3>{text("Public feature list", "前台功能说明")}</h3>
      <Field label={text("One feature per line", "每行一项功能")} htmlFor="plan-features" help={text("These lines are displayed to customers on pricing and plan-selection surfaces.", "这些内容会展示在价格页和套餐选择页面，请使用面向客户的说明文字。") }><Textarea id="plan-features" rows={6} value={features} onChange={(event) => setFeatures(event.target.value)} /></Field>
    </section>

    <Button type="submit" loading={busy}>{editing ? text("Save plan", "保存套餐") : text("Create plan", "创建套餐")}</Button>
  </form>;
}
