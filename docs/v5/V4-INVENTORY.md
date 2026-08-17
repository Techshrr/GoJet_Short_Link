# GoJet V5 — P00 V4 Inventory

**Status:** VERIFIED BASELINE / P00 inventory snapshot  
**Source branch:** `rebuild/v4-rc12-real-install-fixes`  
**Source commit:** `43c49f8bcf761c88dfd27e94a69fba7756bd8486`  
**V5 branch:** `rebuild/v5-specification-rebuild`

This document is the auditable migration baseline required by GJ-V5-001. It records what exists in the frozen V4 tree before V5 replaces the product/front-end architecture. Presence here does **not** mean a V5 capability is accepted; the capability matrix and G0–G13 remain authoritative for V5 completion.

## 1. Repository-level architecture

Verified frozen V4 root assets include:

- Go module: `go.mod`
- backend/domain packages: `app/`
- Go services: `services/`
- SQL migrations: `database/migrations/`
- legacy frontends: `frontend/`
- deployment assets: `deploy/`
- CI workflows: `.github/workflows/`
- root Docker build: `Dockerfile`
- root development compose: `compose.yaml`

V5 migration rule: Docker assets remain historical/development inputs until their replacement is proven, but they are **not** the V5 production runtime target. GJ-V5-001 fixes production on Nginx + PHP 8.3 installer + MySQL 8.x + authenticated Redis + Go binaries + systemd (+ ClamAV when file sharing is enabled), with no Node/PM2/Docker dependency at runtime.

## 2. Eight Go runtime services

The V4 service inventory is verified from `services/` plus the platform API command tree and compose wiring.

| Runtime | V4 source / command | V4 role / dependency evidence | V5 disposition |
|---|---|---|---|
| `redirectengine` | `services/redirectengine/` | Redis-backed redirect runtime, log webhook integration | Preserve backend truth; native binary/systemd |
| `platformapi` | `services/platformapi/cmd/server/` | MySQL + Redis; settings encryption; files/storage; QR tracking; public API | Preserve as authoritative product API |
| `analyticsworker` | `services/analyticsworker/` | Redis + MySQL analytics ingestion/processing | Preserve |
| `analyticsreconciler` | `services/analyticsreconciler/` | Redis + MySQL reconciliation loop | Preserve |
| `fileworker` | `services/platformapi/cmd/fileworker/` | File storage + ClamAV + object storage | Preserve and re-gate file publish state |
| `mailworker` | `services/platformapi/cmd/mailworker/` | MySQL/settings + outbound mail worker | Preserve |
| `operationsmonitor` | `services/platformapi/cmd/operationsmonitor/` | Operational health/alert loop | Preserve |
| `logreceiver` | `services/logreceiver/` | MySQL log ingestion endpoint | Preserve with secret-redaction guarantees |

The compose baseline also contains infrastructure/support containers for MySQL, Redis, ClamAV and MinIO. These are not counted as the eight Go services.

## 3. Backend/domain package inventory

Verified top-level `app/` packages include at least:

- `adminauth`
- `billing`
- `destinationkey`
- `destinationrisk`
- `domains`
- `identity`
- `links`
- `logstore`
- `mail`
- `monitoring`
- `objectstorage`
- `observability`
- `organization`
- `payments`

The remaining `app/` tree is intentionally treated as frozen V4 backend inventory and must be mapped capability-by-capability rather than rewritten for visual reasons.

## 4. Database baseline

Migrations are stored in `database/migrations/`. The frozen catalog contains dedicated schema/migration files for, among other areas:

- abuse-report public URLs;
- account/workspace mail events;
- administrator identity;
- admin operations center;
- analytics and analytics recovery;
- billing, quotas, billing cycles and lifecycle;
- brand asset consolidation;
- campaign conversion tracking;
- domain verification;
- additional product/security/operations schema files in the same catalog.

V5 rule: no table/column is removed merely because the old UI is replaced. Schema changes require explicit migration, rollback/compatibility consideration and Capability Matrix linkage.

## 5. Legacy frontend baseline

Frozen V4 `frontend/` is a non-monorepo legacy layout:

```text
frontend/
├── adminconsole/
├── publicsite/
├── shared/
└── userconsole/
```

There is no `frontend/package.json` at the V4 root. This makes it possible to introduce the V5 pnpm workspace at `frontend/` while retaining the four V4 directories during controlled migration. They are **legacy inputs**, not V5 Surface architecture.

Required V5 target:

```text
frontend/
├── apps/
│   ├── site/
│   ├── docs/
│   ├── workspace/
│   └── admin/
└── packages/
    ├── ui/
    ├── tokens/
    ├── api-client/
    ├── auth/
    ├── charts/
    ├── icons/
    ├── domain/
    ├── motion/
    └── utils/
```

Migration safety rule: V4 legacy directories are not deleted until their capabilities are mapped to V5 and the corresponding Browser/Functional gates are green.

## 6. Authentication/security migration debt

The frozen V4 frontend contains a browser-token flow that persists an auth token in `localStorage` (`gojet_token`). That pattern is explicitly disallowed by GJ-V5-001 for official V5 authentication.

V5 foundation therefore starts with a cookie-session capable API client using `credentials: include`, optional CSRF header injection, and no token persistence in Local Storage. Existing server authentication behaviour is not assumed compliant merely because the old UI worked; Auth/Security gates will revalidate the complete session flow.

## 7. Deployment baseline

Verified `deploy/` contains both container-era and native assets:

- `deploy/.env.production.example`
- `deploy/INSTALL.zhCN.md`
- `deploy/compose.hostnginx.yaml`
- `deploy/compose.production.yaml`
- `deploy/docker/`
- `deploy/nginx/`
- `deploy/native/`

Verified native files include:

- `deploy/native/gojet.env.example`
- `deploy/native/gojet@.service`
- `deploy/native/gojetinstaller.path`
- `deploy/native/gojetinstaller.service`

V5 will build on the native direction rather than treating the Docker production composition as the release target.

## 8. CI / acceptance baseline

The V4 workflow catalog already contains targeted acceptance workflows, including:

- `analyticsdashboard.yml`
- `authpolicy.yml`
- `destinationriskruntime.yml`
- `finalcandidate.yml`
- `fullstackp0.yml`
- `installervalidation.yml`
- `paymentcallbackbrowser.yml`
- `paymentcallbackpublic.yml`
- `productsurface.yml`
- `redirectengine.yml`
- `releasepackage.yml`
- `schemanaming.yml`
- additional workflows in `.github/workflows/`

V5 does **not** inherit historical green status. Existing workflows are regression evidence and reusable test assets; new architecture, browser, SEO, accessibility, security and package gates must execute against the V5 exact HEAD.

## 9. P00 invariants carried into V5

1. The eight Go services remain first-class runtime assets.
2. Go API/Workers remain the final truth for authz, tenancy, RBAC, billing/quota, payment, risk, file security and audit.
3. MySQL migration history remains authoritative and additive.
4. Redis remains a runtime dependency and must be authenticated in production.
5. Destination Risk and file scanning are not downgraded to browser checks.
6. Existing billing/payment/mail/ticket/domain/link capabilities are migration obligations, not optional UX scope.
7. Native/systemd assets are the production migration direction.
8. Legacy frontend is frozen as a capability reference only; V5 UI is rebuilt from the three frozen V5 specifications.

## 10. P00 exit

P00 is considered complete when this inventory and `CAPABILITY-MATRIX.md` are present on the V5 branch and Issue #8 points to them. Individual capabilities remain `V5 pending` until their corresponding implementation phase and gates pass.
