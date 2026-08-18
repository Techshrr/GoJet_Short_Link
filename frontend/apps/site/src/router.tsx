import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { LoginShellPreview, RegisterShellPreview, WebsiteShellPreview } from "./routes/ShellPreviews";

const DevUi = lazy(() => import("./routes/DevUi"));

function RootLayout() {
  return <Suspense fallback={<main className="foundation"><p>正在加载…</p></main>}><Outlet /></Suspense>;
}

const rootRoute = createRootRoute({ component: RootLayout });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WebsiteShellPreview });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginShellPreview });
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/register", component: RegisterShellPreview });
const devUiRoute = createRoute({ getParentRoute: () => rootRoute, path: "/dev/ui", component: DevUi });
const routeTree = rootRoute.addChildren([homeRoute, loginRoute, registerRoute, devUiRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
