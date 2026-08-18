import { api } from "@gojet/auth";
export type Department={id:number;name:string;slug:string;description?:string};
export type Ticket={id:number;ticket_number:string;user_id:number;user_email?:string;department_id:number;department_name:string;subject:string;priority:string;status:string;last_reply_at:string;last_reply_by:string;created_at:string};
export type TicketMessage={id:number;author_type:string;author_name:string;body:string;internal:boolean;ip_address?:string;created_at:string};
export type TicketDetail={ticket:Ticket;messages:TicketMessage[]};
export type MailLog={id:number;message_type:string;recipient:string;subject:string;status:string;message_id?:string;attempts:number;last_error?:string;created_at:string};
export type MailTemplate={id:number;key:string;name:string;subject_template:string;html_template:string;status:string;updated_at:string};
export type MailConfig={host:string;port:number;username:string;encryption:string;ehlo:string;from_email:string;from_name:string;reply_to:string;password_configured:boolean};
export const p14Client={
 departments:()=>api.get<{data:Department[]}>("/api/support/departments"),
 tickets:(params:URLSearchParams)=>api.get<{data:Ticket[]}>(`/api/admin/support/tickets?${params.toString()}`),
 ticket:(id:number)=>api.get<TicketDetail>(`/api/admin/support/tickets/${id}`),
 reply:(id:number,message:string,internal:boolean)=>api.post(`/api/admin/support/tickets/${id}/replies`,{message,internal}),
 updateTicket:(id:number,body:{status?:string;priority?:string;department_id?:number})=>api.patch(`/api/admin/support/tickets/${id}`,body),
 mailLogs:()=>api.get<{data:MailLog[]}>("/api/admin/mail/logs"), retryMail:(id:number)=>api.post(`/api/admin/mail/${id}/retry`),
 templates:()=>api.get<{data:MailTemplate[]}>("/api/admin/mail/templates"), saveTemplate:(item:MailTemplate)=>api.put(`/api/admin/mail/templates/${encodeURIComponent(item.key)}`,item),
 settings:()=>api.get<Record<string,unknown>&{mail:MailConfig}>("/api/admin/settings"), saveMail:(body:Record<string,unknown>)=>api.put("/api/admin/settings/mail",body), testMail:(recipient:string)=>api.post("/api/admin/mail/test",{recipient})
};
export const p14Error=(error:unknown)=>error instanceof Error?error.message:"Unexpected error";
export const p14Date=(value?:string)=>value?new Date(value).toLocaleString():"—";
