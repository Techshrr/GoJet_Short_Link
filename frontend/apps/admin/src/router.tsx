import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

function RootLayout() { return <Outlet />; }
function AdminFoundation() { return <main className="foundation"><span>GoJet Admin · P01</span><h1>管理控制台工程骨架</h1><p>AdminShell、DataTable 与治理交互属于 P03/P04/P17；P01 只固定独立 Router、Query 与安全客户端边界。</p></main>; }
function UsersBoundary() { return <main className="foundation"><span>Admin Users · boundary</span><h1>用户治理路由边界</h1><p>P17 前不复制旧管理页，本路由仅用于工程边界和客户端导航验证。</p></main>; }

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: AdminFoundation });
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: UsersBoundary });
const routeTree = rootRoute.addChildren([indexRoute, usersRoute]);
export const router = createRouter({ routeTree, basepath: "/admin" });

declare module "@tanstack/react-router" { interface Register { router: typeof router } }
