import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminFXPayload } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";
import { adminDate, adminError, commerceClient } from "../commerce";

function FXEditor({ data }: { data: AdminFXPayload }) {
  const { text } = useLocale();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState(data.settlement_currency || "USD");
  const [provider, setProvider] = useState<"ecb" | "manual">(data.provider || "ecb");
  const [markup, setMarkup] = useState(String(data.markup_bps));
  const [cacheHours, setCacheHours] = useState(String(data.cache_hours));
  const [manualRates, setManualRates] = useState(JSON.stringify(data.manual_rates ?? {}, null, 2));
  const [reason, setReason] = useState("");
  const [parseError, setParseError] = useState("");
  const invalidJson = text("Manual rates must be valid JSON.", "手工汇率必须是有效的 JSON 格式。");
  const mutation = useMutation({ mutationFn: async () => {
    let rates: Record<string,string> = {};
    try { rates = JSON.parse(manualRates) as Record<string,string>; setParseError(""); }
    catch { setParseError(invalidJson); throw new Error(invalidJson); }
    return commerceClient.updateFX({ settlement_currency: currency.trim().toUpperCase(), provider, markup_bps: Number(markup), cache_hours: Number(cacheHours), manual_rates: rates, reason: reason.trim() });
  }, onSuccess: async () => { setReason(""); await queryClient.invalidateQueries({ queryKey: ["admin-fx"] }); } });

  return <section className="commerce-fx-editor">
    <div className="commerce-section-head"><div><h2>{text("Exchange-rate settings", "汇率设置")}</h2><p>{text("Choose the settlement currency and rate source used when GoJet creates cross-currency invoices. Every manual change requires a reason and is recorded for later review.", "设置 GoJet 创建跨币种账单时使用的结算币种和汇率来源。每次手工修改都必须填写原因，并会保留记录以便后续核对。")}</p></div><Badge tone={provider === "manual" ? "warning" : "success"}>{provider === "manual" ? text("Manual rates", "手工汇率") : "ECB"}</Badge></div>
    <div className="commerce-form-grid">
      <Field label={text("Settlement currency", "结算币种")} htmlFor="fx-currency" help={text("Enter a three-letter ISO currency code such as USD, EUR or SGD.", "填写三位 ISO 币种代码，例如 USD、EUR 或 SGD。") }><Input id="fx-currency" value={currency} onChange={(event) => setCurrency(event.target.value)} /></Field>
      <Field label={text("Rate source", "汇率来源")} htmlFor="fx-provider"><Select id="fx-provider" value={provider} onChange={(event) => setProvider(event.target.value as "ecb" | "manual")}><option value="ecb">ECB</option><option value="manual">{text("Manual", "手工设置")}</option></Select></Field>
      <Field label={text("Markup (basis points)", "加价（基点）")} htmlFor="fx-markup" help={text("100 basis points equals 1%.", "100 个基点等于 1%。") }><Input id="fx-markup" type="number" min="-1000" max="5000" value={markup} onChange={(event) => setMarkup(event.target.value)} /></Field>
      <Field label={text("Rate refresh interval", "汇率刷新间隔")} htmlFor="fx-cache" help={text("Number of hours a fetched rate may be reused before GoJet requests a fresh value.", "已获取的汇率可复用的小时数，超过后 GoJet 会重新获取最新汇率。") }><Input id="fx-cache" type="number" min="1" max="168" value={cacheHours} onChange={(event) => setCacheHours(event.target.value)} /></Field>
    </div>
    <Field label={text("Manual USD conversion rates (JSON)", "手工 USD 换算汇率（JSON）")} htmlFor="fx-rates" help={text('Use USD/XXX keys, for example {"USD/SGD":"1.34"}. These values are used only when the rate source is set to Manual.', '使用 USD/XXX 作为键，例如 {"USD/SGD":"1.34"}。仅在汇率来源选择“手工设置”时使用这些数值。')} error={parseError}><Textarea id="fx-rates" rows={7} value={manualRates} onChange={(event) => setManualRates(event.target.value)} /></Field>
    <Field label={text("Reason for change", "修改原因")} htmlFor="fx-reason" required help={text("Enter 1–500 characters explaining why this change is needed. The note is saved with the administrator record.", "填写 1–500 个字符说明修改原因，该备注会与管理员操作记录一起保存。") }><Textarea id="fx-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    {mutation.isError && !parseError ? <Alert tone="danger" title={text("Exchange-rate settings were not saved", "汇率设置保存失败")}>{adminError(mutation.error)}</Alert> : null}
    <Button type="button" loading={mutation.isPending} disabled={!reason.trim()} onClick={() => mutation.mutate()}>{text("Save exchange-rate settings", "保存汇率设置")}</Button>
  </section>;
}

export default function FXPage() {
  const { text } = useLocale();
  const fx = useQuery({ queryKey: ["admin-fx"], queryFn: () => commerceClient.adminFX() });
  return <Page className="commerce-page" data-p13-admin-fx>
    <PageHeader title={text("Exchange rates", "汇率管理")} description={text("Manage the settlement currency and rate source, then review the rates currently in use and the snapshots preserved on past invoices.", "管理结算币种和汇率来源，并查看当前使用的汇率以及历史账单保留的汇率快照。")}/>
    {fx.isPending ? <div className="commerce-centered"><Spinner label={text("Loading exchange rates", "正在加载汇率数据")} /></div> : fx.isError ? <ErrorState title={text("Unable to load exchange rates", "无法加载汇率数据")} description={adminError(fx.error)} action={<Button type="button" onClick={() => fx.refetch()}>{text("Retry", "重试")}</Button>} /> : fx.data ? <div className="commerce-stack">
      <FXEditor data={fx.data} />
      <section className="commerce-section"><div className="commerce-section-head"><div><h2>{text("Current rates", "当前汇率")}</h2><p>{text("These are the rates GoJet can currently reuse for currency conversion, together with their source and expiry time.", "这里显示 GoJet 当前可用于币种换算的汇率，以及对应来源和失效时间。")}</p></div></div>{fx.data.rates.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{text("Currency pair", "币种对")}</th><th>{text("Rate", "汇率")}</th><th>{text("Source", "来源")}</th><th>{text("Observed", "获取时间")}</th><th>{text("Expires", "失效时间")}</th></tr></thead><tbody>{fx.data.rates.map((rate) => <tr key={`${rate.base_currency}-${rate.quote_currency}-${rate.observed_at}`}><td>{rate.base_currency}/{rate.quote_currency}</td><td className="commerce-mono">{rate.rate}</td><td>{rate.provider}</td><td>{adminDate(rate.observed_at)}</td><td>{adminDate(rate.expires_at)}</td></tr>)}</tbody></table></div> : <EmptyState title={text("No rates available yet", "暂无可用汇率")} description={text("A rate will appear here after GoJet performs a currency conversion.", "GoJet 首次执行币种换算后，相关汇率会显示在这里。")}/>}</section>
      <section className="commerce-section"><div className="commerce-section-head"><div><h2>{text("Invoice exchange-rate history", "账单汇率历史")}</h2><p>{text("Each cross-currency invoice keeps the exact rate, source, markup and quote time used when the invoice was created.", "每张跨币种账单都会保留创建时实际使用的汇率、来源、加价和报价时间。")}</p></div></div>{fx.data.history.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{text("Invoice", "账单")}</th><th>{text("Currency pair", "币种对")}</th><th>{text("Rate", "汇率")}</th><th>{text("Source", "来源")}</th><th>{text("Markup", "加价")}</th><th>{text("Quoted", "报价时间")}</th></tr></thead><tbody>{fx.data.history.map((item) => <tr key={`${item.invoice_number}-${item.created_at}`}><td>{item.invoice_number}</td><td>{item.source_currency}/{item.currency}</td><td className="commerce-mono">{item.rate}</td><td>{item.provider}</td><td>{item.markup_bps} bps</td><td>{adminDate(item.quoted_at)}</td></tr>)}</tbody></table></div> : <EmptyState title={text("No exchange-rate history", "暂无汇率历史")} description={text("History will appear after a cross-currency invoice is created.", "创建跨币种账单后，这里会出现对应的汇率记录。")}/>}</section>
    </div> : null}
  </Page>;
}