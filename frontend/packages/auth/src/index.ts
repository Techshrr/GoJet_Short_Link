import { createApiClient } from "@gojet/api-client";

export interface SessionIdentity {
  id: string;
  email: string;
  displayName: string;
}

export interface SessionSnapshot {
  authenticated: boolean;
  identity?: SessionIdentity;
  csrfToken?: string;
}

let csrfToken: string | undefined;

export const api = createApiClient({
  getCsrfToken: () => csrfToken
});

export async function refreshSession(): Promise<SessionSnapshot> {
  const session = await api.get<SessionSnapshot>("/api/session");
  csrfToken = session.csrfToken;
  return session;
}

export function clearClientSessionState(): void {
  csrfToken = undefined;
}
