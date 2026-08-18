export type LinkStatus = "active" | "paused" | "expired";
export type WorkspaceRole = "owner" | "admin" | "editor" | "analyst" | "viewer";
export type LinkDomainSource = "official" | "custom";
export type RoutingDimension = "device" | "country" | "language" | "source";

export interface ApiTransport {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
}

export interface WorkspaceSummary {
  id: number;
  name: string;
  type: string;
  role: WorkspaceRole;
}

export interface LinkCapabilities {
  role: WorkspaceRole;
  can_view: boolean;
  can_edit: boolean;
  can_analytics: boolean;
  can_manage: boolean;
}

export interface RoutingRule {
  Dimension: RoutingDimension;
  Value: string;
  Destination: string;
}

export interface ABDestination {
  ID: string;
  Destination: string;
  Weight: number;
}

export interface UTMValues {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface LinkRecord {
  id: number;
  workspace_id: number;
  created_by: number;
  code: string;
  domain: string;
  destination: string;
  title: string;
  status: LinkStatus;
  redirect_status: 301 | 302 | 307 | 308;
  password?: string;
  clear_password?: boolean;
  password_protected?: boolean;
  expires_at?: string | null;
  max_clicks?: number | null;
  one_time: boolean;
  folder_id?: number | null;
  campaign_id?: number | null;
  tag_ids?: number[];
  folder_name?: string;
  campaign_name?: string;
  tag_names?: string[];
  utm?: UTMValues;
  routing_rules?: RoutingRule[];
  ab_destinations?: ABDestination[];
  created_at?: string;
  updated_at?: string;
  clicks?: number;
  visitors?: number;
}

export interface LinkListFilters {
  search?: string;
  domain?: string;
  status?: LinkStatus | "";
  campaign?: number;
  folder?: number;
  tag?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface LinkListResponse {
  data: LinkRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface LinkDomainOption {
  hostname: string;
  label: string;
  source: LinkDomainSource;
  is_default: boolean;
}

export interface CampaignOption {
  id: number;
  name: string;
  status: string;
  conversions: number;
  links: number;
  clicks: number;
}

export interface FolderOption {
  id: number;
  name: string;
  links: number;
}

export interface TagOption {
  id: number;
  name: string;
  color: string;
  links: number;
}

export interface OrganizationSnapshot {
  campaigns: CampaignOption[];
  folders: FolderOption[];
  tags: TagOption[];
}

export interface AnalyticsDimension { name: string; count: number; }
export interface LinkAnalytics {
  clicks: number;
  unique_visitors: number;
  bot_visits: number;
  sources: AnalyticsDimension[];
  countries: AnalyticsDimension[];
  regions: AnalyticsDimension[];
  cities: AnalyticsDimension[];
  devices: AnalyticsDimension[];
  browsers: AnalyticsDimension[];
  operating_systems: AnalyticsDimension[];
  languages: AnalyticsDimension[];
  utm_sources: AnalyticsDimension[];
  destinations: AnalyticsDimension[];
  recent: Array<Record<string, unknown>>;
}

export interface LinkVersion {
  id: number;
  link_id: number;
  revision: number;
  snapshot: Record<string, unknown>;
  change_reason: string;
  created_by: number;
  created_at: string;
}

export interface LinkRiskPresentation {
  link_id: number;
  automatic_decision: string;
  effective_decision: string;
  score: number;
  provider: string;
  scanned_at?: string | null;
  next_scan_at?: string | null;
  pending: boolean;
  manual: boolean;
}

export interface LinkWriteInput {
  destination: string;
  title?: string;
  code?: string;
  domain?: string;
  status?: LinkStatus;
  redirect_status?: 301 | 302 | 307 | 308;
  password?: string;
  clear_password?: boolean;
  expires_at?: string | null;
  max_clicks?: number | null;
  one_time?: boolean;
  folder_id?: number | null;
  campaign_id?: number | null;
  tag_ids?: number[];
  utm?: UTMValues;
  routing_rules?: RoutingRule[];
  ab_destinations?: ABDestination[];
}

export interface LinkCreateInput extends LinkWriteInput {
  source: LinkDomainSource;
}

function queryString(values: LinkListFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function jsonDeleteInit(body: unknown): RequestInit {
  return {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function validateLinkRouting(input: Pick<LinkWriteInput, "routing_rules" | "ab_destinations" | "utm">): string[] {
  const errors: string[] = [];
  const url = (value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const rules = input.routing_rules ?? [];
  if (rules.length > 20) errors.push("路由规则不能超过 20 条");
  for (const rule of rules) {
    if (!(["device", "country", "language", "source"] as const).includes(rule.Dimension) || !rule.Value.trim() || !url(rule.Destination)) {
      errors.push("每条路由规则都需要有效维度、匹配值和 HTTP(S) 目标地址");
      break;
    }
  }

  const variants = input.ab_destinations ?? [];
  if (variants.length > 0) {
    if (variants.length < 2 || variants.length > 10) errors.push("A/B 测试需要 2 到 10 个目标版本");
    const ids = new Set<string>();
    let weight = 0;
    for (const variant of variants) {
      if (!variant.ID || ids.has(variant.ID) || variant.Weight < 1 || !url(variant.Destination)) {
        errors.push("A/B 版本需要唯一编号、正权重和 HTTP(S) 目标地址");
        break;
      }
      ids.add(variant.ID);
      weight += variant.Weight;
    }
    if (weight !== 100) errors.push("A/B 版本权重总和必须为 100");
  }

  const allowedUTM = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
  for (const [key, value] of Object.entries(input.utm ?? {})) {
    if (!allowedUTM.has(key) || value.length > 255) {
      errors.push("UTM 参数名称或长度无效");
      break;
    }
  }
  return errors;
}

export function createLinksClient(api: ApiTransport) {
  const workspacePath = (workspaceId: number) => `/api/workspaces/${workspaceId}`;
  const linkPath = (workspaceId: number, linkId: number) => `${workspacePath(workspaceId)}/links/${linkId}`;

  return {
    workspaces: () => api.get<{ data: WorkspaceSummary[] }>("/api/workspaces"),
    capabilities: (workspaceId: number) => api.get<LinkCapabilities>(`${workspacePath(workspaceId)}/links/capabilities`),
    list: (workspaceId: number, filters: LinkListFilters = {}) => api.get<LinkListResponse>(`${workspacePath(workspaceId)}/links/presentation${queryString(filters)}`),
    get: (workspaceId: number, linkId: number) => api.get<LinkRecord>(`${linkPath(workspaceId, linkId)}/presentation`),
    domains: (workspaceId: number) => api.get<{ data: LinkDomainOption[] }>(`${workspacePath(workspaceId)}/link-domains`),
    organization: (workspaceId: number) => api.get<OrganizationSnapshot>(`${workspacePath(workspaceId)}/organization`),
    risks: (workspaceId: number) => api.get<{ data: LinkRiskPresentation[] }>(`${workspacePath(workspaceId)}/link-risks`),
    create: (workspaceId: number, input: LinkCreateInput) => {
      const { source, ...payload } = input;
      const path = source === "official" ? `${workspacePath(workspaceId)}/links/official` : `${workspacePath(workspaceId)}/links`;
      return api.post<LinkRecord>(path, payload);
    },
    update: (workspaceId: number, linkId: number, link: LinkWriteInput, reason: string) => api.put<LinkRecord>(linkPath(workspaceId, linkId), { link, reason }),
    analytics: (workspaceId: number, linkId: number, from?: string, to?: string) => {
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      const suffix = query.size ? `?${query.toString()}` : "";
      return api.get<LinkAnalytics>(`${linkPath(workspaceId, linkId)}/analytics${suffix}`);
    },
    versions: (workspaceId: number, linkId: number) => api.get<{ data: LinkVersion[] }>(`${linkPath(workspaceId, linkId)}/versions`),
    restore: (workspaceId: number, linkId: number, revision: number, reason: string) => api.post<LinkRecord>(`${linkPath(workspaceId, linkId)}/versions/${revision}/restore`, { reason }),
    bulkStatus: (workspaceId: number, ids: number[], status: "active" | "paused") => api.patch<{ affected: number }>(`${workspacePath(workspaceId)}/links/bulk-status`, { ids, status }),
    bulkTags: (workspaceId: number, ids: number[], tagIds: number[]) => api.patch<{ affected: number }>(`${workspacePath(workspaceId)}/links/bulk-tags`, { ids, tag_ids: tagIds }),
    bulkMove: (workspaceId: number, ids: number[], folderId?: number | null, campaignId?: number | null) => api.patch<{ affected: number }>(`${workspacePath(workspaceId)}/links/bulk-move`, { ids, folder_id: folderId ?? null, campaign_id: campaignId ?? null }),
    bulkDelete: (workspaceId: number, ids: number[]) => api.request<{ affected: number }>(`${workspacePath(workspaceId)}/links/bulk`, jsonDeleteInit({ ids })),
    exportUrl: (workspaceId: number, filters: LinkListFilters = {}) => `${workspacePath(workspaceId)}/links/export.csv${queryString(filters)}`,
    qrUrl: (workspaceId: number, linkId: number, options: { format?: "png" | "svg" | "pdf"; size?: number; foreground?: string; background?: string; download?: boolean } = {}) => {
      const query = new URLSearchParams();
      if (options.format) query.set("format", options.format);
      if (options.size) query.set("size", String(options.size));
      if (options.foreground) query.set("foreground", options.foreground);
      if (options.background) query.set("background", options.background);
      if (options.download) query.set("download", "1");
      const suffix = query.size ? `?${query.toString()}` : "";
      return `${linkPath(workspaceId, linkId)}/qr${suffix}`;
    }
  };
}
