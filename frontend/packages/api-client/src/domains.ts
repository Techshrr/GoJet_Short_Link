import type { ApiTransport, LinkCapabilities, LinkDomainOption } from "./links";

export type DomainStatus = "pending" | "active" | "error" | string;

export interface DomainRecord {
  id: number;
  workspace_id: number;
  hostname: string;
  status: DomainStatus;
  https_status: DomainStatus;
  last_error?: string | null;
  last_checked_at?: string | null;
  created_at?: string | null;
}

export interface DomainDnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface DomainMutationResult {
  domain: DomainRecord;
  dns_record: DomainDnsRecord;
}

interface RawDomain {
  ID?: number;
  id?: number;
  WorkspaceID?: number;
  workspace_id?: number;
  Hostname?: string;
  hostname?: string;
  Status?: DomainStatus;
  status?: DomainStatus;
  HTTPSStatus?: DomainStatus;
  https_status?: DomainStatus;
  LastError?: string | null;
  last_error?: string | null;
  LastCheckedAt?: string | null;
  last_checked_at?: string | null;
  CreatedAt?: string | null;
  created_at?: string | null;
}

function normalizeDomain(item: RawDomain): DomainRecord {
  return {
    id: Number(item.id ?? item.ID ?? 0),
    workspace_id: Number(item.workspace_id ?? item.WorkspaceID ?? 0),
    hostname: String(item.hostname ?? item.Hostname ?? ""),
    status: item.status ?? item.Status ?? "pending",
    https_status: item.https_status ?? item.HTTPSStatus ?? "pending",
    last_error: item.last_error ?? item.LastError ?? null,
    last_checked_at: item.last_checked_at ?? item.LastCheckedAt ?? null,
    created_at: item.created_at ?? item.CreatedAt ?? null
  };
}

export function createDomainsClient(api: ApiTransport) {
  return {
    list: async (workspaceId: number) => {
      const response = await api.get<{ data: RawDomain[] }>(`/api/workspaces/${workspaceId}/domains`);
      return { data: response.data.map(normalizeDomain) };
    },
    available: (workspaceId: number) => api.get<{ data: LinkDomainOption[] }>(`/api/workspaces/${workspaceId}/link-domains`),
    capabilities: (workspaceId: number) => api.get<LinkCapabilities>(`/api/workspaces/${workspaceId}/links/capabilities`),
    create: async (workspaceId: number, hostname: string) => {
      const response = await api.post<{ domain: RawDomain; dns_record: DomainDnsRecord }>(`/api/workspaces/${workspaceId}/domains`, { hostname });
      return { domain: normalizeDomain(response.domain), dns_record: response.dns_record } satisfies DomainMutationResult;
    },
    rotate: async (workspaceId: number, domainId: number) => {
      const response = await api.post<{ domain: RawDomain; dns_record: DomainDnsRecord }>(`/api/workspaces/${workspaceId}/domains/${domainId}/verify?rotate=1`, {});
      return { domain: normalizeDomain(response.domain), dns_record: response.dns_record } satisfies DomainMutationResult;
    },
    verify: (workspaceId: number, domainId: number) => api.post<{ checked: boolean }>(`/api/workspaces/${workspaceId}/domains/${domainId}/verify`, {})
  };
}
