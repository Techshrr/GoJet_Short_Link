import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

const DevUi = lazy(() => import("./routes/DevUi"));

function RootLayout() {
  return <Suspense fallback={<main className="foundation"><p>正在加载设计系统…</p></main>}><Outlet /></Suspense>;
}

function FoundationHome() {
  return (
    <main className="foundation">
      <p className="eyebrow">GOJET V5 · FOUNDATION</p>
      <h1>Engineering foundation</h1>
      <p>Website and Auth are being rebuilt from the frozen V5 contracts. Public SSG is intentionally not claimed complete before its owning phase.</p>
    </main>
  );
}

function AuthFoundation() {
  return (
    <main className="foundation">
      <p className="eyebrow">GOJET AUTH · FOUNDATION</p>
      <h1>Authentication surface boundary</h1>
      <p>The production auth workflow is implemented in P15. This route exists to keep Auth separate from Workspace and Admin architecture.</p>
    </main>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: FoundationHome });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: AuthFoundation });
const devUiRoute = createRoute({ getParentRoute: () => rootRoute, path: "/dev/ui", component: DevUi });
const routeTree = rootRoute.addChildren([homeRoute, loginRoute, devUiRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
