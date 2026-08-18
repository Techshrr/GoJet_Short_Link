export type CsrfTokenProvider = () => string | undefined | Promise<string | undefined>;

export interface ApiClientOptions {
  baseUrl?: string;
  getCsrfToken?: CsrfTokenProvider;
  transport?: typeof globalThis.fetch;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  error?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(status: number, payload: ApiErrorPayload = {}) {
    super(payload.message ?? payload.error ?? `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function decodeBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  return text || undefined;
}

function withJsonBody(method: string, body: unknown, init?: RequestInit): RequestInit {
  const next: RequestInit = { ...init, method };
  if (body !== undefined) next.body = JSON.stringify(body);
  return next;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const transport = options.transport ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "";

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (init.body !== undefined && init.body !== null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (!SAFE_METHODS.has(method)) {
      const csrfToken = await options.getCsrfToken?.();
      if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    }

    const response = await transport(`${baseUrl}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include",
      cache: "no-store"
    });

    const body = await decodeBody(response);
    if (!response.ok) {
      const payload = body && typeof body === "object" ? (body as ApiErrorPayload) : { message: String(body ?? "") };
      throw new ApiError(response.status, payload);
    }

    return body as T;
  }

  return {
    request,
    get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, withJsonBody("POST", body, init)),
    put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, withJsonBody("PUT", body, init)),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>(path, withJsonBody("PATCH", body, init)),
    delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "DELETE" })
  };
}

// V5 invariant: authentication credentials are cookie/session based.
// This package deliberately exposes no browser Web Storage token persistence API.
export * from "./links";
