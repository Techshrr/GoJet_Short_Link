import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ExternalLink, File, Folder, Globe2, Link2, QrCode, Settings, SlidersHorizontal, User, Users } from "@gojet/icons";
import { api, refreshSession } from "@gojet/auth";
import { ProductShell, type ShellNavGroup } from "@gojet/ui/shells";
import { useLocale } from "@gojet/ui/locale";

function groups(zh: boolean): ShellNavGroup[] { return [
  { items: [{ label: zh ? "概览" : "Overview", href: "/app", icon: BarChart3 }] },
  { label: zh ? "内容" : "CONTENT", items: [{ label: zh ? "短链接" : "Links", href: "/app/links", icon: Link2 }, { label: zh ? "二维码" : "QR Codes", href: "/app/qr", icon: QrCode }, { label: zh ? "文件" : "Files", href: "/app/files", icon: File }, { label: zh ? "文本分享" : "Text", href: "/app/text", icon: File }, { label: zh ? "个人主页" : "Bio Pages", href: "/app/bio", icon: User }] },
  { label: zh ? "数据分析" : "REPORTS", items: [{ label: zh ? "访问分析" : "Analytics", href: "/app/analytics", icon: BarChart3 }] },
  { label: zh ? "组织管理" : "ORGANIZE", items: [{ label: zh ? "域名" : "Domains", href: "/app/domains", icon: Globe2 }, { label: zh ? "推广活动" : "Campaigns", href: "/app/campaigns", icon: Folder }, { label: zh ? "标签" : "Tags", href: "/app/tags", icon: SlidersHorizontal }] },
  { label: zh ? "工作区" : "WORKSPACE", items: [{ label: zh ? "成员" : "Members", href: "/app/members", icon: Users }, { label: zh ? "账单与套餐" : "Billing", href: "/app/billing", icon: BarChart3 }, { label: zh ? "设置" : "Settings", href: "/app/settings", icon: Settings }, { label: zh ? "帮助与工单" : "Support", href: "/app/support", icon: ExternalLink }] },
]; }

function normalizePath(pathname: string) { return pathname.startsWith("/app") ? pathname : `/app${pathname === "/" ? "" : pathname}`; }

export function WorkspaceShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { locale, text } = useLocale();
  const nav = groups(locale === "zh-CN");
  const session = useQuery({ queryKey: ["user-session"], queryFn: refreshSession, retry: false, staleTime: 30_000 });
  const workspaces = useQuery({ queryKey: ["workspace-list"], queryFn: () => api.get<{ data: { id: number; name: string }[] }>("/api/workspaces"), retry: false, enabled: session.data?.authenticated === true, staleTime: 30_000 });
  if (session.isPending) return <main className="shell-page-proof"><span>GoJet</span><p>{text("Checking your session…", "正在检查登录状态…")}</p></main>;
  if (!session.data?.authenticated) { if (typeof window !== "undefined") window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return <main className="shell-page-proof"><p>{text("Taking you to sign in…", "正在前往登录页面…")}</p></main>; }
  const activeHref = normalizePath(pathname);
  const current = activeHref === "/app" ? (locale === "zh-CN" ? "概览" : "Overview") : nav.flatMap((group) => group.items).find((entry) => activeHref === entry.href || activeHref.startsWith(`${entry.href}/`))?.label ?? text("Workspace", "工作区");
  const workspaceName = workspaces.data?.data?.[0]?.name || text("My workspace", "我的工作区");
  const userName = session.data.identity?.displayName || session.data.identity?.email || text("Account", "账号");
  return <ProductShell variant="workspace" groups={nav} activeHref={activeHref} workspaceName={workspaceName} userName={userName} context={<><span className="shell-context-muted">{text("Workspace", "工作区")}</span><span aria-hidden="true"> / </span><strong>{current}</strong></>} createHref="/app/links">{children}</ProductShell>;
}
