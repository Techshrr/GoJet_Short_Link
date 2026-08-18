import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import TurnstileField from "../TurnstileField";
import "../support.css";

type Department = { id: number; name: string; slug: string; description?: string };
type Ticket = { id: number; ticket_number: string; department_name: string; subject: string; priority: string; status: string; last_reply_at: string; last_reply_by: string; created_at: string };
type Message = { id: number; author_type: string; author_name: string; body: string; internal: boolean; created_at: string };
type Attachment = { id: number; ticket_id: number; message_id: number; original_name: string; mime_type: string; size_bytes: number; scan_status: string; created_at: string; download_url?: string };
type Detail = { ticket: Ticket; messages: Message[] };
type List<T> = { data: T[] };

const statusTone = (status: string): "neutral" | "success" | "warning" | "danger" => status === "closed" || status === "resolved" || status === "clean" ? "success" : status === "customer_reply" || status === "pending" ? "warning" : status === "open" || status === "infected" || status === "failed" ? "danger" : "neutral";
const formatDate = (value: string) => new Date(value).toLocaleString();
const errorText = (error: unknown) => error instanceof Error ? error.message : "Unexpected error";
const fileSize = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;

export default function SupportPage() {
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
    setAttachmentError(""); try { if (createFiles.length) await uploadFiles(result.id, createFiles); } catch (error) { setAttachmentError(`Ticket created, but an attachment failed: ${errorText(error)}`); }
    setSubject(""); setMessage(""); setCreateFiles([]); setCreateTurnstile(""); setSelectedId(result.id); await refresh();
  } });
  const sendReply = useMutation({ mutationFn: () => api.post(`/api/support/tickets/${selectedId}/replies`, { message: reply.trim(), turnstile_token: replyTurnstile }), onSuccess: async () => {
    setAttachmentError(""); try { if (selectedId && replyFiles.length) await uploadFiles(selectedId, replyFiles); } catch (error) { setAttachmentError(`Reply saved, but an attachment failed: ${errorText(error)}`); }
    setReply(""); setReplyFiles([]); setReplyTurnstile(""); await refresh();
  } });
  const stateMutation = useMutation({ mutationFn: (action: "close" | "reopen") => api.patch(`/api/support/tickets/${selectedId}/state`, { action }), onSuccess: refresh });
  const submitCreate = (event: FormEvent) => { event.preventDefault(); if (departmentId && subject.trim().length >= 3 && message.trim().length >= 2) createTicket.mutate(); };
  const currentAttachments = attachments.data?.data ?? [];

  return <Page className="support-page" data-p14-support>
    <PageHeader title="Support Center" description="Create a ticket, follow the conversation and keep every reply, attachment and status change visible." />
    <div className="support-grid">
      <section className="support-panel"><h2>Create ticket</h2><form className="support-form" onSubmit={submitCreate}>
        <Field label="Department" htmlFor="support-department"><Select id="support-department" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Select a department</option>{(departments.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Priority" htmlFor="support-priority"><Select id="support-priority" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></Field>
        <Field label="Subject" htmlFor="support-subject"><Input id="support-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message" htmlFor="support-message"><Textarea id="support-message" required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <Field label="Attachments" htmlFor="support-attachments" help="Up to 5 files, 10 MB each. Every upload is malware-scanned before it can be downloaded."><Input id="support-attachments" type="file" multiple onChange={(e) => setCreateFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></Field>
        {createFiles.length ? <div className="support-file-selection">{createFiles.map((file) => <span key={`${file.name}-${file.size}`}>{file.name} · {fileSize(file.size)}</span>)}</div> : null}
        <TurnstileField surface="ticket_create" onToken={setCreateTurnstile} />
        {createTicket.isError ? <Alert tone="danger" title="Ticket could not be created">{errorText(createTicket.error)}</Alert> : null}<Button type="submit" loading={createTicket.isPending}>Create ticket</Button>
      </form></section>
      <section className="support-panel" id="ticket-list"><div className="support-panel-head"><h2>My tickets</h2><span>{data.length} total</span></div>{tickets.isPending ? <Spinner label="Loading tickets" /> : tickets.isError ? <ErrorState title="Unable to load tickets" description={errorText(tickets.error)} action={<Button type="button" onClick={() => tickets.refetch()}>Retry</Button>} /> : data.length ? <div className="support-ticket-list">{data.map((ticket) => <button key={ticket.id} type="button" className={selectedId === ticket.id ? "support-ticket is-active" : "support-ticket"} onClick={() => setSelectedId(ticket.id)}><span><strong>{ticket.ticket_number}</strong><small>{ticket.department_name} · {formatDate(ticket.last_reply_at)}</small></span><span><Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge><small>{ticket.priority}</small></span><b>{ticket.subject}</b></button>)}</div> : <EmptyState title="No support tickets" description="Create a ticket when you need help from the GoJet team." />}</section>
    </div>
    {attachmentError ? <Alert tone="warning" title="Attachment status">{attachmentError}</Alert> : null}
    <section className="support-panel support-conversation"><div className="support-panel-head"><h2>Current ticket</h2>{detail.data ? <div className="support-actions"><a className="support-back" href="#ticket-list">Ticket list</a><Badge tone={statusTone(detail.data.ticket.status)}>{detail.data.ticket.status}</Badge><Button type="button" onClick={() => stateMutation.mutate(detail.data!.ticket.status === "closed" ? "reopen" : "close")} loading={stateMutation.isPending}>{detail.data.ticket.status === "closed" ? "Reopen" : "Close"}</Button></div> : null}</div>
      {!selectedId ? <EmptyState title="Select a ticket" description="Choose a ticket to view its timeline." /> : detail.isPending ? <Spinner label="Loading conversation" /> : detail.isError ? <ErrorState title="Unable to load conversation" description={errorText(detail.error)} /> : detail.data ? <><div className="support-thread">{detail.data.messages.map((item) => <article className={`support-message support-message--${item.author_type}`} key={item.id}><header><strong>{item.author_name || item.author_type}</strong><span>{formatDate(item.created_at)}</span></header><p>{item.body}</p></article>)}</div>
        <div className="support-attachment-list"><div className="support-panel-head"><h3>Attachments</h3><span>{currentAttachments.length}</span></div>{attachments.isPending ? <Spinner label="Loading attachments" /> : currentAttachments.length ? currentAttachments.map((item) => <div className="support-attachment" key={item.id}><div><strong>{item.original_name}</strong><small>{fileSize(item.size_bytes)} · {formatDate(item.created_at)}</small></div><div><Badge tone={statusTone(item.scan_status)}>{item.scan_status}</Badge>{item.download_url ? <a href={item.download_url}>Download</a> : null}</div></div>) : <p className="support-muted">No attachments on this ticket.</p>}</div>
        {detail.data.ticket.status !== "closed" ? <form className="support-reply" onSubmit={(event) => { event.preventDefault(); if (reply.trim().length >= 2) sendReply.mutate(); }}><Field label="Reply" htmlFor="support-reply"><Textarea id="support-reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></Field><Field label="Attachments" htmlFor="support-reply-attachments" help="Optional, up to 5 files of 10 MB each."><Input id="support-reply-attachments" type="file" multiple onChange={(e) => setReplyFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></Field><TurnstileField surface="ticket_reply" onToken={setReplyTurnstile} />{sendReply.isError ? <Alert tone="danger" title="Reply failed">{errorText(sendReply.error)}</Alert> : null}<Button type="submit" loading={sendReply.isPending}>Send reply</Button></form> : <Alert tone="neutral" title="Ticket closed">Reopen this ticket before sending another reply.</Alert>}</> : null}
    </section>
    <section className="support-guidance"><article className="support-panel"><h2>Recommended Help Center</h2><p>Start with the product documentation for setup, DNS, links, files and account security. It may resolve common configuration issues immediately.</p><a href="/docs/en/">Open Help Center</a></article><article className="support-panel"><h2>Response times</h2><p>Urgent security and service-impacting tickets are triaged first. Normal product questions are handled in queue order; the current ticket status is always the source of truth.</p></article></section>
  </Page>;
}
