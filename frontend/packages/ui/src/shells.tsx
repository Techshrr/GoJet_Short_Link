import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "@gojet/icons";
import { Bell, CircleHelp, Plus, Search } from "@gojet/icons";
import { IconButton } from "./index";
import { Avatar } from "./patterns";
import { MobileDrawer } from "./overlays";

export interface WebsiteNavItem { label: string; href: string; }
export function WebsiteShell({ children, nav, activeHref = "/" }: { children: ReactNode; nav: WebsiteNavItem[]; activeHref?: string }) {
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const update = () => setSticky(window.scrollY >= 80);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <div className="gj-website-shell"><header className="gj-website-header" data-sticky={sticky || undefined}><div className="gj-website-header-inner"><a className="gj-brand-wordmark" href="/" aria-label="GoJet home">GoJet<span aria-hidden="true">.</span></a><nav className="gj-website-nav" aria-label="Primary navigation">{nav.map((item) => <a key={item.href} href={item.href} aria-current={activeHref === item.href ? "page" : undefined}>{item.label}</a>)}</nav><div className="gj-website-actions"><a className="gj-sign-in" href="/login">Sign in</a><a className="gj-cta-link" href="/register">Get started</a><div className="gj-website-mobile-menu"><MobileDrawer triggerLabel="Menu" title="GoJet" description="Navigation"><nav className="gj-mobile-nav" aria-label="Mobile navigation">{nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href="/login">Sign in</a></nav></MobileDrawer></div></div></div></header><div className="gj-website-content">{children}</div></div>;
}

export function AuthShell({ children, visualTitle = "Create. Control. Understand. Operate.", visualBody = "One GoJet workspace for links, QR, files, text and bio." }: { children: ReactNode; visualTitle?: string; visualBody?: string }) {
  return <main className="gj-auth-shell"><section className="gj-auth-visual" aria-label="GoJet"><a className="gj-brand-wordmark" href="/">GoJet<span aria-hidden="true">.</span></a><div className="gj-auth-visual-copy"><span className="gj-auth-kicker">GOJET WORKSPACE</span><h1>{visualTitle}</h1><p>{visualBody}</p><div className="gj-auth-orbit" aria-hidden="true"><span /><span /><span /></div></div></section><section className="gj-auth-panel"><div className="gj-auth-mobile-brand"><a className="gj-brand-wordmark" href="/">GoJet<span aria-hidden="true">.</span></a></div><div className="gj-auth-form-frame">{children}</div></section></main>;
}

export interface ShellNavItem { label: string; href: string; icon?: LucideIcon; }
export interface ShellNavGroup { label?: string; items: ShellNavItem[]; }
function ShellNavigation({ groups, activeHref }: { groups: ShellNavGroup[]; activeHref: string }) {
  return <nav className="gj-product-nav" aria-label="Product navigation">{groups.map((group, groupIndex) => <div className="gj-product-nav-group" key={`${group.label ?? "root"}-${groupIndex}`}>{group.label ? <div className="gj-product-nav-label">{group.label}</div> : null}{group.items.map((item) => { const Icon = item.icon; const active = activeHref === item.href || (item.href !== "/app" && item.href !== "/admin" && activeHref.startsWith(`${item.href}/`)); return <a key={item.href} className="gj-product-nav-item" data-active={active || undefined} aria-current={active ? "page" : undefined} href={item.href}>{Icon ? <Icon size={18} strokeWidth={1.75} aria-hidden="true" /> : null}<span>{item.label}</span></a>; })}</div>)}</nav>;
}

export interface ProductShellProps { variant: "workspace" | "admin"; children: ReactNode; groups: ShellNavGroup[]; activeHref: string; context: ReactNode; workspaceName?: string; userName?: string; supportHref?: string; createHref?: string; headerExtra?: ReactNode; }
export function ProductShell({ variant, children, groups, activeHref, context, workspaceName = "Personal Workspace", userName = "Ethan H", supportHref = "/app/support", createHref, headerExtra }: ProductShellProps) {
  const mobileContent = <div className="gj-mobile-shell-content">{variant === "workspace" ? <div className="gj-mobile-shell-workspace">{workspaceName}</div> : <div className="gj-admin-scope">PLATFORM CONTROL</div>}{createHref ? <a className="gj-shell-create" href={createHref}><Plus size={16} />Create</a> : null}<ShellNavigation groups={groups} activeHref={activeHref} /></div>;
  return <div className="gj-product-shell" data-shell={variant}><aside className="gj-product-sidebar"><a className="gj-product-brand" href={variant === "workspace" ? "/app" : "/admin"}>GoJet<span>.</span>{variant === "admin" ? <small>Admin</small> : null}</a>{variant === "workspace" ? <button className="gj-workspace-switcher" type="button"><span className="gj-workspace-dot" /><span>{workspaceName}</span><span aria-hidden="true">⌄</span></button> : <div className="gj-admin-scope">PLATFORM CONTROL</div>}{createHref ? <a className="gj-shell-create" href={createHref}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Create</a> : null}<ShellNavigation groups={groups} activeHref={activeHref} /><div className="gj-product-sidebar-bottom">{supportHref ? <a href={supportHref} className="gj-sidebar-support"><CircleHelp size={18} strokeWidth={1.75} />Support</a> : null}<a href={variant === "workspace" ? "/app/settings" : "/admin/administrators"} className="gj-sidebar-user"><Avatar name={userName} /><span><strong>{userName}</strong><small>{variant === "admin" ? "Administrator" : workspaceName}</small></span></a></div></aside><div className="gj-product-main"><header className="gj-product-header"><div className="gj-product-mobile-trigger"><MobileDrawer triggerLabel="Menu" title={variant === "workspace" ? "Workspace navigation" : "Admin navigation"}>{mobileContent}</MobileDrawer></div><div className="gj-product-context">{context}</div><div className="gj-product-header-actions">{headerExtra}<button type="button" className="gj-command-trigger"><Search size={16} strokeWidth={1.75} /><span>Search</span><kbd>⌘K</kbd></button><IconButton label="Help"><CircleHelp size={18} strokeWidth={1.75} /></IconButton><IconButton label="Notifications"><Bell size={18} strokeWidth={1.75} /></IconButton><Avatar name={userName} /></div></header><div className="gj-product-content">{children}</div></div></div>;
}
