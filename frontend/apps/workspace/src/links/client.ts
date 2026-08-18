import { api } from "@gojet/auth";
import { createLinksClient, type WorkspaceSummary } from "@gojet/api-client";

export const linksClient = createLinksClient(api);

export function normalizeWorkspaces(value: { data: WorkspaceSummary[] } | WorkspaceSummary[]): WorkspaceSummary[] {
  return Array.isArray(value) ? value : value.data;
}

export function requestedWorkspaceId(): number | undefined {
  const value = new URLSearchParams(window.location.search).get("workspace");
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function shortUrl(domain: string, code: string): string {
  const hostname = domain.trim();
  return hostname ? `https://${hostname}/${code}` : `/${code}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function errorMessage(error: unknown, fallback = "请求失败，请重试"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
