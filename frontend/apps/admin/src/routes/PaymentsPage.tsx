import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { useLocale } from "@gojet/ui/locale";
import { adminDate, adminError, adminMoney, commerceClient } from "../commerce";

type SettingsResponse = { payments?: Record<string, unknown> };
type ProviderId = "alipay" | "wechat" | "epay" | "paypal" | "stripe";
type ProviderSpec = { id: ProviderId; en: string; zh: string; fields: Array<{ key: string; en: string; zh: string; secret?: boolean; type?: "url" | "select"; options?: string[] }> };

const providers: ProviderSpec[] = [
  { id: "alipay", en: "Alipay", zh: "支付宝", fields: [
    { key: "app_id", en: "App ID", zh: "应用 App ID" }, { key: "gateway", en: "Gateway URL", zh: "网关地址", type: "url" },
    { key: "private_key", en: "Application private key", zh: "应用私钥", secret: true }, { key: "public_key", en: "Alipay public key", zh: "支付宝公钥", secret: true },
  ] },
  { id: "wechat", en: "WeChat Pay", zh: "微信支付", fields: [
    { key: "app_id", en: "App ID", zh: "App ID" }, { key: "mch_id", en: "Merchant ID", zh: "商户号" }, { key: "mch_serial_no", en: "Merchant certificate serial", zh: "商户证书序列号" },
    { key: "private_key", en: "Merchant private key", zh: "商户私钥", secret: true }, { key: "api_v3_key", en: "API v3 key", zh: "API v3 密钥", secret: true },
    { key: "platform_serial_no", en: "Platform certificate serial", zh: "平台证书序列号" }, { key: "platform_public_key", en: "Platform public key", zh: "平台公钥", secret: true },
  ] },
  { id: "epay", en: "Epay", zh: "易支付", fields: [
    { key: "gateway", en: "Gateway URL", zh: "网关地址", type: "url" }, { key: "pid", en: "Merchant PID", zh: "商户 PID" }, { key: "key", en: "Merchant key", zh: "商户密钥", secret: true }, { key: "default_type", en: "Default payment type", zh: "默认支付类型" },
  ] },
  { id: "paypal", en: "PayPal", zh: "PayPal", fields: [
    { key: "environment", en: "Environment", zh: "运行环境", type: "select", options: ["sandbox", "live"] }, { key: "client_id", en: "Client ID", zh: "Client ID" }, { key: "client_secret", en: "Client secret", zh: "Client Secret", secret: true }, { key: "webhook_id", en: "Webhook ID", zh: "Webhook ID", secret: true },
  ] },
  { id: "stripe", en: "Stripe", zh: "Stripe", fields: [
    { key: "secret_key", en: "Secret key", zh: "Secret Key", secret: true }, { key: "webhook_secret", en: "Webhook signing secret", zh: "Webhook 签名密钥", secret: true },
  ] },
];

function asBool(value: unknown) { return value === true || value === "true" || value === 1; }
function asText(value: unknown) { return value === undefined || value === null || value === "********" ? "" : String(value); }

function PaymentChannels() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "v503", "payment-settings"], queryFn: () => api.get<SettingsResponse>("/api/admin/settings") });
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [configuredSecrets, setConfiguredSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    const section = query.data?.payments;
    if (!section) return;
    const next: Record<string, string | boolean> = {};
    const secrets = new Set<string>();
    for (const [key, value] of Object.entries(section)) {
      if (value === "********") { secrets.add(key); next[key] = ""; }
      else if (typeof value === "boolean") next[key] = value;
      else next[key] = value == null ? "" : String(value);
    }
    setValues(next);
    setConfiguredSecrets(secrets);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        if (configuredSecrets.has(key) && value === "") continue;
        body[key] = value;
      }
      return api.put("/api/admin/settings/payments", body);
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin", "v503", "payment-settings"] }); },
  });
  const set = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");

  if (query.isPending) return <section className="commerce-provider-settings"><Spinner label={text("Loading payment channels", "正在读取支付渠道设置")} /></section>;
  if (query.isError) return <ErrorState title={text("Unable to load payment channels", "无法读取支付渠道设置")} description={adminError(query.error)} />;

  return <section className="commerce-provider-settings">
    <div className="commerce-provider-head"><div><h2>{text("Payment channels", "支付渠道")}</h2><p>{text("Enable the channels you accept and configure each provider. Secret fields are write-only: leave them blank to keep an existing secret.", "启用实际使用的支付渠道并填写对应服务商参数。密钥字段只写不回显；已有密钥留空即可保持不变。")}</p></div></div>
    <div className="commerce-provider-global">
      <Checkbox label={text("Enable online payments", "启用在线支付")} checked={asBool(values["payments.enabled"])} onCheckedChange={(checked) => set("payments.enabled", checked)} />
      <Field label={text("Default payment channel", "默认支付渠道")} htmlFor="payments-default-provider"><Select id="payments-default-provider" value={String(values["payments.default_provider"] ?? "")} onChange={(event) => set("payments.default_provider", event.target.value)}><option value="">{text("No default", "不指定")}</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{text(provider.en, provider.zh)}</option>)}</Select></Field>
    </div>
    <div className="commerce-provider-list">{providers.map((provider) => {
      const prefix = `payments.${provider.id}`;
      return <details className="commerce-provider-card" key={provider.id}>
        <summary><strong>{text(provider.en, provider.zh)}</strong><Badge tone={asBool(values[`${prefix}.enabled`]) ? "success" : "neutral"}>{asBool(values[`${prefix}.enabled`]) ? text("Enabled", "已启用") : text("Disabled", "未启用")}</Badge></summary>
        <div className="commerce-provider-body">
          <Checkbox label={text("Enable this channel", "启用此支付渠道")} checked={asBool(values[`${prefix}.enabled`])} onCheckedChange={(checked) => set(`${prefix}.enabled`, checked)} />
          <Field label={text("Display name", "前台显示名称")} htmlFor={`${provider.id}-display-name`}><Input id={`${provider.id}-display-name`} value={String(values[`${prefix}.display_name`] ?? "")} onChange={(event) => set(`${prefix}.display_name`, event.target.value)} placeholder={text(provider.en, provider.zh)} /></Field>
          <div className="commerce-provider-fields">{provider.fields.map((field) => {
            const fullKey = `${prefix}.${field.key}`;
            const value = String(values[fullKey] ?? "");
            const configured = field.secret && configuredSecrets.has(fullKey);
            return <Field key={field.key} label={text(field.en, field.zh)} htmlFor={`${provider.id}-${field.key}`} help={configured ? text("A secret is already configured. Leave blank to keep it.", "已有密钥，留空即可保持不变。") : undefined}>
              {field.type === "select" ? <Select id={`${provider.id}-${field.key}`} value={value} onChange={(event) => set(fullKey, event.target.value)}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</Select> : <Input id={`${provider.id}-${field.key}`} type={field.secret ? "password" : field.type === "url" ? "url" : "text"} autoComplete={field.secret ? "new-password" : undefined} value={value} placeholder={configured ? text("Configured — leave blank to preserve", "已配置 — 留空保持不变") : ""} onChange={(event) => set(fullKey, event.target.value)} />}
            </Field>;
          })}</div>
        </div>
      </details>;
    })}</div>
    {save.isError ? <Alert tone="danger" title={text("Payment settings were not saved", "支付设置保存失败")}>{errorText(save.error, fallback)}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Payment settings saved", "支付设置已保存")}>{text("New payment requests will use the updated channel configuration.", "后续新建支付请求将使用最新渠道配置。")}</Alert> : null}
    <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>{text("Save payment channels", "保存支付渠道")}</Button>
  </section>;
}

function errorText(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

function PaymentDetail({ paymentId }: { paymentId: number }) {
  const { text } = useLocale();
  const detail = useQuery({ queryKey: ["admin-payment", paymentId], queryFn: () => commerceClient.adminPayment(paymentId) });
  if (detail.isPending) return <div className="commerce-centered"><Spinner label={text("Loading payment details", "正在加载支付详情")} /></div>;
  if (detail.isError) return <ErrorState title={text("Unable to load payment details", "无法加载支付详情")} description={adminError(detail.error)} />;
  const data = detail.data;
  return <div className="commerce-payment-detail"><Alert tone="info" title={text("Sensitive callback data is protected", "敏感回调数据已保护")}>{text("Only references, hashes and processing results are shown here. Provider secrets and raw callback payloads are never displayed.", "这里只显示订单引用、摘要和处理结果，不会展示支付密钥或原始回调内容。")}</Alert><dl className="commerce-detail-list"><div><dt>{text("Provider order", "渠道订单号")}</dt><dd>{data.payment.provider_order_id || "—"}</dd></div><div><dt>{text("GoJet order", "GoJet 订单号")}</dt><dd>{data.payment.merchant_order_no}</dd></div><div><dt>{text("Account", "账号")}</dt><dd>{data.payment.owner_email || "—"}</dd></div><div><dt>{text("Failure reason", "失败原因")}</dt><dd>{data.payment.failure_reason || "—"}</dd></div></dl><section><h3>{text("Callback records", "回调记录")}</h3>{data.callbacks.length ? <div className="commerce-timeline">{data.callbacks.map((callback) => <article key={callback.id}><span className="commerce-timeline-dot" aria-hidden="true" /><div><div className="commerce-timeline-head"><strong>{callback.provider} · {callback.outcome}</strong><Badge tone={callback.outcome === "accepted" ? "success" : "danger"}>HTTP {callback.response_status}</Badge></div><p>{adminDate(callback.created_at)} · {callback.remote_ip}</p><dl><div><dt>{text("Request ID", "请求 ID")}</dt><dd>{callback.request_id || "—"}</dd></div><div><dt>{text("Provider reference", "渠道引用")}</dt><dd>{callback.provider_reference || "—"}</dd></div><div><dt>SHA-256</dt><dd className="commerce-mono">{callback.payload_sha256}</dd></div></dl></div></article>)}</div> : <EmptyState title={text("No callbacks", "暂无回调记录")} description={text("No callback events are attached to this payment yet.", "这笔支付暂时没有回调处理记录。")}/>}</section></div>;
}

export default function PaymentsPage() {
  const { text } = useLocale();
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const payments = useQuery({ queryKey: ["admin-payments", status, provider], queryFn: () => commerceClient.adminPayments(status, provider) });
  const data = payments.data?.data ?? [];
  const statusLabel = (value: string) => value === "paid" ? text("Paid", "已支付") : value === "failed" ? text("Failed", "失败") : value === "pending" ? text("Pending", "处理中") : value === "created" ? text("Created", "已创建") : value === "closed" ? text("Closed", "已关闭") : value;

  return <Page className="commerce-page" data-p13-admin-payments>
    <PageHeader title={text("Payments", "支付记录")} description={text("Configure payment channels and review real payment transactions and callback results.", "配置实际使用的支付渠道，并查看真实支付订单及回调处理结果。")}/>
    <PaymentChannels />
    <section className="commerce-transactions">
      <div className="commerce-section-head"><div><h2>{text("Payment transactions", "支付交易")}</h2><p>{text("Filter and inspect payment records created by plan purchases and renewals.", "筛选并查看套餐购买、续费等产生的支付记录。")}</p></div><div className="commerce-filter-row"><Field label={text("Status", "状态")} htmlFor="payment-status"><Select id="payment-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{text("All", "全部")}</option><option value="created">{text("Created", "已创建")}</option><option value="pending">{text("Pending", "处理中")}</option><option value="paid">{text("Paid", "已支付")}</option><option value="failed">{text("Failed", "失败")}</option><option value="closed">{text("Closed", "已关闭")}</option></Select></Field><Field label={text("Channel", "支付渠道")} htmlFor="payment-provider"><Select id="payment-provider" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">{text("All", "全部")}</option>{providers.map((item) => <option key={item.id} value={item.id}>{text(item.en, item.zh)}</option>)}</Select></Field></div></div>
      {payments.isPending ? <div className="commerce-centered"><Spinner label={text("Loading payments", "正在加载支付记录")} /></div> : payments.isError ? <ErrorState title={text("Unable to load payments", "无法加载支付记录")} description={adminError(payments.error)} action={<Button type="button" onClick={() => payments.refetch()}>{text("Retry", "重试")}</Button>} /> : data.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{text("Order", "订单")}</th><th>{text("User / workspace", "用户 / 工作区")}</th><th>{text("Amount", "金额")}</th><th>{text("Channel", "渠道")}</th><th>{text("Provider reference", "渠道订单号")}</th><th>{text("Status", "状态")}</th><th>{text("Updated", "更新时间")}</th><th>{text("Details", "详情")}</th></tr></thead><tbody>{data.map((payment) => <tr key={payment.id}><td><strong>{payment.merchant_order_no}</strong><small>{text("Invoice", "账单")} #{payment.invoice_id}</small></td><td>{payment.owner_email || "—"}<small>{text("Workspace", "工作区")} #{payment.workspace_id}</small></td><td>{adminMoney(payment.amount_cents, payment.currency)}</td><td>{payment.provider}</td><td className="commerce-mono">{payment.provider_order_id || "—"}</td><td><Badge tone={payment.status === "paid" ? "success" : payment.status === "failed" ? "danger" : payment.status === "pending" ? "warning" : "neutral"}>{statusLabel(payment.status)}</Badge></td><td>{adminDate(payment.updated_at)}</td><td><SideSheet triggerLabel={text("View", "查看")} title={text(`Payment ${payment.merchant_order_no}`, `支付 ${payment.merchant_order_no}`)} description={text("Transaction state and callback processing results.", "查看交易状态和回调处理结果。") }><PaymentDetail paymentId={payment.id} /></SideSheet></td></tr>)}</tbody></table></div> : <EmptyState title={text("No payments", "暂无支付记录")} description={text("No payment transactions match the current filters.", "当前筛选条件下没有支付交易。")}/>} 
    </section>
  </Page>;
}
