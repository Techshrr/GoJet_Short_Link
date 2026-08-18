import type { ApiTransport } from "./links";

export interface AnalyticsTrendPoint { date: string; clicks: number; }
export interface AnalyticsRecentItem { id?: number; code?: string; domain?: string; title?: string; clicks?: number; visitors?: number; [key: string]: unknown; }
export interface AnalyticsAnomaly { type?: string; message?: string; severity?: string; [key: string]: unknown; }

export interface WorkspaceAnalyticsOverview {
  today_clicks: number;
  month_clicks: number;
  unique_visitors: number;
  active_links: number;
  usage?: Record<string, unknown>;
  trend: AnalyticsTrendPoint[];
  recent: AnalyticsRecentItem[];
  anomalies: AnalyticsAnomaly[];
  generated_at?: string;
  source?: string;
}

export interface ResourceActivity {
  qr_visits: number;
  file_downloads: number;
  text_views: number;
  bio_views: number;
  partial_errors: string[];
}

type RawList = { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;

function rows(input: RawList): Array<Record<string, unknown>> {
  return Array.isArray(input) ? input : Array.isArray(input.data) ? input.data : [];
}

function sum(input: RawList, ...keys: string[]): number {
  return rows(input).reduce((total, item) => {
    for (const key of keys) {
      const value = item[key];
      if (typeof value === "number") return total + value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return total + Number(value);
    }
    return total;
  }, 0);
}

export function createAnalyticsClient(api: ApiTransport) {
  return {
    overview: (workspaceId: number) => api.get<WorkspaceAnalyticsOverview>(`/api/workspaces/${workspaceId}/overview`),
    resourceActivity: async (workspaceId: number): Promise<ResourceActivity> => {
      const endpoints = [
        ["qr", `/api/workspaces/${workspaceId}/qr-codes`],
        ["files", `/api/workspaces/${workspaceId}/fileshares`],
        ["text", `/api/workspaces/${workspaceId}/text-shares`],
        ["bio", `/api/workspaces/${workspaceId}/bio-pages`]
      ] as const;
      const results = await Promise.allSettled(endpoints.map(([, path]) => api.get<RawList>(path)));
      const partial_errors: string[] = [];
      const value = (index: number): RawList => {
        const result = results[index];
        if (result?.status === "fulfilled") return result.value;
        partial_errors.push(endpoints[index]?.[0] ?? `resource-${index}`);
        return [];
      };
      return {
        qr_visits: sum(value(0), "visits", "Visits"),
        file_downloads: sum(value(1), "downloads", "Downloads"),
        text_views: sum(value(2), "views", "Views"),
        bio_views: sum(value(3), "views", "Views"),
        partial_errors
      };
    }
  };
}
