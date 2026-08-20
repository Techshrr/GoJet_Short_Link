import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, EmptyState, ErrorState, Page, PageHeader, Spinner, localizedError, useLocale } from "@gojet/ui";
import { p14Client, p14Date, p14Error } from "../p14";
import "../p14.css";

type Copy = (en: string, zh: string) => string;
const tone = (status: string): "neutral" | "success" | "warning" | "danger" => status === "sent" ? "success" : status === "failed" ? "danger" : status === "sending" ? "warning" : "neutral";
function errorStatus(error: unknown): number | undefined { if (!error || typeof error !== "object" || !("status" in error)) return undefined; const value = (error as { status?: unknown }).status; return typeof value === "number" ? value : undefined; }
function statusLabel(value: string, c: Copy) { return value === "pending" ? c("Waiting", "等待发送") : value === "sending" ? c("Sending", "发送中") : value === "sent" ? c("Sent", "已发送") : value === "failed" ? c("Failed", "发送失败") : value; }

export default function MailPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const errorText = (error: unknown) => localizedError(p14Error(error), locale, errorStatus(error));
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const logs = useQuery({ queryKey: ["p14-mail-logs"], queryFn: p14Client.mailLogs, refetchInterval: 15000 });
  const retry = useMutation({ mutationFn: (id: number) => p14Client.retryMail(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["p14-mail-logs"] }) });
  const all = logs.data?.data ?? [];
  const data = useMemo(() => filter === "all" ? all : all.filter((item) => item.status === filter), [all, filter]);
  const counts = Object.fromEntries(["pending", "sending", "sent", "failed"].map((status) => [status, all.filter((item) => item.status === status).length]));

  return <Page className="p14-page" data-p14-admin-mail>
    <PageHeader title={c("Mail delivery", "邮件投递")} description={c("Review messages waiting to send, successful deliveries and failures. Failed messages can be retried without changing the history of messages already sent.", "查看等待发送、已成功投递和发送失败的邮件记录。失败邮件可以重新发送，同时保留已经发送邮件的历史记录。")}/>
    <div className="p14-metrics">{["pending", "sending", "sent", "failed"].map((status) => <button key={status} type="button" className={filter === status ? "p14-metric is-active" : "p14-metric"} onClick={() => setFilter(filter === status ? "all" : status)}><span>{statusLabel(status, c)}</span><strong>{counts[status]}</strong></button>)}</div>
    {retry.isError ? <Alert tone="danger" title={c("Message could not be retried", "邮件重新发送失败")}>{errorText(retry.error)}</Alert> : null}
    <section className="p14-card">
      <div className="p14-card-head"><h2>{c("Delivery records", "投递记录")}</h2><Button type="button" onClick={() => logs.refetch()}>{c("Refresh", "刷新")}</Button></div>
      {logs.isPending ? <Spinner label={c("Loading mail records", "正在加载邮件记录")} /> : logs.isError ? <ErrorState title={c("Unable to load mail records", "无法加载邮件记录")} description={errorText(logs.error)}/> : data.length ? <div className="p14-table-wrap"><table className="p14-table"><thead><tr><th>{c("ID / type", "ID / 类型")}</th><th>{c("Recipient", "收件人")}</th><th>{c("Subject", "主题")}</th><th>{c("Status", "状态")}</th><th>{c("Attempts", "尝试次数")}</th><th>{c("Created", "创建时间")}</th><th>{c("Action", "操作")}</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td><strong>#{item.id}</strong><small>{item.message_type}</small></td><td>{item.recipient}</td><td>{item.subject}{item.last_error ? <small className="p14-error">{localizedError(item.last_error, locale)}</small> : null}</td><td><Badge tone={tone(item.status)}>{statusLabel(item.status, c)}</Badge></td><td>{item.attempts}</td><td>{p14Date(item.created_at)}</td><td>{item.status === "failed" ? <Button type="button" loading={retry.isPending && retry.variables === item.id} onClick={() => retry.mutate(item.id)}>{c("Retry", "重新发送")}</Button> : <span className="p14-muted">—</span>}</td></tr>)}</tbody></table></div> : <EmptyState title={c("No mail records", "暂无邮件记录")} description={c("No messages match the selected delivery status.", "当前筛选状态下没有邮件记录。")}/>} 
    </section>
  </Page>;
}
