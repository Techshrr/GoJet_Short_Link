import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea, localizedError, useLocale, type GoJetLocale } from "@gojet/ui";
import TurnstileField from "../TurnstileField";
import "../support.css";

type Department = { id: number; name: string; slug: string; description?: string };
type Ticket = { id: number; ticket_number: string; department_name: string; subject: string; priority: string; status: string; last_reply_at: string; last_reply_by: string; created_at: string };
type Message = { id: number; author_type: string; author_name: string; body: string; internal: boolean; created_at: string };
type Attachment = { id: number; ticket_id: number; message_id: number; original_name: string; mime_type: string; size_bytes: number; scan_status: string; created_at: string; download_url?: string };
type Detail = { ticket: Ticket; messages: Message[] };
type List<T> = { data: T[] };
type Copy = (en: string, zh: string) => string;

const statusTone = (status: string): "neutral" | "success" | "warning" | "danger" => status === "closed" || status === "resolved" || status === "clean" ? "success" : status === "customer_reply" || status === "pending" ? "warning" : status === "open" || status === "infected" || status === "failed" ? "danger" : "neutral";
const formatDate = (value: string) => new Date(value).toLocaleString();
function errorStatus(error: unknown): number | undefined { if (!error || typeof error !== "object" || !("status" in error)) return undefined; const status = (error as { status?: unknown }).status; return typeof status === "number" ? status : undefined; }
const errorText = (error: unknown, locale: GoJetLocale) => localizedError(error instanceof Error ? error.message : undefined, locale, errorStatus(error));
const fileSize = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;

export default function SupportPage() {
  const { locale } = useLocale();
  const c: Copy = (en, zh) => locale === "zh-CN" ? zh : en;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [createTurnstile, setCreateTurnstile] = useState("");
  const [replyTurnstile, setReplyTurnstile] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const departments = useQuery({ queryKey: ["support-departments"], queryFn: () => api.get<List<Department>>("/api/support/departments") });
  const tickets = useQuery({ queryKey: ["support-tickets"], queryFn: () => api.get<List<Ticket>>("/api/support/tickets") });
  const data = tickets.data?.data ?? [];
  useEffect(() => { if (selectedId === null && data[0]) setSelectedId(data[0].id); }, [data, selectedId]);
  const detail = useQuery({ queryKey: ["support-ticket", selectedId], enabled: selectedId !== null, queryFn: () => api.get<Detail>(`/api/support/tickets/${selectedId}`) });
  const attachments = useQuery({ queryKey: ["support-ticket-attachments", selectedId], enabled: selectedId !== null, queryFn: () => api.get<List<Attachment>>(`/api/support/tickets/${selectedId}/attachments`) });
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["support-tickets"] }), queryClient.invalidateQueries({ queryKey: ["support-ticket", selectedId] }), queryClient.invalidateQueries({ queryKey: ["support-ticket-attachments", selectedId] })]); };
  const uploadFiles = async (ticketId: number, files: File[]) => { for (const file of files.slice(0, 5)) { const body = new FormData(); body.append("file", file); await api.request(`/api/support/tickets/${ticketId}/attachments`, { method: "POST", body }); } };
  const createTicket = useMutation({ mutationFn: () => api.post<{ id: number }>("/api/support/tickets", { department_id: Number(departmentId), priority, subject: subject.trim(), message: message.trim(), turnstile_token: createTurnstile }), onSuccess: async (result) => {
    setAttachmentError(""); try { if (createFiles.length) await uploadFiles(result.id, createFiles); } catch (error) { setAttachmentError(c(`The ticket was created, but one attachment could not be uploaded: ${errorText(error, locale)}`, `工单已创建，但有一个附件上传失败：${errorText(error, locale)}`)); }
    setSubject(""); setMessage(""); setCreateFiles([]); setCreateTurnstile(""); setSelectedId(result.id); await refresh();
  } });
  const sendReply = useMutation({ mutationFn: () => api.post(`/api/support/tickets/${selectedId}/replies`, { message: reply.trim(), turnstile_token: replyTurnstile }), onSuccess: async () => {
    setAttachmentError(""); try { if (selectedId && replyFiles.length) await uploadFiles(selectedId, replyFiles); } catch (error) { setAttachmentError(c(`The reply was saved, but one attachment could not be uploaded: ${errorText(error, locale)}`, `回复已保存，但有一个附件上传失败：${errorText(error, locale)}`)); }
    setReply(""); setReplyFiles([]); setReplyTurnstile(""); await refresh();
  } });
  const stateMutation = useMutation({ mutationFn: (action: "close" | "reopen") => api.patch(`/api/support/tickets/${selectedId}/state`, { action }), onSuccess: refresh });
  const submitCreate = (event: FormEvent) => { event.preventDefault(); if (departmentId && subject.trim().length >= 3 && message.trim().length >= 2) createTicket.mutate(); };
  const currentAttachments = attachments.data?.data ?? [];
  const ticketStatus = (value: string) => value === "open" ? c("Open", "处理中") : value === "customer_reply" ? c("Waiting for support", "等待客服回复") : value === "pending" ? c("Pending", "等待处理") : value === "resolved" ? c("Resolved", "已解决") : value === "closed" ? c("Closed", "已关闭") : value;
  const priorityLabel = (value: string) => value === "low" ? c("Low", "低") : value === "normal" ? c("Normal", "普通") : value === "high" ? c("High", "高") : value === "urgent" ? c("Urgent", "紧急") : value;
  const scanStatus = (value: string) => value === "clean" ? c("Ready", "可以下载") : value === "pending" || value === "processing" ? c("Checking", "检查中") : value === "infected" ? c("Blocked", "已阻止") : value === "failed" ? c("Check failed", "检查失败") : value;

  return <Page className="support-page" data-p14-support>
    <PageHeader title={c("Help & support", "帮助与工单")} description={c("Create a support ticket, follow replies and keep attachments and status changes together in one conversation.", "创建支持工单、查看回复，并在同一处管理附件和工单状态变化。")}/>
    <div className="support-grid">
      <section className="support-panel"><h2>{c("Create a ticket", "创建工单")}</h2><p className="support-muted">{c("Describe the issue clearly and attach screenshots or files when they help explain the problem.", "请尽量清楚地描述问题；如截图或文件有助于说明情况，也可以一并添加。")}</p><form className="support-form" onSubmit={submitCreate}>
        <Field label={c("Department", "问题分类")} htmlFor="support-department"><Select id="support-department" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">{c("Select a department", "请选择问题分类")}</option>{(departments.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label={c("Priority", "紧急程度")} htmlFor="support-priority"><Select id="support-priority" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">{c("Low", "低")}</option><option value="normal">{c("Normal", "普通")}</option><option value="high">{c("High", "高")}</option><option value="urgent">{c("Urgent", "紧急")}</option></Select></Field>
        <Field label={c("Subject", "主题")} htmlFor="support-subject"><Input id="support-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label={c("Message", "问题说明")} htmlFor="support-message"><Textarea id="support-message" required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <Field label={c("Attachments", "附件")} htmlFor="support-attachments" help={c("Up to 5 files, 10 MB each. Uploaded files are checked before they can be downloaded.", "最多 5 个附件，每个不超过 10 MB。上传后的文件需要完成安全检查后才能下载。") }><Input id="support-attachments" type="file" multiple onChange={(e) => setCreateFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></Field>
        {createFiles.length ? <div className="support-file-selection">{createFiles.map((file) => <span key={`${file.name}-${file.size}`}>{file.name} · {fileSize(file.size)}</span>)}</div> : null}
        <TurnstileField surface="ticket_create" onToken={setCreateTurnstile} />
        {createTicket.isError ? <Alert tone="danger" title={c("Ticket could not be created", "工单创建失败")}>{errorText(createTicket.error, locale)}</Alert> : null}<Button type="submit" loading={createTicket.isPending}>{c("Create ticket", "提交工单")}</Button>
      </form></section>
      <section className="support-panel" id="ticket-list"><div className="support-panel-head"><h2>{c("My tickets", "我的工单")}</h2><span>{c(`${data.length} total`, `共 ${data.length} 个`)}</span></div>{tickets.isPending ? <Spinner label={c("Loading tickets", "正在加载工单")} /> : tickets.isError ? <ErrorState title={c("Unable to load tickets", "无法加载工单")} description={errorText(tickets.error, locale)} action={<Button type="button" onClick={() => tickets.refetch()}>{c("Retry", "重试")}</Button>} /> : data.length ? <div className="support-ticket-list">{data.map((ticket) => <button key={ticket.id} type="button" className={selectedId === ticket.id ? "support-ticket is-active" : "support-ticket"} onClick={() => setSelectedId(ticket.id)}><span><strong>{ticket.ticket_number}</strong><small>{ticket.department_name} · {formatDate(ticket.last_reply_at)}</small></span><span><Badge tone={statusTone(ticket.status)}>{ticketStatus(ticket.status)}</Badge><small>{priorityLabel(ticket.priority)}</small></span><b>{ticket.subject}</b></button>)}</div> : <EmptyState title={c("No support tickets", "还没有工单")} description={c("Create a ticket whenever you need help from the GoJet team.", "需要 GoJet 团队协助时，可以在这里创建工单。")}/>}</section>
    </div>
    {attachmentError ? <Alert tone="warning" title={c("Attachment upload", "附件上传")}>{attachmentError}</Alert> : null}
    <section className="support-panel support-conversation"><div className="support-panel-head"><h2>{c("Ticket conversation", "工单对话")}</h2>{detail.data ? <div className="support-actions"><a className="support-back" href="#ticket-list">{c("Back to ticket list", "返回工单列表")}</a><Badge tone={statusTone(detail.data.ticket.status)}>{ticketStatus(detail.data.ticket.status)}</Badge><Button type="button" onClick={() => stateMutation.mutate(detail.data!.ticket.status === "closed" ? "reopen" : "close")} loading={stateMutation.isPending}>{detail.data.ticket.status === "closed" ? c("Reopen", "重新打开") : c("Close ticket", "关闭工单")}</Button></div> : null}</div>
      {!selectedId ? <EmptyState title={c("Select a ticket", "请选择工单")} description={c("Choose a ticket to read its conversation and attachments.", "选择一个工单后即可查看对话和附件。")}/>
      : detail.isPending ? <Spinner label={c("Loading conversation", "正在加载工单对话")} />
      : detail.isError ? <ErrorState title={c("Unable to load conversation", "无法加载工单对话")} description={errorText(detail.error, locale)} />
      : detail.data ? <><div className="support-thread">{detail.data.messages.filter((item) => !item.internal).map((item) => <article className={`support-message support-message--${item.author_type}`} key={item.id}><header><strong>{item.author_name || (item.author_type === "admin" ? c("GoJet support", "GoJet 客服") : c("You", "你"))}</strong><span>{formatDate(item.created_at)}</span></header><p>{item.body}</p></article>)}</div>
        <div className="support-attachment-list"><div className="support-panel-head"><h3>{c("Attachments", "附件")}</h3><span>{currentAttachments.length}</span></div>{attachments.isPending ? <Spinner label={c("Loading attachments", "正在加载附件")} /> : currentAttachments.length ? currentAttachments.map((item) => <div className="support-attachment" key={item.id}><div><strong>{item.original_name}</strong><small>{fileSize(item.size_bytes)} · {formatDate(item.created_at)}</small></div><div><Badge tone={statusTone(item.scan_status)}>{scanStatus(item.scan_status)}</Badge>{item.download_url ? <a href={item.download_url}>{c("Download", "下载")}</a> : null}</div></div>) : <p className="support-muted">{c("This ticket has no attachments.", "这个工单暂无附件。")}</p>}</div>
        {detail.data.ticket.status !== "closed" ? <form className="support-reply" onSubmit={(event) => { event.preventDefault(); if (reply.trim().length >= 2) sendReply.mutate(); }}><Field label={c("Reply", "回复内容")} htmlFor="support-reply"><Textarea id="support-reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></Field><Field label={c("Attachments", "附件")} htmlFor="support-reply-attachments" help={c("Optional. Up to 5 files, 10 MB each.", "可选。最多 5 个附件，每个不超过 10 MB。") }><Input id="support-reply-attachments" type="file" multiple onChange={(e) => setReplyFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></Field><TurnstileField surface="ticket_reply" onToken={setReplyTurnstile} />{sendReply.isError ? <Alert tone="danger" title={c("Reply could not be sent", "回复发送失败")}>{errorText(sendReply.error, locale)}</Alert> : null}<Button type="submit" loading={sendReply.isPending}>{c("Send reply", "发送回复")}</Button></form> : <Alert tone="info" title={c("Ticket closed", "工单已关闭")}>{c("Reopen this ticket if you need to continue the conversation.", "如需继续沟通，请先重新打开这个工单。")}</Alert>}</> : null}
    </section>
    <section className="support-guidance"><article className="support-panel"><h2>{c("Help documentation", "帮助文档")}</h2><p>{c("For setup, domains, links, files and account protection, the help documentation contains step-by-step guidance that may resolve common questions immediately.", "关于安装配置、域名、短链接、文件和账号保护，帮助文档提供了完整操作说明，很多常见问题可以直接在文档中解决。")}</p><a href={locale === "zh-CN" ? "/docs/zh-CN/" : "/docs/"}>{c("Open help documentation", "打开帮助文档")}</a></article><article className="support-panel"><h2>{c("How tickets are handled", "工单处理方式")}</h2><p>{c("Urgent security or service-impacting issues are reviewed first. Other requests are handled in order, and you can always see the latest status and reply in the ticket conversation above.", "影响账号安全或服务可用性的紧急问题会优先处理，其他问题按顺序回复。你可以随时在上方工单对话中查看最新状态和回复。")}</p></article></section>
  </Page>;
}
