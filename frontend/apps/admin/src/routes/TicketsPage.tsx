import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea, localizedError, useLocale } from "@gojet/ui";
import { p14Client, p14Date, p14Error, type Ticket } from "../p14";
import "../p14.css";

type Copy = (en: string, zh: string) => string;
const tone = (status: string): "neutral" | "success" | "warning" | "danger" => status === "closed" || status === "resolved" || status === "clean" ? "success" : status === "customer_reply" || status === "pending" ? "warning" : status === "open" || status === "infected" || status === "failed" ? "danger" : "neutral";
function errorStatus(error: unknown): number | undefined { if (!error || typeof error !== "object" || !("status" in error)) return undefined; const value = (error as { status?: unknown }).status; return typeof value === "number" ? value : undefined; }
function statusLabel(value: string, c: Copy) { return value === "customer_reply" ? c("Customer replied", "用户已回复") : value === "open" ? c("Open", "待处理") : value === "in_progress" ? c("In progress", "处理中") : value === "staff_reply" ? c("Support replied", "客服已回复") : value === "resolved" ? c("Resolved", "已解决") : value === "closed" ? c("Closed", "已关闭") : value === "clean" ? c("Ready", "可以下载") : value === "pending" ? c("Checking", "检查中") : value === "infected" ? c("Blocked", "已阻止") : value === "failed" ? c("Check failed", "检查失败") : value; }
function priorityLabel(value: string, c: Copy) { return value === "low" ? c("Low", "低") : value === "normal" ? c("Normal", "普通") : value === "high" ? c("High", "高") : value === "urgent" ? c("Urgent", "紧急") : value; }

export default function TicketsPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const errorText = (error: unknown) => localizedError(p14Error(error), locale, errorStatus(error));
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const params = useMemo(() => { const p = new URLSearchParams(); if (status) p.set("status", status); if (department) p.set("department", department); if (search.trim()) p.set("search", search.trim()); return p; }, [status, department, search]);
  const departments = useQuery({ queryKey: ["p14-departments"], queryFn: p14Client.departments });
  const list = useQuery({ queryKey: ["p14-admin-tickets", params.toString()], queryFn: () => p14Client.tickets(params) });
  const items = list.data?.data ?? [];
  useEffect(() => { if (selected === null && items[0]) setSelected(items[0].id); }, [items, selected]);
  const detail = useQuery({ queryKey: ["p14-admin-ticket", selected], enabled: selected !== null, queryFn: () => p14Client.ticket(selected!) });
  const attachments = useQuery({ queryKey: ["p14-admin-attachments", selected], enabled: selected !== null, queryFn: () => p14Client.attachments(selected!) });
  const refresh = async () => Promise.all([qc.invalidateQueries({ queryKey: ["p14-admin-tickets"] }), qc.invalidateQueries({ queryKey: ["p14-admin-ticket", selected] }), qc.invalidateQueries({ queryKey: ["p14-admin-attachments", selected] })]);
  const replyMutation = useMutation({ mutationFn: () => p14Client.reply(selected!, reply.trim(), internal), onSuccess: async () => { setReply(""); setInternal(false); await refresh(); } });
  const update = useMutation({ mutationFn: (body: { status?: string; priority?: string; department_id?: number }) => p14Client.updateTicket(selected!, body), onSuccess: refresh });
  const ticket = detail.data?.ticket;

  return <Page className="p14-page" data-p14-admin-tickets>
    <PageHeader title={c("Support tickets", "工单管理")} description={c("Review customer requests, reply to conversations, change assignment and status, and keep private administrator notes separate from customer-visible replies.", "查看用户提交的问题、回复工单、调整分类和状态，并将管理员内部备注与用户可见回复严格分开。")}/>
    <div className="p14-filters">
      <Field label={c("Status", "状态")} htmlFor="ticket-status-filter"><Select id="ticket-status-filter" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{c("All statuses", "全部状态")}</option>{["customer_reply", "open", "in_progress", "staff_reply", "resolved", "closed"].map((value) => <option key={value} value={value}>{statusLabel(value, c)}</option>)}</Select></Field>
      <Field label={c("Department", "问题分类")} htmlFor="ticket-department-filter"><Select id="ticket-department-filter" value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">{c("All departments", "全部分类")}</option>{(departments.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      <Field label={c("Search", "搜索")} htmlFor="ticket-search"><Input id="ticket-search" placeholder={c("Ticket number, subject or email", "工单号、主题或邮箱")} value={search} onChange={(e) => setSearch(e.target.value)}/></Field>
    </div>
    <div className="p14-split">
      <section className="p14-card"><h2>{c("Ticket list", "工单列表")}</h2>{list.isPending ? <Spinner label={c("Loading tickets", "正在加载工单")} /> : list.isError ? <ErrorState title={c("Unable to load tickets", "无法加载工单")} description={errorText(list.error)}/> : items.length ? <div className="p14-list">{items.map((item: Ticket) => <button type="button" key={item.id} className={selected === item.id ? "p14-row is-active" : "p14-row"} onClick={() => setSelected(item.id)}><span><strong>{item.ticket_number}</strong><small>{item.user_email} · {item.department_name}</small></span><Badge tone={tone(item.status)}>{statusLabel(item.status, c)}</Badge><b>{item.subject}</b><small>{priorityLabel(item.priority, c)} · {p14Date(item.last_reply_at)}</small></button>)}</div> : <EmptyState title={c("No matching tickets", "没有符合条件的工单")} description={c("Try another status, department or search term.", "可以尝试更换状态、问题分类或搜索条件。")}/>}</section>
      <section className="p14-card"><div className="p14-card-head"><h2>{c("Ticket details", "工单详情")}</h2>{ticket ? <Badge tone={tone(ticket.status)}>{statusLabel(ticket.status, c)}</Badge> : null}</div>
        {!selected ? <EmptyState title={c("Select a ticket", "请选择工单")} description={c("Choose a ticket from the list to view the conversation and attachments.", "从工单列表选择一项后即可查看对话和附件。")}/>
        : detail.isPending ? <Spinner label={c("Loading ticket", "正在加载工单")} />
        : detail.isError ? <ErrorState title={c("Unable to load ticket", "无法加载工单")} description={errorText(detail.error)}/>
        : detail.data ? <>
          <div className="p14-controls"><Field label={c("Status", "状态")} htmlFor="ticket-status"><Select id="ticket-status" value={ticket!.status} onChange={(e) => update.mutate({ status: e.target.value })}>{["open", "customer_reply", "staff_reply", "in_progress", "resolved", "closed"].map((value) => <option key={value} value={value}>{statusLabel(value, c)}</option>)}</Select></Field><Field label={c("Priority", "紧急程度")} htmlFor="ticket-priority"><Select id="ticket-priority" value={ticket!.priority} onChange={(e) => update.mutate({ priority: e.target.value })}>{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{priorityLabel(value, c)}</option>)}</Select></Field><Field label={c("Department", "问题分类")} htmlFor="ticket-department"><Select id="ticket-department" value={ticket!.department_id} onChange={(e) => update.mutate({ department_id: Number(e.target.value) })}>{(departments.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field></div>
          <div className="p14-thread">{detail.data.messages.map((item) => <article key={item.id} className={item.internal ? "p14-message is-internal" : "p14-message"}><header><strong>{item.author_name || (item.author_type === "admin" ? c("Administrator", "管理员") : c("Customer", "用户"))}</strong><span>{item.internal ? `${c("Private note", "内部备注")} · ` : ""}{p14Date(item.created_at)}</span></header><p>{item.body}</p></article>)}</div>
          <div className="p14-attachments"><h3>{c("Attachments", "附件")}</h3>{attachments.isPending ? <Spinner label={c("Loading attachments", "正在加载附件")} /> : (attachments.data?.data ?? []).length ? (attachments.data?.data ?? []).map((item) => <div className="p14-attachment" key={item.id}><span><strong>{item.original_name}</strong><small>{Math.max(1, Math.round(item.size_bytes / 1024))} KB · {p14Date(item.created_at)}</small></span><span><Badge tone={tone(item.scan_status)}>{statusLabel(item.scan_status, c)}</Badge>{item.download_url ? <a href={item.download_url}>{c("Download", "下载")}</a> : null}</span></div>) : <p className="p14-muted">{c("No attachments.", "暂无附件。")}</p>}</div>
          <div className="p14-reply"><label className="p14-check"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)}/> {c("Private administrator note", "管理员内部备注")}</label><Field label={internal ? c("Private note", "内部备注") : c("Reply to customer", "回复用户")} htmlFor="admin-ticket-reply"><Textarea id="admin-ticket-reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)}/></Field>{replyMutation.isError ? <Alert tone="danger" title={c("Reply could not be saved", "回复保存失败")}>{errorText(replyMutation.error)}</Alert> : null}<Button type="button" loading={replyMutation.isPending} onClick={() => reply.trim().length >= 2 && replyMutation.mutate()}>{internal ? c("Add private note", "添加内部备注") : c("Send customer reply", "发送用户回复")}</Button></div>
        </> : null}
      </section>
    </div>
  </Page>;
}
