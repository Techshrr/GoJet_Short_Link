import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

const AdminFoundation = lazy(() => import("./routes/AdminFoundation"));
const UsersBoundary = lazy(() => import("./routes/UsersBoundary"));

function RootLayout() {
  return (
    <Suspense fallback={<main className="foundation"><span>GoJet Admin</span><p>正在加载…</p></main>}>
      <Outlet />
    </Suspense>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: AdminFoundation });
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: UsersBoundary });
const routeTree = rootRoute.addChildren([indexRoute, usersRoute]);
export const router = createRouter({ routeTree, basepath: "/admin" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
