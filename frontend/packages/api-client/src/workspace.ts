import type { ApiTransport, WorkspaceRole } from "./links";

export interface WorkspaceMember {
  user_id: number;
  Email: string;
  DisplayName: string;
  Role: WorkspaceRole;
  Status: string;
  joined_at: string;
}

export interface WorkspaceInvitation {
  id: number;
  Email: string;
  Role: WorkspaceRole;
  Status: string;
  ExpiresAt: string;
  CreatedAt: string;
}

export interface WorkspaceMembersPayload {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
}

export interface WorkspaceCampaignRecord { id: number; name: string; status: "active" | "paused" | "completed"; conversions: number; links: number; clicks: number; conversion_token?: string; }
export interface WorkspaceFolderRecord { id: number; name: string; links: number; }
export interface WorkspaceTagRecord { id: number; name: string; color: string; links: number; }
export interface WorkspaceOrganizationSnapshot { campaigns: WorkspaceCampaignRecord[]; folders: WorkspaceFolderRecord[]; tags: WorkspaceTagRecord[]; }

export function createWorkspaceClient(api: ApiTransport) {
  return {
    members: (workspaceId: number) => api.get<WorkspaceMembersPayload>(`/api/workspaces/${workspaceId}/members`),
    invite: (workspaceId: number, email: string, role: Exclude<WorkspaceRole, "owner">) => api.post<{ queued: boolean }>(`/api/workspaces/${workspaceId}/invitations`, { email, role }),
    resendInvitation: (workspaceId: number, invitationId: number) => api.post<{ queued: boolean }>(`/api/workspaces/${workspaceId}/invitations/${invitationId}/resend`),
    revokeInvitation: (workspaceId: number, invitationId: number) => api.delete<void>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`),
    changeRole: (workspaceId: number, userId: number, role: Exclude<WorkspaceRole, "owner">) => api.patch<{ updated: boolean }>(`/api/workspaces/${workspaceId}/members/${userId}`, { role }),
    removeMember: (workspaceId: number, userId: number) => api.delete<void>(`/api/workspaces/${workspaceId}/members/${userId}`),
    organization: (workspaceId: number) => api.get<WorkspaceOrganizationSnapshot>(`/api/workspaces/${workspaceId}/organization`),
    createCampaign: (workspaceId: number, name: string) => api.post<WorkspaceCampaignRecord>(`/api/workspaces/${workspaceId}/campaigns`, { name }),
    updateCampaignStatus: (workspaceId: number, campaignId: number, status: WorkspaceCampaignRecord["status"]) => api.patch<{ updated: boolean }>(`/api/workspaces/${workspaceId}/campaigns/${campaignId}`, { status }),
    createFolder: (workspaceId: number, name: string) => api.post<WorkspaceFolderRecord>(`/api/workspaces/${workspaceId}/folders`, { name }),
    createTag: (workspaceId: number, name: string, color: string) => api.post<WorkspaceTagRecord>(`/api/workspaces/${workspaceId}/tags`, { name, color })
  };
}
