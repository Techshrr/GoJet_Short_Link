import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import "../support.css";

type Department = { id: number; name: string; slug: string; description?: string };
type Ticket = { id: number; ticket_number: string; department_name: string; subject: string; priority: string; status: string; last_reply_at: string; last_reply_by: string; created_at: string };
type Message = { id: number; author_type: string; author_name: string; body: string; internal: boolean; created_at: string };
type Detail = { ticket: Ticket; messages: Message[] };
type List<T> = { data: T[] };

const statusTone = (status: string): "neutral" | "success" | "warning" | "danger" => status === "closed" || status === "resolved" ? "success" : status === "customer_reply" ? "warning" : status === "open" ? "danger" : "neutral";
const formatDate = (value: string) => new Date(value).toLocaleString();
const errorText = (error: unknown) => error instanceof Error ? error.message : "Unexpected error";

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const departments = useQuery({ queryKey: ["support-departments"], queryFn: () => api.get<List<Department>>("/api/support/departments") });
  const tickets = useQuery({ queryKey: ["support-tickets"], queryFn: () => api.get<List<Ticket>>("/api/support/tickets") });
  const data = tickets.data?.data ?? [];
  useEffect(() => { if (selectedId === null && data[0]) setSelectedId(data[0].id); }, [data, selectedId]);
  const detail = useQuery({ queryKey: ["support-ticket", selectedId], enabled: selectedId !== null, queryFn: () => api.get<Detail>(`/api/support/tickets/${selectedId}`) });
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["support-tickets"] }), queryClient.invalidateQueries({ queryKey: ["support-ticket", selectedId] })]); };
  const createTicket = useMutation({ mutationFn: () => api.post<{ id: number }>("/api/support/tickets", { department_id: Number(departmentId), priority, subject: subject.trim(), message: message.trim() }), onSuccess: async (result) => { setSubject(""); setMessage(""); setSelectedId(result.id); await refresh(); } });
  const sendReply = useMutation({ mutationFn: () => api.post(`/api/support/tickets/${selectedId}/replies`, { message: reply.trim() }), onSuccess: async () => { setReply(""); await refresh(); } });
  const stateMutation = useMutation({ mutationFn: (action: "close" | "reopen") => api.patch(`/api/support/tickets/${selectedId}/state`, { action }), onSuccess: refresh });
  const submitCreate = (event: FormEvent) => { event.preventDefault(); if (departmentId && subject.trim().length >= 3 && message.trim().length >= 2) createTicket.mutate(); };
  return <Page className="support-page" data-p14-support>
    <PageHeader title="Support" description="Open a ticket, follow the conversation and keep the current server-side ticket state visible." />
    <div className="support-grid">
      <section className="support-panel"><h2>New ticket</h2><form className="support-form" onSubmit={submitCreate}>
        <Field label="Department" htmlFor="support-department"><Select id="support-department" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Select a department</option>{(departments.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Priority" htmlFor="support-priority"><Select id="support-priority" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></Field>
        <Field label="Subject" htmlFor="support-subject"><Input id="support-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message" htmlFor="support-message"><Textarea id="support-message" required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        {createTicket.isError ? <Alert tone="danger" title="Ticket could not be created">{errorText(createTicket.error)}</Alert> : null}<Button type="submit" loading={createTicket.isPending}>Create ticket</Button>
      </form></section>
      <section className="support-panel"><div className="support-panel-head"><h2>My tickets</h2><span>{data.length} total</span></div>{tickets.isPending ? <Spinner label="Loading tickets" /> : tickets.isError ? <ErrorState title="Unable to load tickets" description={errorText(tickets.error)} action={<Button type="button" onClick={() => tickets.refetch()}>Retry</Button>} /> : data.length ? <div className="support-ticket-list">{data.map((ticket) => <button key={ticket.id} type="button" className={selectedId === ticket.id ? "support-ticket is-active" : "support-ticket"} onClick={() => setSelectedId(ticket.id)}><span><strong>{ticket.ticket_number}</strong><small>{ticket.department_name} · {formatDate(ticket.last_reply_at)}</small></span><span><Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge><small>{ticket.priority}</small></span><b>{ticket.subject}</b></button>)}</div> : <EmptyState title="No support tickets" description="Create a ticket when you need help from the GoJet team." />}</section>
    </div>
    <section className="support-panel support-conversation"><div className="support-panel-head"><h2>Conversation</h2>{detail.data ? <div className="support-actions"><Badge tone={statusTone(detail.data.ticket.status)}>{detail.data.ticket.status}</Badge><Button type="button" onClick={() => stateMutation.mutate(detail.data!.ticket.status === "closed" ? "reopen" : "close")} loading={stateMutation.isPending}>{detail.data.ticket.status === "closed" ? "Reopen" : "Close"}</Button></div> : null}</div>
      {!selectedId ? <EmptyState title="Select a ticket" description="Choose a ticket to view its timeline." /> : detail.isPending ? <Spinner label="Loading conversation" /> : detail.isError ? <ErrorState title="Unable to load conversation" description={errorText(detail.error)} /> : detail.data ? <><div className="support-thread">{detail.data.messages.map((item) => <article className={`support-message support-message--${item.author_type}`} key={item.id}><header><strong>{item.author_name || item.author_type}</strong><span>{formatDate(item.created_at)}</span></header><p>{item.body}</p></article>)}</div>{detail.data.ticket.status !== "closed" ? <form className="support-reply" onSubmit={(event) => { event.preventDefault(); if (reply.trim().length >= 2) sendReply.mutate(); }}><Field label="Reply" htmlFor="support-reply"><Textarea id="support-reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>{sendReply.isError ? <Alert tone="danger" title="Reply failed">{errorText(sendReply.error)}</Alert> : null}<Button type="submit" loading={sendReply.isPending}>Send reply</Button></form> : <Alert tone="neutral" title="Ticket closed">Reopen this ticket before sending another reply.</Alert>}</> : null}
    </section>
  </Page>;
}
