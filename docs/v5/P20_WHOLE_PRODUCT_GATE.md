# GoJet V5 — P20 Whole Product Gate

**Status:** FROZEN EXECUTION CONTRACT  
**Phase:** P20 — Whole Product Gate  
**Parent specifications:** GJ-V5-001 > GJ-V5-002 > GJ-V5-003  
**Branch:** `rebuild/v5-specification-rebuild`

## 1. Purpose

P20 is the first whole-product acceptance phase. It does not add a new product surface and it does not replace P05–P19 phase contracts. It proves that the complete V5 product assembled from those phases still satisfies the frozen product, architecture, browser, accessibility, security, SEO, visual, performance and full-stack requirements on one V5 exact HEAD.

P20 owns **G0 through G10** only. It must not claim G11 Package, G12 Fresh Install, G13 Production Validation, P21 Native Package, P22 Fresh Install Candidate, Final Candidate or Production Candidate.

## 2. Exact-HEAD rule

A P20 result is authoritative only when all P20 jobs succeed against the same commit and that commit is still the exact HEAD of `rebuild/v5-specification-rebuild` when closure evidence is published.

Historical V4 green runs and earlier V5 phase runs are regression inputs only; they do not substitute for this gate.

## 3. G0 — Scope

The gate must verify:

- `docs/v5/CAPABILITY-MATRIX.md` remains present and structurally complete;
- P05–P19 source contracts remain executable through the V5 frontend `check` command;
- all five surfaces remain present: Website / Auth / Docs / Workspace / Admin;
- the eight Go runtime service commands remain buildable;
- no P0 capability is removed merely to make the whole-product gate pass.

## 4. G1 / G2 — Architecture and Design System

The gate must re-run the complete frozen frontend source-contract chain, strict TypeScript and independent application builds. This includes monorepo boundaries, route splitting, shared API/auth packages, brand tokens, Design System primitives, Light/Dark/System, responsive shells and the no-Web-Storage auth-token rule.

Production architecture remains Nginx + PHP 8.3 installer + MySQL 8.x + authenticated Redis + Go binaries + systemd (+ ClamAV when Files are enabled). Node is build/test/package tooling only.

## 5. G3 — Functional

P20 must execute real Go tests and the existing integration acceptance harness against real MySQL and Redis service processes. Mock-only evidence is not accepted as whole-product completion.

The server remains authoritative for Authentication, Authorization, Tenant Isolation, RBAC, Billing/Quota, Payment, Risk, File Security, Audit, Domain ownership and Rate Limit.

## 6. G4 — Browser

P20 re-runs every frozen V5 Playwright surface/vertical-slice suite, including Website, Auth, Docs, Workspace, Admin and all P05–P19 product gates. The fixed viewport baseline remains:

- 1440×900;
- 1024×768 (or the phase-frozen desktop/tablet viewport where a later contract explicitly uses 1280×800);
- 390×844.

Hard failures remain page errors, console errors, horizontal overflow, broken navigation/focus, clipped content and shell/layout instability.

## 7. G5 — Accessibility

Accessibility acceptance is cumulative from the frozen Design System and Browser Gates and must retain:

- keyboard-operable controls;
- visible focus/focus-visible states;
- visible labels and accessible names for icon controls;
- non-color-only status communication;
- reduced-motion behavior;
- responsive/zoom-safe layout contracts.

P20 must fail if a later phase removes these source/browser contracts.

## 8. G6 — Security

P20 re-runs the Go security/runtime test surface and preserves the accepted P15–P17 security contracts, including:

- HttpOnly cookie session + CSRF/Origin protections;
- RBAC and tenant isolation;
- Turnstile policy;
- destination-risk enforcement and SSRF controls;
- file quarantine/ClamAV state machine;
- secret redaction/write-only secrets;
- audited administrator governance actions;
- no official V5 auth token persistence in Local/Session Storage.

## 9. G7 — SEO / Indexation

P20 must preserve the P18/P19 static artifacts and public indexation policy:

- Website static prerender;
- Docs static output + Pagefind;
- canonical / OG / structured data / sitemap / robots;
- app/admin/auth/install noindex boundary;
- UGC noindex policy;
- no sensitive URL in the sitemap.

## 10. G8 — Visual

P20 consumes the already frozen Design System and P19 Website Final visual contracts. It must not introduce a second palette, placeholder icons, fabricated Dashboard UI, random illustrations or motion that ignores `prefers-reduced-motion`.

## 11. G9 — Performance

The whole-product gate must keep independent builds, route-level split boundaries and static Website/Docs output intact. Website must not import the Workspace/Admin application bundle as its runtime implementation, and continuous marketing motion remains transform/opacity based with reduced-motion fallback.

## 12. G10 — Full-stack P0

P20 must run the existing real integration harness with MySQL + Redis + Go services and cover the authoritative chain represented by the frozen G10 contract:

`Register → verify → login → create link → redirect → analytics → QR → file → text → bio → domain → ticket → billing → admin`.

The existing integration scripts may be reused, but their V4 historical results are not accepted; they must execute against the V5 exact HEAD.

## 13. P20 exit

P20 is COMPLETE only when:

1. complete P01–P19 source/build regression succeeds;
2. complete P04–P19 Browser regression succeeds;
3. Go test/vet succeeds;
4. the real full-stack integration harness succeeds;
5. the closure job confirms the tested commit is still branch exact HEAD;
6. Issue #8 receives immutable exact-HEAD Actions evidence.

Only after that may P21 — Native Package begin.
