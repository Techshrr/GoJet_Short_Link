import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createWorkspaceClient, type WorkspaceRole, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner } from "@gojet/ui";
import { AlertDialog, SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const workspaceClient = createWorkspaceClient(api);
const assignableRoles: Exclude<WorkspaceRole, "owner">[] = ["admin", "editor", "analyst", "viewer"];
const roleLabels: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", editor: "Editor", analyst: "Analyst", viewer: "Viewer" };

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}

function InviteForm({ workspaceId, onDone }: { workspaceId: number; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("viewer");
  const mutation = useMutation({ mutationFn: () => workspaceClient.invite(workspaceId, email.trim(), role), onSuccess: () => { setEmail(""); setRole("viewer"); onDone(); } });
  const submit = (event: FormEvent) => { event.preventDefault(); if (email.trim()) mutation.mutate(); };
  return <form className="members-invite-form" onSubmit={submit}>
    {mutation.isError ? <Alert tone="danger" title="Invitation failed">{errorMessage(mutation.error)}</Alert> : null}
    <Field label="Email" htmlFor="member-email" required><Input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" required /></Field>
    <Field label="Role" htmlFor="member-role" help="Owner cannot be assigned by invitation. Server-side RBAC remains authoritative."><Select id="member-role" value={role} onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, "owner">)}>{assignableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</Select></Field>
    <div className="members-sheet-actions"><Button type="submit" loading={mutation.isPending} disabled={!email.trim()}>Send invitation</Button></div>
  </form>;
}

export default function MembersPage() {
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const members = useQuery({ queryKey: ["workspace-members", workspaceId], queryFn: () => workspaceClient.members(workspaceId!), enabled: Boolean(workspaceId) });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
  const changeRole = useMutation({ mutationFn: ({ userId, role }: { userId: number; role: Exclude<WorkspaceRole, "owner"> }) => workspaceClient.changeRole(workspaceId!, userId, role), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (userId: number) => workspaceClient.removeMember(workspaceId!, userId), onSuccess: refresh });
  const resend = useMutation({ mutationFn: (invitationId: number) => workspaceClient.resendInvitation(workspaceId!, invitationId), onSuccess: refresh });
  const revoke = useMutation({ mutationFn: (invitationId: number) => workspaceClient.revokeInvitation(workspaceId!, invitationId), onSuccess: refresh });

  if (workspaces.isPending) return <Page className="members-page"><div className="workspace-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="members-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="members-page"><EmptyState title="还没有工作区" description="创建工作区后才能管理成员。" /></Page>;

  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const data = members.data;
  return <Page className="members-page" data-p12-members>
    <PageHeader title="Members" description={`Workspace access & roles · ${workspace.name}`} actions={canManage ? <SideSheet triggerLabel="Invite member" title="Invite member" description="邀请链接有效期由服务端控制；Owner 角色不能通过邀请授予。"><InviteForm workspaceId={workspace.id} onDone={refresh} /></SideSheet> : undefined} />
    {!canManage ? <Alert tone="warning" title="Read-only member access">当前角色为 {roleLabels[workspace.role]}。你可以查看成员和邀请，但只有 Owner / Admin 可以管理成员。</Alert> : null}
    {members.isError ? <ErrorState title="无法读取成员" description={errorMessage(members.error)} action={<Button type="button" onClick={() => members.refetch()}>重试</Button>} /> : members.isPending ? <div className="workspace-centered"><Spinner label="正在加载成员" /></div> : <>
      <section className="workspace-section" aria-labelledby="active-members-title">
        <div className="workspace-section-head"><div><span className="workspace-eyebrow">ACCESS CONTROL</span><h2 id="active-members-title">Active members</h2><p>五级角色映射到服务端 RBAC；Owner 始终不可从此页面降级或移除。</p></div><Badge tone="neutral">{data?.members.length ?? 0} members</Badge></div>
        {data?.members.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{data.members.map((member) => <tr key={member.user_id}><td><strong>{member.DisplayName || member.Email}</strong><small>{member.Email}</small></td><td>{canManage && member.Role !== "owner" ? <Select aria-label={`Role for ${member.Email}`} value={member.Role} disabled={changeRole.isPending} onChange={(event) => changeRole.mutate({ userId: member.user_id, role: event.target.value as Exclude<WorkspaceRole, "owner"> })}>{assignableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</Select> : <Badge tone={member.Role === "owner" ? "success" : "neutral"}>{roleLabels[member.Role]}</Badge>}</td><td><Badge tone={member.Status === "active" ? "success" : "neutral"}>{member.Status}</Badge></td><td>{formatDate(member.joined_at)}</td><td>{canManage && member.Role !== "owner" ? <AlertDialog triggerLabel="Remove" title="Remove member?" description={`${member.Email} will lose access to this workspace.`} confirmLabel="Remove member" onConfirm={() => remove.mutate(member.user_id)} /> : <span className="workspace-muted">—</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No active members" description="该工作区当前没有可显示的活动成员。" />}
      </section>
      <section className="workspace-section" aria-labelledby="pending-invitations-title">
        <div className="workspace-section-head"><div><span className="workspace-eyebrow">INVITATIONS</span><h2 id="pending-invitations-title">Pending invitations</h2><p>可重新发送或撤销；过期与接受状态由服务端判定。</p></div><Badge tone="neutral">{data?.invitations.length ?? 0} invitations</Badge></div>
        {data?.invitations.length ? <div className="workspace-invite-grid">{data.invitations.map((invitation) => <article key={invitation.id} className="workspace-invite-card"><div><strong>{invitation.Email}</strong><span>{roleLabels[invitation.Role]} · expires {formatDate(invitation.ExpiresAt)}</span></div><Badge tone={invitation.Status === "pending" ? "warning" : "neutral"}>{invitation.Status}</Badge>{canManage ? <div className="workspace-card-actions"><Button size="sm" variant="outline" type="button" loading={resend.isPending} onClick={() => resend.mutate(invitation.id)}>Resend</Button><Button size="sm" variant="outline" type="button" loading={revoke.isPending} onClick={() => revoke.mutate(invitation.id)}>Revoke</Button></div> : null}</article>)}</div> : <EmptyState title="No pending invitations" description="当前没有待处理邀请。" />}
      </section>
      {(changeRole.isError || remove.isError || resend.isError || revoke.isError) ? <Alert tone="danger" title="Member action failed">{errorMessage(changeRole.error ?? remove.error ?? resend.error ?? revoke.error)}</Alert> : null}
    </>}
  </Page>;
}
