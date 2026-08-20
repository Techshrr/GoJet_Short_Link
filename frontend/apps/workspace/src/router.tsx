import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter, useRouterState } from "@tanstack/react-router";
import { useLocale } from "@gojet/ui";
import { WorkspaceShell } from "./WorkspaceShell";

const WorkspaceFoundation = lazy(() => import("./routes/WorkspaceFoundation"));
const LinksPage = lazy(() => import("./routes/LinksPageV503"));
const LinkDetailPage = lazy(() => import("./routes/LinkDetailPageV503"));
const DomainsPage = lazy(() => import("./routes/DomainsPage"));
const AnalyticsPage = lazy(() => import("./routes/AnalyticsPage"));
const QRPage = lazy(() => import("./routes/QRPage"));
const FilesPage = lazy(() => import("./routes/FilesPage"));
const TextPage = lazy(() => import("./routes/TextPage"));
const BioPage = lazy(() => import("./routes/BioPage"));
const MembersPage = lazy(() => import("./routes/MembersPage"));
const OrganizationPage = lazy(() => import("./routes/OrganizationPage"));
const BillingPage = lazy(() => import("./routes/BillingPage"));
const SupportPage = lazy(() => import("./routes/SupportPage"));
const SettingsPage = lazy(() => import("./routes/SettingsPage"));

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { locale } = useLocale();
  return <WorkspaceShell pathname={pathname}><Suspense fallback={<main className="shell-page-proof"><span>GoJet</span><p>{locale === "zh-CN" ? "正在加载…" : "Loading…"}</p></main>}><Outlet /></Suspense></WorkspaceShell>;
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WorkspaceFoundation });
const linksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/links", component: LinksPage });
const linkDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/links/$linkId", component: LinkDetailPage });
const domainsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/domains", component: DomainsPage });
const analyticsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/analytics", component: AnalyticsPage });
const qrRoute = createRoute({ getParentRoute: () => rootRoute, path: "/qr", component: QRPage });
const filesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/files", component: FilesPage });
const textRoute = createRoute({ getParentRoute: () => rootRoute, path: "/text", component: TextPage });
const bioRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bio", component: BioPage });
const campaignsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/campaigns", component: OrganizationPage });
const tagsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tags", component: OrganizationPage });
const membersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/members", component: MembersPage });
const billingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/billing", component: BillingPage });
const supportRoute = createRoute({ getParentRoute: () => rootRoute, path: "/support", component: SupportPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
const securityRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings/security", component: SettingsPage });
const sessionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings/sessions", component: SettingsPage });
const connectedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings/connected-accounts", component: SettingsPage });
const routeTree = rootRoute.addChildren([indexRoute, linksRoute, linkDetailRoute, domainsRoute, analyticsRoute, qrRoute, filesRoute, textRoute, bioRoute, campaignsRoute, tagsRoute, membersRoute, billingRoute, supportRoute, settingsRoute, securityRoute, sessionsRoute, connectedRoute]);
export const router = createRouter({ routeTree, basepath: "/app" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
