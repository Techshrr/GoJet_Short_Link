import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

function RootLayout() { return <Outlet />; }

function WorkspaceFoundation() {
  return <main className="foundation"><span>GoJet Workspace · P01</span><h1>工作台工程骨架</h1><p>正式 CustomerShell 与 Links Vertical Slice 将分别在 P04 / P05 实现；此处建立独立 bundle、Router、Query 边界与共享安全客户端。</p></main>;
}

function LinksBoundary() {
  return <main className="foundation"><span>Links · P01 boundary</span><h1>链接路由边界</h1><p>P05 才开始真实 Links Vertical Slice；此路由只用于验证 V5 SPA 内部导航不会依赖整页 reload。</p></main>;
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WorkspaceFoundation });
const linksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/links", component: LinksBoundary });
const routeTree = rootRoute.addChildren([indexRoute, linksRoute]);
export const router = createRouter({ routeTree, basepath: "/app" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
