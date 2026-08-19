import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ProductShell, type ShellNavGroup } from "@gojet/ui/shells";
import { useLocale } from "@gojet/ui/locale";
import { AdminLoginPage } from "./AdminLoginPage";

type AdminIdentity = { id: number; email: string; display_name: string; role: string; permissions: string[] };

function groups(zh: boolean): ShellNavGroup[] { return [
  { items: [{ label: zh ? "概览" : "Overview", href: "/admin" }] },
  { label: zh ? "用户与工作区" : "ACCOUNTS", items: [{ label: zh ? "用户" : "Users", href: "/admin/users" }, { label: zh ? "工作区" : "Workspaces", href: "/admin/workspaces" }, { label: zh ? "成员关系" : "Memberships", href: "/admin/memberships" }] },
  { label: zh ? "内容资源" : "CONTENT", items: [{ label: zh ? "短链接" : "Links", href: "/admin/links" }, { label: zh ? "域名" : "Domains", href: "/admin/domains" }, { label: zh ? "二维码" : "QR Codes", href: "/admin/qr" }, { label: zh ? "文件" : "Files", href: "/admin/files" }, { label: zh ? "文本分享" : "Text", href: "/admin/text" }, { label: zh ? "个人主页" : "Bio Pages", href: "/admin/bio" }] },
  { label: zh ? "安全与风控" : "PROTECTION", items: [{ label: zh ? "目标地址检测" : "Destination checks", href: "/admin/destination-risk" }, { label: zh ? "文件安全" : "File protection", href: "/admin/file-security" }, { label: zh ? "滥用举报" : "Abuse reports", href: "/admin/abuse" }, { label: zh ? "安全事件" : "Security events", href: "/admin/security-events" }] },
  { label: zh ? "服务管理" : "SERVICE", items: [{ label: zh ? "工单" : "Support tickets", href: "/admin/tickets" }, { label: zh ? "公告" : "Announcements", href: "/admin/announcements" }, { label: zh ? "邮件记录" : "Mail", href: "/admin/mail" }, { label: zh ? "后台任务" : "Background tasks", href: "/admin/jobs" }, { label: zh ? "服务状态" : "Service status", href: "/admin/services" }] },
  { label: zh ? "套餐与结算" : "BILLING", items: [{ label: zh ? "套餐" : "Plans", href: "/admin/plans" }, { label: zh ? "账单" : "Billing", href: "/admin/billing" }, { label: zh ? "支付记录" : "Payments", href: "/admin/payments" }, { label: zh ? "汇率" : "Exchange rates", href: "/admin/fx" }] },
  { label: zh ? "后台权限" : "ADMIN ACCESS", items: [{ label: zh ? "管理员" : "Administrators", href: "/admin/administrators" }, { label: zh ? "管理员角色" : "Administrator roles", href: "/admin/roles" }, { label: zh ? "管理员权限" : "Administrator permissions", href: "/admin/permissions" }, { label: zh ? "审计日志" : "Audit log", href: "/admin/audit" }] },
  { label: zh ? "系统设置" : "SYSTEM SETTINGS", items: [{ label: zh ? "基本设置" : "General settings", href: "/admin/general" }, { label: zh ? "官方域名" : "Official domains", href: "/admin/official-domains" }, { label: "OAuth", href: "/admin/oauth" }, { label: "Turnstile", href: "/admin/turnstile" }, { label: zh ? "邮件设置" : "Mail settings", href: "/admin/mail-settings" }, { label: zh ? "消息模板" : "Message templates", href: "/admin/templates" }, { label: zh ? "文件存储" : "File storage", href: "/admin/storage" }, { label: zh ? "第三方集成" : "Integrations", href: "/admin/integrations" }] },
]; }

function normalizePath(pathname: string) { return pathname.startsWith("/admin") ? pathname : `/admin${pathname === "/" ? "" : pathname}`; }

export function AdminShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { locale, text } = useLocale();
  const nav = groups(locale === "zh-CN");
  const session = useQuery({ queryKey: ["admin-me"], queryFn: () => api.get<AdminIdentity>("/api/admin/auth/me"), retry: false, staleTime: 30_000 });
  if (session.isPending) return <main className="shell-page-proof"><span>GoJet Admin</span><p>{text("Checking administrator session…", "正在检查管理员登录状态…")}</p></main>;
  if (session.isError) return <AdminLoginPage onSuccess={() => { void session.refetch(); }} />;
  const activeHref = normalizePath(pathname);
  const current = activeHref === "/admin" ? (locale === "zh-CN" ? "概览" : "Overview") : nav.flatMap((group) => group.items).find((item) => activeHref === item.href || activeHref.startsWith(`${item.href}/`))?.label ?? text("Administration", "管理后台");
  return <ProductShell variant="admin" groups={nav} activeHref={activeHref} userName={session.data.display_name || session.data.email} context={<><span className="shell-context-muted">{text("Administration", "管理后台")}</span><span aria-hidden="true"> / </span><strong>{current}</strong></>} supportHref="/admin/tickets">{children}</ProductShell>;
}
