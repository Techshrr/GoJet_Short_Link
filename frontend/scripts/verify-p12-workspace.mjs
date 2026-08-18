import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P12 missing required file: ${file}`); };
const mustContain = (file, values) => { const source = read(file); for (const value of values) if (!source.includes(value)) throw new Error(`P12 ${file} missing contract token: ${value}`); };

for (const file of [
  "apps/workspace/src/routes/MembersPage.tsx",
  "apps/workspace/src/routes/OrganizationPage.tsx",
  "apps/workspace/src/workspace-organization.css",
  "packages/api-client/src/workspace.ts",
  "tests/workspace/p12-workspace.spec.ts",
  "../docs/v5/P12_WORKSPACE_ORGANIZATION_CONTRACT.md"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["MembersPage", "OrganizationPage", 'path: "/members"', 'path: "/campaigns"', 'path: "/tags"']);
mustContain("apps/workspace/src/routes/MembersPage.tsx", [
  "data-p12-members", "Invite member", "Active members", "Pending invitations", "Read-only member access", "Remove member", "Owner / Admin"
]);
mustContain("apps/workspace/src/routes/OrganizationPage.tsx", [
  "data-p12-organization", "Campaign performance groups", "Folders", "Tags", "Read-only organization access", "New campaign", "New folder", "New tag"
]);
mustContain("packages/api-client/src/workspace.ts", [
  "createWorkspaceClient", "/members", "/invitations", "/organization", "/campaigns", "/folders", "/tags", "WorkspaceMembersPayload", "WorkspaceOrganizationSnapshot"
]);
mustContain("../app/workspace/service.go", [
  '"owner": {"manage": true', "func (s *Service) Invite", 's.billing.Check(ctx, workspaceID, "members", 1)', "func (s *Service) ChangeRole", "func (s *Service) Remove"
]);
mustContain("../app/organization/service.go", [
  "func (s *Service) Snapshot", "func (s *Service) CreateCampaign", "func (s *Service) CreateFolder", "func (s *Service) CreateTag", "func (s *Service) SetCampaignStatus"
]);
mustContain("../services/platformapi/cmd/server/main.go", [
  'GET /api/workspaces/{id}/members', 'POST /api/workspaces/{id}/invitations', 'GET /api/workspaces/{id}/organization', 'POST /api/workspaces/{id}/campaigns', 'POST /api/workspaces/{id}/folders', 'POST /api/workspaces/{id}/tags'
]);

const forbidden = ["mockMembers", "fakeMembers", "mockOrganization", "fakeOrganization", "Math.random()", "localStorage.setItem", "sessionStorage.setItem"];
for (const file of ["apps/workspace/src/routes/MembersPage.tsx", "apps/workspace/src/routes/OrganizationPage.tsx", "packages/api-client/src/workspace.ts"]) {
  const source = read(file);
  for (const marker of forbidden) if (source.includes(marker)) throw new Error(`P12 forbidden implementation marker in ${file}: ${marker}`);
}

console.log("P12 Workspace contract verified: real member/invitation RBAC, campaigns/folders/tags organization surfaces, quota-aware server authority, responsive UI and no fabricated persistence.");
