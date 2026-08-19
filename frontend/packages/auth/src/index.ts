import { createApiClient } from "@gojet/api-client";

export interface SessionIdentity { id: string | number; email: string; displayName: string; emailVerified?: boolean; }
export interface SessionSnapshot { authenticated: boolean; identity?: SessionIdentity; csrfToken?: string; }
let csrfToken: string | undefined;
let adminCsrfToken: string | undefined;

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const item = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}

function requestCsrf(path: string): string | undefined {
  if (path.startsWith("/api/admin/")) return adminCsrfToken ?? cookieValue("gojet_admin_csrf");
  return csrfToken ?? cookieValue("gojet_csrf");
}

export const api = createApiClient({ getCsrfToken: (path) => requestCsrf(path) });
export async function refreshSession(): Promise<SessionSnapshot> {
  const session = await api.get<SessionSnapshot>("/api/session");
  csrfToken = session.csrfToken;
  return session;
}
export function currentCsrfToken(): string | undefined { return csrfToken ?? cookieValue("gojet_csrf"); }
export function currentAdminCsrfToken(): string | undefined { return adminCsrfToken ?? cookieValue("gojet_admin_csrf"); }
export function setAdminCsrfToken(value?: string): void { adminCsrfToken = value; }
export function clearClientSessionState(): void { csrfToken = undefined; }
export function clearAdminClientSessionState(): void { adminCsrfToken = undefined; }
