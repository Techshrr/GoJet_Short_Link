import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { WebsiteShellPreview } from "./routes/ShellPreviews";
import AuthPage from "./routes/AuthPage";

const DevUi = lazy(() => import("./routes/DevUi"));
const LoginShellPreview = () => <AuthPage mode="login" />;
const RegisterShellPreview = () => <AuthPage mode="register" />;

function RootLayout() {
  return (
    <Suspense fallback={<main className="foundation"><p>正在加载…</p></main>}>
      <Outlet />
    </Suspense>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WebsiteShellPreview });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginShellPreview });
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/register", component: RegisterShellPreview });
const verifyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/verify-email", component: () => <AuthPage mode="verify" /> });
const forgotRoute = createRoute({ getParentRoute: () => rootRoute, path: "/forgot-password", component: () => <AuthPage mode="forgot" /> });
const resetRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reset-password", component: () => <AuthPage mode="reset" /> });
const legacyVerifyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/verifyemail", component: () => <AuthPage mode="verify" /> });
const legacyResetRoute = createRoute({ getParentRoute: () => rootRoute, path: "/resetpassword", component: () => <AuthPage mode="reset" /> });
const devUiRoute = createRoute({ getParentRoute: () => rootRoute, path: "/dev/ui", component: DevUi });

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  verifyRoute,
  forgotRoute,
  resetRoute,
  legacyVerifyRoute,
  legacyResetRoute,
  devUiRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
