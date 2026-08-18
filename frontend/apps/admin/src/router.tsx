import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "./AdminShell";

const AdminFoundation = lazy(() => import("./routes/AdminFoundation"));
const UsersBoundary = lazy(() => import("./routes/UsersBoundary"));
const PlansPage = lazy(() => import("./routes/PlansPage"));
const AdminBillingPage = lazy(() => import("./routes/AdminBillingPage"));
const PaymentsPage = lazy(() => import("./routes/PaymentsPage"));
const FXPage = lazy(() => import("./routes/FXPage"));

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
const routeTree = rootRoute.addChildren([indexRoute, usersRoute, plansRoute, billingRoute, paymentsRoute, fxRoute]);
export const router = createRouter({ routeTree, basepath: "/admin" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
