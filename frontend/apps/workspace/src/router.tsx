import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

const WorkspaceFoundation = lazy(() => import("./routes/WorkspaceFoundation"));
const LinksBoundary = lazy(() => import("./routes/LinksBoundary"));

function RootLayout() {
  return (
    <Suspense fallback={<main className="foundation"><span>GoJet</span><p>正在加载…</p></main>}>
      <Outlet />
    </Suspense>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WorkspaceFoundation });
const linksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/links", component: LinksBoundary });
const routeTree = rootRoute.addChildren([indexRoute, linksRoute]);
export const router = createRouter({ routeTree, basepath: "/app" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
