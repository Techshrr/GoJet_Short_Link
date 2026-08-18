import { createApiClient } from "@gojet/api-client";

export interface SessionIdentity { id: string | number; email: string; displayName: string; emailVerified?: boolean; }
export interface SessionSnapshot { authenticated: boolean; identity?: SessionIdentity; csrfToken?: string; }
let csrfToken: string | undefined;
function cookieCsrf(): string | undefined { if (typeof document === "undefined") return undefined; const item=document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("gojet_csrf=")); return item ? decodeURIComponent(item.slice("gojet_csrf=".length)) : undefined; }
export const api=createApiClient({getCsrfToken:()=>csrfToken??cookieCsrf()});
export async function refreshSession():Promise<SessionSnapshot>{const session=await api.get<SessionSnapshot>("/api/session");csrfToken=session.csrfToken;return session;}
export function currentCsrfToken():string|undefined{return csrfToken??cookieCsrf()}
export function clearClientSessionState():void{csrfToken=undefined}
