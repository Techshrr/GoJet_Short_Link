import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

function RootLayout() {
  return <Outlet />;
}

function FoundationHome() {
  return (
    <main className="foundation">
      <p className="eyebrow">GOJET V5 · P01</p>
      <h1>Engineering foundation</h1>
      <p>Website and Auth are being rebuilt from the frozen V5 contracts. Public SSG is intentionally not claimed complete at P01.</p>
    </main>
  );
}

function AuthFoundation() {
  return (
    <main className="foundation">
      <p className="eyebrow">GOJET AUTH · P01</p>
      <h1>Authentication surface boundary</h1>
      <p>The production auth workflow is implemented in P15. This route exists now to keep Auth separate from Workspace and Admin architecture.</p>
    </main>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: FoundationHome });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: AuthFoundation });
const routeTree = rootRoute.addChildren([homeRoute, loginRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
