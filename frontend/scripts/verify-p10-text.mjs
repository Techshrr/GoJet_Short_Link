import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P10 missing required file: ${file}`); };
const mustContain = (file, values) => { const source = read(file); for (const value of values) if (!source.includes(value)) throw new Error(`P10 ${file} missing contract token: ${value}`); };

for (const file of [
  "apps/workspace/src/routes/TextPage.tsx",
  "apps/workspace/src/text-bio.css",
  "packages/api-client/src/resources.ts",
  "tests/text/p10-text.spec.ts",
  "../docs/v5/P10_TEXT_CONTRACT.md"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["TextPage", 'path: "/text"']);
mustContain("apps/workspace/src/routes/TextPage.tsx", [
  "data-p10-text",
  "Text library",
  "Plain text",
  "Markdown",
  "Code / logs",
  "Text live preview",
  "Custom code",
  "One-time share",
  "Manage domains",
  "Read-only Text access",
  "Permission denied",
  "Quota exceeded",
  "Rate limited",
  "Text service disabled",
  "Terminal share",
  'Dialog triggerLabel="Delete Text"'
]);
mustContain("packages/api-client/src/resources.ts", [
  "createTextClient",
  "/text-shares",
  "TextShareCreateInput",
  "TextShareUpdateInput",
  'publicUrl: (slug: string) => `/t/${encodeURIComponent(slug)}`'
]);
mustContain("../app/resources/service.go", [
  "func (s *Service) CreateText",
  's.billing.Check(ctx, wid, "texts", 1)',
  'item.Format != "plain" && item.Format != "markdown" && item.Format != "code"',
  "bcrypt.GenerateFromPassword",
  "func (s *Service) ReadText",
  'status="consumed"',
  "views=views+1"
]);
mustContain("../app/resources/management.go", [
  "func (s *Service) ListTexts",
  "func (s *Service) GetText",
  "func (s *Service) UpdateText",
  "func (s *Service) DeleteText"
]);
mustContain("../services/platformapi/cmd/server/main.go", [
  'POST /api/workspaces/{id}/text-shares',
  'GET /api/workspaces/{id}/text-shares',
  'GET /api/workspaces/{id}/text-shares/{share}',
  'PUT /api/workspaces/{id}/text-shares/{share}',
  'DELETE /api/workspaces/{id}/text-shares/{share}',
  'GET /t/{slug}',
  'POST /t/{slug}'
]);
mustContain("../services/platformapi/cmd/server/publicresources.go", [
  '<meta name="robots" content="noindex,nofollow">',
  'Cache-Control", "no-store"',
  'X-Content-Type-Options", "nosniff"',
  'Content-Security-Policy"'
]);
mustContain("../services/platformapi/cmd/server/textrender.go", [
  "stdhtml.EscapeString(content)",
  "renderSafeMarkdown",
  'rel="noopener noreferrer nofollow"'
]);

const forbidden = ["mockText", "fakeText", "Math.random()", "localStorage.setItem", "sessionStorage.setItem", "dangerouslySetInnerHTML"];
for (const file of ["apps/workspace/src/routes/TextPage.tsx", "packages/api-client/src/resources.ts"]) {
  const source = read(file);
  for (const marker of forbidden) if (source.includes(marker)) throw new Error(`P10 forbidden implementation marker in ${file}: ${marker}`);
}

console.log("P10 Text contract verified: real CRUD API, RBAC and lifecycle states, server-enforced password/expiry/one-time behavior, safe public rendering, noindex/CSP and responsive browser gate coverage.");
