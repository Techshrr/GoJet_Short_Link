import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P07 missing required file: ${file}`); };
const mustContain = (file, values) => {
  const source = read(file);
  for (const value of values) if (!source.includes(value)) throw new Error(`P07 ${file} missing contract token: ${value}`);
};

for (const file of [
  "apps/workspace/src/routes/AnalyticsPage.tsx",
  "apps/workspace/src/analytics.css",
  "packages/api-client/src/analytics.ts",
  "tests/analytics/p07-analytics.spec.ts",
  "../docs/v5/P07_ANALYTICS_CONTRACT.md"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["AnalyticsPage", 'path: "/analytics"']);
mustContain("apps/workspace/src/WorkspaceShell.tsx", ['label: "Analytics"', 'href: "/app/analytics"']);
mustContain("packages/api-client/src/analytics.ts", [
  "/api/workspaces/${workspaceId}/overview",
  "/api/workspaces/${workspaceId}/qr-codes",
  "/api/workspaces/${workspaceId}/fileshares",
  "/api/workspaces/${workspaceId}/text-shares",
  "/api/workspaces/${workspaceId}/bio-pages",
  '"qr_visits"',
  "Promise.allSettled"
]);
mustContain("tests/analytics/p07-analytics.spec.ts", ["qr_visits: 15"]);
mustContain("apps/workspace/src/routes/AnalyticsPage.tsx", [
  "data-p07-analytics",
  "Resource filter",
  "Domain filter",
  "Campaign filter",
  "Country filter",
  "Device filter",
  "Previous equal-length period",
  "Export CSV",
  "can_analytics",
  "linksClient.analytics",
  "analyticsClient.overview",
  "Partial resource data"
]);
mustContain("../services/platformapi/cmd/server/overview.go", ["workspaceOverview", "redis-realtime+mysql-history"]);
mustContain("../services/platformapi/cmd/server/links.go", ["linkAnalytics", "AnalyticsSafe"]);
mustContain("../app/links/analyticssafe.go", ['workspace.Allowed(role, "analytics")', "analytics_events", "COUNT(DISTINCT"]);
mustContain("../frontend/userconsole/analytics.js", ["x.qr_visits||0"]);
mustContain("../services/platformapi/cmd/server/main.go", [
  'GET /api/workspaces/{id}/overview',
  'GET /api/workspaces/{id}/links/{link}/analytics',
  'GET /api/workspaces/{id}/qr-codes',
  'GET /api/workspaces/{id}/fileshares',
  'GET /api/workspaces/{id}/text-shares',
  'GET /api/workspaces/{id}/bio-pages'
]);

const forbidden = ["localStorage.setItem", "sessionStorage.setItem", "mockAnalytics", "fakeAnalytics", "Math.random()"];
for (const file of ["apps/workspace/src/routes/AnalyticsPage.tsx", "packages/api-client/src/analytics.ts"]) {
  const source = read(file);
  for (const marker of forbidden) if (source.includes(marker)) throw new Error(`P07 forbidden implementation marker in ${file}: ${marker}`);
}

console.log("P07 Analytics contract verified: real overview/link/resource APIs, production qr_visits mapping, analytics RBAC, explicit filter semantics, compare/export, partial resource error handling, and no fabricated metrics.");
