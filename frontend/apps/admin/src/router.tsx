import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "./AdminShell";

const AdminFoundation = lazy(() => import("./routes/AdminFoundation"));
const UsersBoundary = lazy(() => import("./routes/UsersBoundary"));
const PlansPage = lazy(() => import("./routes/PlansPage"));
const AdminBillingPage = lazy(() => import("./routes/AdminBillingPage"));
const PaymentsPage = lazy(() => import("./routes/PaymentsPage"));
const FXPage = lazy(() => import("./routes/FXPage"));
const TicketsPage = lazy(() => import("./routes/TicketsPage"));
const MailPage = lazy(() => import("./routes/MailPage"));
const MailSettingsPage = lazy(() => import("./routes/MailSettingsPage"));
const TemplatesPage = lazy(() => import("./routes/TemplatesPage"));
const OAuthPage = lazy(() => import("./routes/OAuthPage"));
const DestinationRiskPage = lazy(() => import("./routes/TrustSafetyPages").then((module) => ({ default: module.DestinationRiskPage })));
const DestinationRiskDetailPage = lazy(() => import("./routes/TrustSafetyPages").then((module) => ({ default: module.DestinationRiskDetailPage })));
const FileSecurityPage = lazy(() => import("./routes/TrustSafetyPages").then((module) => ({ default: module.FileSecurityPage })));
const AbuseReportsPage = lazy(() => import("./routes/TrustSafetyPages").then((module) => ({ default: module.AbuseReportsPage })));
const SecurityEventsPage = lazy(() => import("./routes/TrustSafetyPages").then((module) => ({ default: module.SecurityEventsPage })));
const AuditPage = lazy(() => import("./routes/TrustSafetyPages").then((module) => ({ default: module.AuditPage })));

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <AdminShell pathname={pathname}><Suspense fallback={<main className="shell-page-proof"><span>GoJet Admin</span><p>正在加载…</p></main>}><Outlet /></Suspense></AdminShell>;
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: AdminFoundation });
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: UsersBoundary });
const plansRoute = createRoute({ getParentRoute: () => rootRoute, path: "/plans", component: PlansPage });
const billingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/billing", component: AdminBillingPage });
const paymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/payments", component: PaymentsPage });
const fxRoute = createRoute({ getParentRoute: () => rootRoute, path: "/fx", component: FXPage });
const ticketsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tickets", component: TicketsPage });
const mailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mail", component: MailPage });
const mailSettingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mail-settings", component: MailSettingsPage });
const templatesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/templates", component: TemplatesPage });
const oauthRoute = createRoute({ getParentRoute: () => rootRoute, path: "/oauth", component: OAuthPage });
const destinationRiskRoute = createRoute({ getParentRoute: () => rootRoute, path: "/destination-risk", component: DestinationRiskPage });
const destinationRiskDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/destination-risk/$riskId", component: DestinationRiskDetailPage });
const fileSecurityRoute = createRoute({ getParentRoute: () => rootRoute, path: "/file-security", component: FileSecurityPage });
const abuseRoute = createRoute({ getParentRoute: () => rootRoute, path: "/abuse", component: AbuseReportsPage });
const securityEventsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/security-events", component: SecurityEventsPage });
const auditRoute = createRoute({ getParentRoute: () => rootRoute, path: "/audit", component: AuditPage });
const routeTree = rootRoute.addChildren([indexRoute, usersRoute, plansRoute, billingRoute, paymentsRoute, fxRoute, ticketsRoute, mailRoute, mailSettingsRoute, templatesRoute, oauthRoute, destinationRiskRoute, destinationRiskDetailRoute, fileSecurityRoute, abuseRoute, securityEventsRoute, auditRoute]);
export const router = createRouter({ routeTree, basepath: "/admin" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
