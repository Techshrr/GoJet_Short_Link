import { api } from "@gojet/auth";
import { ApiError, createLinksClient, type WorkspaceSummary } from "@gojet/api-client";
import { localizedError, type GoJetLocale } from "@gojet/ui/locale";

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

function currentLocale(): GoJetLocale {
  return typeof document !== "undefined" && document.documentElement.lang === "zh-CN" ? "zh-CN" : "en";
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(currentLocale() === "zh-CN" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function errorMessage(error: unknown, fallback?: string): string {
  const locale = currentLocale();
  if (error instanceof ApiError) return localizedError(error.message, locale, error.status);
  if (error instanceof Error && error.message) return localizedError(error.message, locale);
  return fallback ? localizedError(fallback, locale) : localizedError(undefined, locale);
}
