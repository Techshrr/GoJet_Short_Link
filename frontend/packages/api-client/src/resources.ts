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
  created_at: string;
}

export interface FileUploadInput {
  file: File;
  expires_at?: string;
  max_downloads?: number;
  password?: string;
}

export type TextShareFormat = "plain" | "markdown" | "code";
export type TextShareStatus = "active" | "paused" | "consumed" | "expired";

export interface TextShareRecord {
  id: number;
  slug: string;
  title: string;
  content?: string;
  format: TextShareFormat;
  status: TextShareStatus;
  expires_at?: string | null;
  one_time: boolean;
  protected: boolean;
  views: number;
  created_at?: string;
}

export interface TextShareCreateInput {
  slug?: string | undefined;
  title: string;
  content: string;
  format: TextShareFormat;
  expires_at?: string | null;
  one_time: boolean;
  password?: string | undefined;
}

export interface TextShareUpdateInput {
  title: string;
  content: string;
  format: TextShareFormat;
  status: "active" | "paused";
  expires_at?: string | null;
  one_time: boolean;
  password?: string | undefined;
}

export type BioPageStatus = "draft" | "published" | "paused";

export interface BioTheme {
  Primary: string;
  Background: string;
  Ink?: string | undefined;
  Muted?: string | undefined;
  Surface?: string | undefined;
}

export interface BioBlock {
  Label: string;
  URL: string;
}

export interface BioPageRecord {
  id: number;
  slug: string;
  title: string;
  bio: string;
  status: BioPageStatus;
  theme: BioTheme;
  blocks: BioBlock[];
  views: number;
  created_at?: string;
}

export interface BioPageInput {
  slug?: string | undefined;
  title: string;
  bio: string;
  status: BioPageStatus;
  theme: BioTheme;
  blocks: BioBlock[];
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

export function createTextClient(api: ApiTransport) {
  const base = (workspaceId: number) => `/api/workspaces/${workspaceId}/text-shares`;
  return {
    list: (workspaceId: number) => api.get<{ data: TextShareRecord[] }>(base(workspaceId)),
    get: (workspaceId: number, shareId: number) => api.get<TextShareRecord>(`${base(workspaceId)}/${shareId}`),
    create: (workspaceId: number, input: TextShareCreateInput) => api.post<TextShareRecord>(base(workspaceId), input),
    update: (workspaceId: number, shareId: number, input: TextShareUpdateInput) => api.put<{ updated: boolean }>(`${base(workspaceId)}/${shareId}`, input),
    delete: (workspaceId: number, shareId: number) => api.delete<void>(`${base(workspaceId)}/${shareId}`),
    publicUrl: (slug: string) => `/t/${encodeURIComponent(slug)}`
  };
}

export function createBioClient(api: ApiTransport) {
  const base = (workspaceId: number) => `/api/workspaces/${workspaceId}/bio-pages`;
  return {
    list: (workspaceId: number) => api.get<{ data: BioPageRecord[] }>(base(workspaceId)),
    create: (workspaceId: number, input: BioPageInput) => api.post<BioPageRecord>(base(workspaceId), input),
    update: (workspaceId: number, pageId: number, input: BioPageInput) => api.put<{ updated: boolean }>(`${base(workspaceId)}/${pageId}`, input),
    delete: (workspaceId: number, pageId: number) => api.delete<void>(`${base(workspaceId)}/${pageId}`),
    publicUrl: (slug: string) => `/p/${encodeURIComponent(slug)}`
  };
}
