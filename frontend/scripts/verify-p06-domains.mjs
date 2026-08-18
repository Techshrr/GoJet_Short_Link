import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`P06 missing required file: ${file}`);
};
const mustContain = (file, values) => {
  const source = read(file);
  for (const value of values) if (!source.includes(value)) throw new Error(`P06 ${file} missing contract token: ${value}`);
};

for (const file of [
  "apps/workspace/src/routes/DomainsPage.tsx",
  "apps/workspace/src/domains.css",
  "packages/api-client/src/domains.ts",
  "../docs/v5/P06_DOMAINS_CONTRACT.md"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["DomainsPage", 'path: "/domains"']);
mustContain("apps/workspace/src/WorkspaceShell.tsx", ['label: "Domains"', 'href: "/app/domains"']);
mustContain("packages/api-client/src/domains.ts", [
  "/api/workspaces/${workspaceId}/domains",
  "/api/workspaces/${workspaceId}/link-domains",
  "/verify?rotate=1",
  "/links/capabilities"
]);
mustContain("apps/workspace/src/routes/DomainsPage.tsx", [
  "data-p06-domains",
  "Available short-link domains",
  "Ownership & HTTPS status",
  "can_manage",
  "Add custom domain",
  "Regenerate TXT",
  "Verify now"
]);
mustContain("../services/platformapi/cmd/server/domains.go", ["listDomains", "createDomain", "verifyDomain", "domainDNSRecord"]);
mustContain("../app/domains/service.go", ['workspace.Allowed(role, "manage")', 'LookupTXT', 'tls.DialWithDialer']);

const forbidden = ["localStorage.setItem", "sessionStorage.setItem", "mockDomain", "fakeDomain"];
for (const file of ["apps/workspace/src/routes/DomainsPage.tsx", "packages/api-client/src/domains.ts"]) {
  const source = read(file);
  for (const value of forbidden) if (source.includes(value)) throw new Error(`P06 forbidden implementation marker in ${file}: ${value}`);
}

console.log("P06 Domains contract verified: real API routes, RBAC gate, DNS/HTTPS states, V5 shell route, and no browser token persistence markers.");
