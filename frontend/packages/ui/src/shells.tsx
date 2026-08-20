import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "@gojet/icons";
import { CircleHelp, Plus } from "@gojet/icons";
import { Avatar } from "./patterns";
import { MobileDrawer } from "./overlays";
import { LocaleSwitch, LocalizedSurface, useLocale } from "./locale";

export interface WebsiteNavItem { label: string; href: string; }
export function WebsiteShell({ children, nav, activeHref = "/" }: { children: ReactNode; nav: WebsiteNavItem[]; activeHref?: string }) {
  const [sticky, setSticky] = useState(false);
  const { text } = useLocale();
  useEffect(() => {
    const update = () => setSticky(window.scrollY >= 80);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <LocalizedSurface><div className="gj-website-shell"><header className="gj-website-header" data-sticky={sticky || undefined}><div className="gj-website-header-inner"><a className="gj-brand-wordmark" href="/" aria-label={text("GoJet home", "GoJet 首页")}>GoJet<span aria-hidden="true">.</span></a><nav className="gj-website-nav" aria-label={text("Primary navigation", "主导航")}>{nav.map((item) => <a key={item.href} href={item.href} aria-current={activeHref === item.href ? "page" : undefined}>{item.label}</a>)}</nav><div className="gj-website-actions"><LocaleSwitch /><a className="gj-sign-in" href="/login">{text("Sign in", "登录")}</a><a className="gj-cta-link" href="/register">{text("Get started", "开始使用")}</a><div className="gj-website-mobile-menu"><MobileDrawer triggerLabel={text("Menu", "菜单")} title="GoJet" description={text("Navigation", "导航")}><nav className="gj-mobile-nav" aria-label={text("Mobile navigation", "移动端导航")}>{nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href="/login">{text("Sign in", "登录")}</a></nav></MobileDrawer></div></div></div></header><div className="gj-website-content">{children}</div></div></LocalizedSurface>;
}

export function AuthShell({ children, visualTitle, visualBody }: { children: ReactNode; visualTitle?: string; visualBody?: string }) {
  const { text } = useLocale();
  const title = visualTitle ?? text("Manage every link, QR code, file and public page from one workspace.", "在一个工作区中管理短链接、二维码、文件和公开页面。");
  const body = visualBody ?? text("Create and organize what you publish, connect your own domains, control access and routing, then review traffic and activity without switching between separate tools.", "集中创建和整理需要发布的内容，绑定自己的域名，设置访问与跳转规则，并在同一个工作区查看访问数据和操作记录，无需在多个工具之间来回切换。");
  return <LocalizedSurface><main className="gj-auth-shell"><section className="gj-auth-visual" aria-label="GoJet"><a className="gj-brand-wordmark" href="/">GoJet<span aria-hidden="true">.</span></a><div className="gj-auth-visual-copy"><span className="gj-auth-kicker">GOJET</span><h1>{title}</h1><p>{body}</p><div className="gj-auth-orbit" aria-hidden="true"><span /><span /><span /></div></div></section><section className="gj-auth-panel"><div className="gj-auth-mobile-brand"><a className="gj-brand-wordmark" href="/">GoJet<span aria-hidden="true">.</span></a><LocaleSwitch /></div><div className="gj-auth-form-frame">{children}</div></section></main></LocalizedSurface>;
}

export interface ShellNavItem { label: string; href: string; icon?: LucideIcon; }
export interface ShellNavGroup { label?: string; items: ShellNavItem[]; }
function ShellNavigation({ groups, activeHref }: { groups: ShellNavGroup[]; activeHref: string }) {
  const { text } = useLocale();
  return <nav className="gj-product-nav" aria-label={text("Product navigation", "功能导航")}>{groups.map((group, groupIndex) => <div className="gj-product-nav-group" key={`${group.label ?? "root"}-${groupIndex}`}>{group.label ? <div className="gj-product-nav-label">{group.label}</div> : null}{group.items.map((item) => { const Icon = item.icon; const active = activeHref === item.href || (item.href !== "/app" && item.href !== "/admin" && activeHref.startsWith(`${item.href}/`)); return <a key={item.href} className="gj-product-nav-item" data-active={active || undefined} aria-current={active ? "page" : undefined} href={item.href}>{Icon ? <Icon size={18} strokeWidth={1.75} aria-hidden="true" /> : null}<span>{item.label}</span></a>; })}</div>)}</nav>;
}

export interface ProductShellProps { variant: "workspace" | "admin"; children: ReactNode; groups: ShellNavGroup[]; activeHref: string; context: ReactNode; workspaceName?: string; userName?: string; supportHref?: string; createHref?: string; headerExtra?: ReactNode; }
export function ProductShell({ variant, children, groups, activeHref, context, workspaceName = "Workspace", userName = "Account", supportHref = "/app/support", createHref, headerExtra }: ProductShellProps) {
  const { text } = useLocale();
  const accountHref = variant === "workspace" ? "/app/settings" : "/admin/administrators";
  const mobileContent = <div className="gj-mobile-shell-content">{variant === "workspace" ? <div className="gj-mobile-shell-workspace">{workspaceName}</div> : <div className="gj-admin-scope">{text("ADMINISTRATION", "管理后台")}</div>}{createHref ? <a className="gj-shell-create" href={createHref}><Plus size={16} />{text("Create", "新建")}</a> : null}<ShellNavigation groups={groups} activeHref={activeHref} /></div>;
  return <LocalizedSurface><div className="gj-product-shell" data-shell={variant}><aside className="gj-product-sidebar"><a className="gj-product-brand" href={variant === "workspace" ? "/app" : "/admin"}>GoJet<span>.</span>{variant === "admin" ? <small>Admin</small> : null}</a>{variant === "workspace" ? <button className="gj-workspace-switcher" type="button"><span className="gj-workspace-dot" /><span>{workspaceName}</span><span aria-hidden="true">⌄</span></button> : <div className="gj-admin-scope">{text("ADMINISTRATION", "管理后台")}</div>}{createHref ? <a className="gj-shell-create" href={createHref}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{text("Create", "新建")}</a> : null}<ShellNavigation groups={groups} activeHref={activeHref} /><div className="gj-product-sidebar-bottom">{supportHref ? <a href={supportHref} className="gj-sidebar-support"><CircleHelp size={18} strokeWidth={1.75} />{text("Support", "帮助与工单")}</a> : null}<a href={accountHref} className="gj-sidebar-user"><Avatar name={userName} /><span><strong>{userName}</strong><small>{variant === "admin" ? text("Administrator", "管理员") : workspaceName}</small></span></a></div></aside><div className="gj-product-main"><header className="gj-product-header"><div className="gj-product-mobile-trigger"><MobileDrawer triggerLabel={text("Menu", "菜单")} title={variant === "workspace" ? text("Workspace navigation", "工作区导航") : text("Admin navigation", "后台导航")}>{mobileContent}</MobileDrawer></div><div className="gj-product-context">{context}</div><div className="gj-product-header-actions"><LocaleSwitch />{headerExtra}{supportHref ? <a className="gj-header-icon-link" href={supportHref} aria-label={text("Help and support", "帮助与工单")} title={text("Help and support", "帮助与工单")}><CircleHelp size={18} strokeWidth={1.75} /></a> : null}<a className="gj-header-account-link" href={accountHref} aria-label={text("Account settings", "账户设置")} title={text("Account settings", "账户设置")}><Avatar name={userName} /></a></div></header><div className="gj-product-content">{children}</div></div></div></LocalizedSurface>;
}
