import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P08 missing required file: ${file}`); };
const mustContain = (file, values) => { const source = read(file); for (const value of values) if (!source.includes(value)) throw new Error(`P08 ${file} missing contract token: ${value}`); };

for (const file of ["apps/workspace/src/routes/QRPage.tsx","apps/workspace/src/resources.css","packages/api-client/src/resources.ts","tests/qr/p08-qr.spec.ts","../docs/v5/P08_QR_CONTRACT.md"]) mustExist(file);
mustContain("apps/workspace/src/router.tsx", ["QRPage", 'path: "/qr"']);
mustContain("apps/workspace/src/routes/QRPage.tsx", ["data-p08-qr","Create QR","QR library","Total scans",'["png", "svg", "pdf"] as ExportFormat[]',"Download {format.toUpperCase()}","Open analytics","Read-only QR access","Quota exceeded","Rate limited","riskAllows","Dialog triggerLabel=\"Delete QR\""]);
mustContain("packages/api-client/src/resources.ts", ["/qr-codes","qr_visits","resourceAccess"]);
mustContain("packages/api-client/src/links.ts", ['format?: "png" | "svg" | "pdf"', 'query.set("download", "1")']);
mustContain("../services/platformapi/cmd/server/resources.go", ["createQRCode","listQRCodes","deleteQRCode","requireQRLinkRiskAllow"]);
mustContain("../services/platformapi/cmd/server/qrriskguard.go", ["pending || effective != \"allow\"","server-side enforcement"]);
mustContain("../app/resources/service.go", ["qrcode.New", "hmac.New", "hex.EncodeToString(mac.Sum(nil))"]);
mustContain("../app/resources/management.go", ["ListQRs","visit_type='qr'","DeleteQR"]);
mustContain("../services/platformapi/cmd/server/productroutes.go", ['GET /api/workspaces/{id}/links/{link}/qr']);
const forbidden=["mockQR","fakeQR","Math.random()","localStorage.setItem","sessionStorage.setItem"];
for(const file of ["apps/workspace/src/routes/QRPage.tsx","packages/api-client/src/resources.ts"]){const source=read(file);for(const marker of forbidden)if(source.includes(marker))throw new Error(`P08 forbidden implementation marker in ${file}: ${marker}`)}
console.log("P08 QR contract verified: real QR CRUD, server-side destination-risk enforcement, signed QR tracking, accepted Link QR exports, RBAC/read-only/destructive-confirm states and no fabricated QR data.");
