import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter, useRouterState } from "@tanstack/react-router";
import { WorkspaceShell } from "./WorkspaceShell";

const WorkspaceFoundation = lazy(() => import("./routes/WorkspaceFoundation"));
const LinksPage = lazy(() => import("./routes/LinksPage"));
const LinkDetailPage = lazy(() => import("./routes/LinkDetailPage"));
const DomainsPage = lazy(() => import("./routes/DomainsPage"));
const AnalyticsPage = lazy(() => import("./routes/AnalyticsPage"));

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <WorkspaceShell pathname={pathname}><Suspense fallback={<main className="shell-page-proof"><span>GoJet</span><p>正在加载…</p></main>}><Outlet /></Suspense></WorkspaceShell>;
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WorkspaceFoundation });
const linksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/links", component: LinksPage });
const linkDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/links/$linkId", component: LinkDetailPage });
const domainsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/domains", component: DomainsPage });
const analyticsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/analytics", component: AnalyticsPage });
const routeTree = rootRoute.addChildren([indexRoute, linksRoute, linkDetailRoute, domainsRoute, analyticsRoute]);
export const router = createRouter({ routeTree, basepath: "/app" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
