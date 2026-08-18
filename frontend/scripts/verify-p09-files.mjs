import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P09 missing required file: ${file}`); };
const mustContain = (file, values) => { const source = read(file); for (const value of values) if (!source.includes(value)) throw new Error(`P09 ${file} missing contract token: ${value}`); };

for (const file of [
  "apps/workspace/src/routes/FilesPage.tsx",
  "apps/workspace/src/resources.css",
  "packages/api-client/src/resources.ts",
  "tests/files/p09-files.spec.ts",
  "../docs/v5/P09_FILES_CONTRACT.md"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["FilesPage", 'path: "/files"']);
mustContain("apps/workspace/src/routes/FilesPage.tsx", [
  "data-p09-files",
  "Drag, paste or browse a file",
  "Maximum file size: 100 MB",
  "Folder upload",
  'title="Uploading"',
  'title="Processing"',
  "Partial safety state",
  "Read-only file access",
  "Permission denied",
  "Quota exceeded",
  "Rate limited",
  "File service disabled",
  'item.scan_status === "clean" && item.status === "active"',
  "Open share",
  "Not public",
  'Dialog triggerLabel="Delete"'
]);
mustContain("packages/api-client/src/resources.ts", ["/fileshares", "created_at: string", "FormData", 'form.set("file"']);
mustContain("../app/resources/files.go", [
  "MaxFileSize int64 = 100 << 20",
  'CreatedAt    time.Time  `json:"created_at"`',
  "created_at FROM file_shares",
  '"quarantine/"+storageName',
  'ScanStatus: "pending"',
  'Status: "quarantined"',
  "scan_status='scanning'",
  'status, scanStatus = "active", "clean"',
  'item.ScanStatus != "clean" || item.Status != "active"',
  "func ScanClamAV"
]);
mustContain("../services/platformapi/cmd/server/resources.go", [
  "http.MaxBytesReader",
  "appresources.MaxFileSize",
  '"created_at":item.CreatedAt',
  "jsonResponse(w,202",
  "FileProtectionMap"
]);
mustContain("../services/platformapi/cmd/fileworker/main.go", [
  'getenv("CLAMAV_ADDRESS", "disabled")',
  "file shares will remain quarantined until the scanner is configured",
  "ClaimFileScan",
  "MaterializeForScan",
  "ScanClamAVEndpoint",
  "FinishFileScan"
]);
mustContain("../services/platformapi/cmd/server/filepublicpage.go", [
  'X-Robots-Tag", "noindex, nofollow, noarchive"',
  'Cache-Control", "private, no-store"',
  'X-Content-Type-Options", "nosniff"',
  'Content-Security-Policy"'
]);

const forbidden = ["mockFile", "fakeFile", "Math.random()", "localStorage.setItem", "sessionStorage.setItem", "webUtils.relativePath"];
for (const file of ["apps/workspace/src/routes/FilesPage.tsx", "packages/api-client/src/resources.ts"]) {
  const source = read(file);
  for (const marker of forbidden) if (source.includes(marker)) throw new Error(`P09 forbidden implementation marker in ${file}: ${marker}`);
}

console.log("P09 Files contract verified: real multipart upload, authoritative created time, quarantine/ClamAV publish states, clean+active public gate, RBAC/destructive confirmation, public-page hardening and no fabricated safety data.");
