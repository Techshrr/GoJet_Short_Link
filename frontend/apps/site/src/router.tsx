import { Suspense } from "react";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { useLocale } from "@gojet/ui/locale";
import { WebsiteShellPreview } from "./routes/ShellPreviews";
import AuthPage from "./routes/AuthPage";

const LoginShellPreview = () => <AuthPage mode="login" />;
const RegisterShellPreview = () => <AuthPage mode="register" />;

function LoadingPage() {
  const { text } = useLocale();
  return <main className="foundation"><p>{text("Loading…", "正在加载…")}</p></main>;
}

function RootLayout() {
  return (
    <Suspense fallback={<LoadingPage />}>
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

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  verifyRoute,
  forgotRoute,
  resetRoute,
  legacyVerifyRoute,
  legacyResetRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
