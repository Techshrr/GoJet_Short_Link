# GoJet V5 — P21 Native Package Contract

**Status:** FROZEN EXECUTION CONTRACT  
**Phase:** P21 — Native Package / G11 Package Gate  
**Parent:** GJ-V5-001 > GJ-V5-002 > GJ-V5-003  
**Prerequisite:** P20 exact-head success

## 1. Purpose

P21 produces the first authoritative V5 Native Linux release artifact. It packages the already accepted V5 product; it does not replace P20 and does not claim P22 Fresh Install, G12 Fresh Install or G13 Production Validation.

The authoritative production shape remains Nginx + PHP 8.3 installer + MySQL 8.x + authenticated Redis + Go binaries + systemd (+ ClamAV when Files are enabled). Node/pnpm are build/package tooling only.

## 2. Trigger and exact-head rule

P21 may run only after `V5 P20 Whole Product Gate` completes successfully. The P21 workflow must package `workflow_run.head_sha`, then verify that SHA is still the exact HEAD of `rebuild/v5-specification-rebuild` before publishing completion evidence.

A historical P20 run, V4 release artifact, Docker image, or package assembled from a different commit is not accepted.

## 3. G11 required payload

The Native archive must contain all of the following:

- `bin/`: exactly the eight production Go runtime commands required by V5;
- `database/migrations/` including the canonical `migrationcatalog.txt` and every catalogued SQL migration;
- `public/`: built Website/Auth output plus `/docs`, `/app`, `/admin`, and `/install`;
- `installer/` and the Native installer/runtime service assets;
- `deploy/native/` and `deploy/nginx/`;
- Native-only top-level `install.sh` and the installer/migration/GeoIP scripts it invokes;
- `MANIFEST.sha256` covering package files;
- `SBOM.cdx.json` in CycloneDX 1.5 JSON form;
- `VERSION-MANIFEST.json` binding product/version/platform/Git SHA and the eight runtime commands;
- an external SHA-256 checksum for the `.tar.gz` archive.

## 4. V5 release normalization

The release staging step must remove V4-only deployment behavior from the Native artifact:

- no `--docker` installer path;
- no Dockerfile / Compose / PM2 / production Node runtime;
- no `frontend/userconsole` or `frontend/adminconsole`;
- no `node_modules` or frontend source tree;
- Redis password is required by the staged Native installer and example environment;
- Admin post-install static validation targets V5 Vite SPA `index.html` and hashed `/admin/assets/*`, not V4 `/admin/styles.css`, `/admin/app.js` or `loginForm`;
- PDF font dependency uses the Debian `fonts-noto-cjk` system font path rather than an unshipped repository font blob.

These transformations are release hardening rules and are verified by G11. P22 must still prove them on a fresh aaPanel host.

## 5. Package Gate

G11 fails unless all of the following are true:

1. all eight binaries exist and are executable;
2. every migration listed in the catalog exists in the archive;
3. Website/Auth, Docs, Workspace and Admin built outputs exist, including V5 hashed SPA assets;
4. installer + Native/systemd/Nginx assets exist;
5. `MANIFEST.sha256` verifies without error;
6. `SBOM.cdx.json` and `VERSION-MANIFEST.json` parse and identify the exact tested Git SHA;
7. archive checksum verifies;
8. forbidden V4/Docker/Node-production assets are absent;
9. staged installer requires authenticated Redis and contains no V4 Admin static checks.

## 6. P21 exit

P21 is COMPLETE only after the exact-head P20 success that triggered it and a successful G11 package run on that same SHA. The package artifact and checksum are CI evidence. P22 remains unchecked and unstarted until a later fresh-host install candidate is executed.
