import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P16 missing required file: ${file}`); };
const has = (file, tokens) => { const source = read(file); for (const token of tokens) if (!source.includes(token)) throw new Error(`P16 ${file} missing contract token: ${token}`); };
const lacks = (file, tokens) => { const source = read(file); for (const token of tokens) if (source.includes(token)) throw new Error(`P16 ${file} contains forbidden token: ${token}`); };

for (const file of [
  "apps/admin/src/routes/TrustSafetyPages.tsx",
  "apps/admin/src/trust-safety.css",
  "../services/platformapi/cmd/server/destinationriskadmin.go",
  "../services/platformapi/cmd/server/operations.go",
  "../services/platformapi/cmd/server/linkriskpresentation.go",
  "../app/destinationrisk/store.go",
  "../docs/v5/P16_TRUST_SAFETY_CONTRACT.md"
]) exists(file);

has("apps/admin/src/router.tsx", ["/destination-risk", "/destination-risk/$riskId", "/file-security", "/abuse", "/security-events", "/audit"]);
has("apps/admin/src/routes/TrustSafetyPages.tsx", [
  "data-p16-trust-safety",
  'useQueue("/api/admin/destination-risks?limit=100"',
  '/api/admin/destination-risks/${linkId}/override',
  '/api/admin/destination-risks/${linkId}/rescan',
  'api.delete(`/api/admin/destination-risks/${linkId}/override`',
  'useQueue("/api/admin/files"',
  '/api/admin/files/${fileId}/retry-scan',
  'useQueue("/api/admin/abuse"',
  '/api/admin/abuse/${id(selected)}',
  'useQueue("/api/admin/security"',
  '/api/admin/security/${id(selected)}',
  'useQueue("/api/admin/audit?limit=100"',
  'density="compact"',
  "useLocale",
  "localizedError"
]);
has("../services/platformapi/cmd/server/destinationriskadmin.go", ["adminDestinationRisks", "adminOverrideDestinationRisk", "adminClearDestinationRiskOverride", "adminRescanDestinationRisk"]);
has("../app/destinationrisk/store.go", ["manual override reason must contain 3 to 500 characters", "func (s *Store) Override"]);
has("../services/platformapi/cmd/server/operations.go", ["createAbuseReport", "adminResolveAbuse", "状态和处理原因必填", "adminSecurityEvents", "adminResolveSecurity", "adminRetryFileScan"]);
lacks("../services/platformapi/cmd/server/linkriskpresentation.go", ['json:"provider"', "COALESCE(r.provider"]);
lacks("apps/admin/src/routes/TrustSafetyPages.tsx", ["<iframe", "dangerouslySetInnerHTML", "localStorage", "sessionStorage"]);

console.log("P16 protection contract verified: destination review and rescan, file safety retries, abuse handling, security-event resolution, read-only audit history and localized administrator surfaces.");
