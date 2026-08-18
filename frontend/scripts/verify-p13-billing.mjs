import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mustExist = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P13 missing required file: ${file}`); };
const mustContain = (file, values) => { const source = read(file); for (const value of values) if (!source.includes(value)) throw new Error(`P13 ${file} missing contract token: ${value}`); };
const mustNotContain = (file, values) => { const source = read(file); for (const value of values) if (source.includes(value)) throw new Error(`P13 ${file} contains forbidden token: ${value}`); };

for (const file of [
  "apps/workspace/src/routes/BillingPage.tsx",
  "apps/workspace/src/billing.css",
  "apps/admin/src/routes/PlansPage.tsx",
  "apps/admin/src/routes/AdminBillingPage.tsx",
  "apps/admin/src/routes/PaymentsPage.tsx",
  "apps/admin/src/routes/FXPage.tsx",
  "apps/admin/src/PlanForm.tsx",
  "apps/admin/src/commerce.css",
  "packages/api-client/src/billing.ts",
  "tests/billing/p13-billing.spec.ts",
  "tests/commerce/p13-commerce.spec.ts",
  "../docs/v5/P13_BILLING_COMMERCE_CONTRACT.md",
  "../database/migrations/p13commerceplanpresentation.sql",
  "../app/billing/planpresentation.go",
  "../app/billing/planselection.go",
  "../services/platformapi/cmd/server/admincommerce.go"
]) mustExist(file);

mustContain("apps/workspace/src/router.tsx", ["BillingPage", 'path: "/billing"']);
mustContain("apps/workspace/src/routes/BillingPage.tsx", ["data-p13-billing", "Quota usage", "Orders & invoices", "Payment started", "not shown as paid until the server confirms it", "fx_provider", "fx_rate", "plan.billing_periods"]);
mustContain("apps/admin/src/router.tsx", ["PlansPage", "AdminBillingPage", "PaymentsPage", "FXPage", 'path: "/plans"', 'path: "/billing"', 'path: "/payments"', 'path: "/fx"']);
mustContain("apps/admin/src/routes/PlansPage.tsx", ["data-p13-admin-plans", "Public", "Periods", "New plan", "Archive"]);
mustContain("apps/admin/src/routes/AdminBillingPage.tsx", ["data-p13-admin-billing", "Audited manual settlement", "Settlement / FX"]);
mustContain("apps/admin/src/routes/PaymentsPage.tsx", ["data-p13-admin-payments", "Sensitive callback payload is redacted", "Payload SHA-256", "Callback timeline"]);
mustContain("apps/admin/src/routes/FXPage.tsx", ["data-p13-admin-fx", "Save audited FX override", "Change reason", "RATE CACHE", "FX HISTORY"]);
mustContain("packages/api-client/src/billing.ts", ["createBillingClient", '"purchase" | "upgrade" | "renewal"', "/billing/payment-methods", "/admin/payments", "/api/admin/fx"]);
mustContain("../services/platformapi/cmd/server/billing.go", ["s.billing.Usage", "s.billing.PublicPlans", "s.billing.ValidatePlanSelection", '"usage": usage']);
mustContain("../services/platformapi/cmd/server/billingpresentationroutes.go", [
  'POST /api/admin/plans', 'GET /api/admin/payments', 'GET /api/admin/payments/{id}', 'GET /api/admin/fx', 'PUT /api/admin/fx', 's.admin("billing.manage"'
]);
mustContain("../services/platformapi/cmd/server/admincommerce.go", ["payment_callback_events", '"payload_redacted": true', "payload_sha256", "admin.fx_updated", "DELETE FROM fx_rate_cache", "手工修改 FX 配置必须填写"]);
mustNotContain("../services/platformapi/cmd/server/admincommerce.go", ["provider_payload"]);
mustContain("../app/billing/planpresentation.go", ["PublicPlans", "ManagedPlans", "CreateManagedPlan", "UpdateManagedPlanPresentation", "billing_periods", "is_public", "display_order"]);
mustContain("../app/billing/planselection.go", ["ValidatePlanSelection", "is_public", "billing_periods", "该套餐当前不公开销售", "该套餐不支持所选账单周期"]);
mustContain("../database/migrations/p13commerceplanpresentation.sql", ["is_public", "display_order", "billing_periods", "plans_public_display_idx"]);
mustNotContain("apps/workspace/src/routes/BillingPage.tsx", ["localStorage.setItem", "sessionStorage.setItem", "mockBilling", "fakeBilling"]);
mustNotContain("apps/admin/src/routes/PaymentsPage.tsx", ["provider_payload", "localStorage.setItem", "sessionStorage.setItem"]);

console.log("P13 Billing contract verified: real quota usage, public managed plans and period enforcement, non-optimistic payment truth, redacted callbacks, audited FX override, responsive Workspace/Admin commerce surfaces.");
