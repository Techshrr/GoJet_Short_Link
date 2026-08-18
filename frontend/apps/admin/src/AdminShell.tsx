import type { ReactNode } from "react";
import { ProductShell, type ShellNavGroup } from "@gojet/ui/shells";

const adminGroups: ShellNavGroup[] = [
  { items: [{ label: "Overview", href: "/admin" }] },
  { label: "CUSTOMERS", items: [{ label: "Users", href: "/admin/users" }, { label: "Workspaces", href: "/admin/workspaces" }, { label: "Memberships", href: "/admin/memberships" }] },
  { label: "RESOURCES", items: [{ label: "Links", href: "/admin/links" }, { label: "Domains", href: "/admin/domains" }, { label: "QR Codes", href: "/admin/qr" }, { label: "Files", href: "/admin/files" }, { label: "Text", href: "/admin/text" }, { label: "Bio Pages", href: "/admin/bio" }] },
  { label: "TRUST & SAFETY", items: [{ label: "Destination Risk", href: "/admin/destination-risk" }, { label: "File Security", href: "/admin/file-security" }, { label: "Abuse Reports", href: "/admin/abuse" }, { label: "Security Events", href: "/admin/security-events" }] },
  { label: "OPERATIONS", items: [{ label: "Tickets", href: "/admin/tickets" }, { label: "Announcements", href: "/admin/announcements" }, { label: "Mail", href: "/admin/mail" }, { label: "Jobs", href: "/admin/jobs" }, { label: "Services", href: "/admin/services" }] },
  { label: "COMMERCE", items: [{ label: "Plans", href: "/admin/plans" }, { label: "Billing", href: "/admin/billing" }, { label: "Payments", href: "/admin/payments" }, { label: "FX", href: "/admin/fx" }] },
  { label: "ACCESS", items: [{ label: "Administrators", href: "/admin/administrators" }, { label: "Roles", href: "/admin/roles" }, { label: "Permissions", href: "/admin/permissions" }, { label: "Audit", href: "/admin/audit" }] },
  { label: "PLATFORM", items: [{ label: "General", href: "/admin/general" }, { label: "Official Domains", href: "/admin/official-domains" }, { label: "OAuth", href: "/admin/oauth" }, { label: "Turnstile", href: "/admin/turnstile" }, { label: "Mail Settings", href: "/admin/mail-settings" }, { label: "Templates", href: "/admin/templates" }, { label: "Storage", href: "/admin/storage" }, { label: "Integrations", href: "/admin/integrations" }] },
];

function normalizePath(pathname: string) { return pathname.startsWith("/admin") ? pathname : `/admin${pathname === "/" ? "" : pathname}`; }
function contextFor(pathname: string) { const path = normalizePath(pathname); if (path === "/admin") return "Overview"; return adminGroups.flatMap((group) => group.items).find((item) => path === item.href || path.startsWith(`${item.href}/`))?.label ?? "Admin"; }

export function AdminShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const activeHref = normalizePath(pathname);
  return <ProductShell variant="admin" groups={adminGroups} activeHref={activeHref} context={<><span className="shell-context-muted">Admin</span><span aria-hidden="true"> / </span><strong>{contextFor(pathname)}</strong></>} supportHref="/admin/tickets">{children}</ProductShell>;
}
