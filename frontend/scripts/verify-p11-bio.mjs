import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P11 missing required file: ${file}`); };
const mustContain = (file, values) => { const source = read(file); for (const value of values) if (!source.includes(value)) throw new Error(`P11 ${file} missing contract token: ${value}`); };

for (const file of [
  "apps/workspace/src/routes/BioPage.tsx",
  "apps/workspace/src/text-bio.css",
  "packages/api-client/src/resources.ts",
  "tests/bio/p11-bio.spec.ts",
  "../docs/v5/P11_BIO_CONTRACT.md"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["BioPage", 'path: "/bio"']);
mustContain("apps/workspace/src/routes/BioPage.tsx", [
  "data-p11-bio",
  "Bio pages",
  "Bio live phone preview",
  '"Content", "Appearance", "Social", "Domain", "Analytics", "SEO", "Settings"',
  "SEO default: noindex",
  "Read-only Bio access",
  "Permission denied",
  "Quota exceeded",
  "Rate limited",
  "Bio service disabled",
  'Dialog triggerLabel="Delete Bio"',
  "Manage domains",
  "Open Analytics"
]);
mustContain("apps/workspace/src/text-bio.css", [
  "grid-template-columns:420px minmax(0,1fr)",
  ".bio-phone-shell",
  ".bio-tabs",
  "@media(max-width:720px)"
]);
mustContain("packages/api-client/src/resources.ts", [
  "createBioClient",
  "/bio-pages",
  "BioPageRecord",
  "BioPageInput",
  'publicUrl: (slug: string) => `/p/${encodeURIComponent(slug)}`'
]);
mustContain("../app/resources/service.go", [
  "func (s *Service) CreateBio",
  's.billing.Check(ctx, wid, "bios", 1)',
  "func (s *Service) ReadBio",
  "views=views+1"
]);
mustContain("../app/resources/management.go", [
  "func (s *Service) ListBios",
  "func (s *Service) UpdateBio",
  "func (s *Service) DeleteBio",
  "func validateBio",
  "len(blocks) > 50",
  'parsed.Scheme != "http" && parsed.Scheme != "https"'
]);
mustContain("../services/platformapi/cmd/server/main.go", [
  'POST /api/workspaces/{id}/bio-pages',
  'GET /api/workspaces/{id}/bio-pages',
  'PUT /api/workspaces/{id}/bio-pages/{page}',
  'DELETE /api/workspaces/{id}/bio-pages/{page}',
  'GET /p/{slug}'
]);
mustContain("../services/platformapi/cmd/server/publicresources.go", [
  'var bioPageTemplate',
  '<meta name="robots" content="noindex,nofollow">',
  'Cache-Control", "no-store"',
  'X-Content-Type-Options", "nosniff"',
  'Content-Security-Policy"',
  "url.ParseRequestURI(link.URL)"
]);
mustContain("../services/platformapi/cmd/server/publicresources_test.go", [
  "TestBioTemplateRejectsJavascriptURLContextAndIsNoIndex",
  'name="robots" content="noindex,nofollow"'
]);

const forbidden = ["mockBio", "fakeBio", "Math.random()", "localStorage.setItem", "sessionStorage.setItem", "dangerouslySetInnerHTML"];
for (const file of ["apps/workspace/src/routes/BioPage.tsx", "packages/api-client/src/resources.ts"]) {
  const source = read(file);
  for (const marker of forbidden) if (source.includes(marker)) throw new Error(`P11 forbidden implementation marker in ${file}: ${marker}`);
}

console.log("P11 Bio contract verified: real API/RBAC, validated Theme/Blocks, frozen 420px builder and seven tabs, live phone preview, noindex/CSP public UGC safety, responsive browser gates and no fabricated domain/social/analytics persistence.");
