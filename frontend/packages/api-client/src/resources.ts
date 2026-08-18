import type { ApiTransport, WorkspaceRole } from "./links";

export interface QRCodeRecord {
  id: number;
  link_id: number;
  name: string;
  image_url: string;
  foreground: string;
  background: string;
  size: number;
  code?: string;
  domain?: string;
  qr_visits: number;
  created_at?: string;
}

export interface QRCreateInput {
  link_id: number;
  name: string;
  foreground: string;
  background: string;
  size: number;
}

export interface FileShareRecord {
  id: number;
  workspace_id: number;
  slug: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  scan_status: string;
  scan_result?: string;
  status: string;
  expires_at?: string | null;
  max_downloads?: number | null;
  downloads: number;
  protected: boolean;
}

export interface FileUploadInput {
  file: File;
  expires_at?: string;
  max_downloads?: number;
  password?: string;
}

export interface ResourceAccess {
  role: WorkspaceRole;
  can_view: boolean;
  can_edit: boolean;
}

export function resourceAccess(role: WorkspaceRole): ResourceAccess {
  return {
    role,
    can_view: true,
    can_edit: role === "owner" || role === "admin" || role === "editor"
  };
}

export function createQRClient(api: ApiTransport) {
  const base = (workspaceId: number) => `/api/workspaces/${workspaceId}/qr-codes`;
  return {
    list: (workspaceId: number) => api.get<{ data: QRCodeRecord[] }>(base(workspaceId)),
    create: (workspaceId: number, input: QRCreateInput) => api.post<QRCodeRecord>(base(workspaceId), input),
    delete: (workspaceId: number, qrId: number) => api.delete<void>(`${base(workspaceId)}/${qrId}`)
  };
}

export function createFilesClient(api: ApiTransport) {
  const base = (workspaceId: number) => `/api/workspaces/${workspaceId}/fileshares`;
  return {
    list: (workspaceId: number) => api.get<{ data: FileShareRecord[] }>(base(workspaceId)),
    upload: (workspaceId: number, input: FileUploadInput) => {
      const form = new FormData();
      form.set("file", input.file);
      if (input.expires_at) form.set("expires_at", input.expires_at);
      if (input.max_downloads !== undefined) form.set("max_downloads", String(input.max_downloads));
      if (input.password) form.set("password", input.password);
      return api.request<FileShareRecord>(base(workspaceId), { method: "POST", body: form });
    },
    delete: (workspaceId: number, fileId: number, retentionDays = 7) => api.delete<void>(`${base(workspaceId)}/${fileId}?retention_days=${retentionDays}`),
    publicUrl: (slug: string) => `/f/${encodeURIComponent(slug)}`
  };
}
