# GoJet V5 P22 Fresh Install Candidate Gate Contract

> Executable acceptance companion for GJ-V5-001 P22 / G12–G13. This document does not override the frozen V5 specification; conflicts are resolved by `GoJet_V5_MASTER_PLAN.md`.

## Input invariant

P22 may consume only the immutable P21 / G11 Native artifact produced for the exact same Git commit SHA. Rebuilding a production package from the checkout inside P22 is not acceptance evidence.

## G12 — Fresh Install

The Gate provisions a clean aaPanel/BT-compatible Native host contract and requires:

- Nginx;
- PHP 8.3 + PHP-FPM + PDO MySQL;
- MySQL 8.x;
- authenticated Redis;
- systemd;
- ClamAV daemon + Unix socket;
- `/www/wwwroot/<host>/public` runtime directory and aaPanel vhost/rewrite paths;
- HTTPS before entering `/install/`;
- the four-step Web Installer: environment → MySQL/Redis → site/admin → install;
- installer completion lock and the eight installed Go systemd services.

A source-tree development server, Docker/Compose environment, PM2, Node runtime, direct migration shortcut, or hand-written `gojet.env` is not a substitute for G12.

## G13 — Production Validation

Validation runs against the G12-installed product and requires:

- all eight Go systemd services survive restart;
- Nginx survives restart and continues serving the five production surfaces;
- Redis and MySQL restart/reconnect successfully;
- real ClamAV EICAR detection;
- real QR PNG generation, decode, redirect, and QR analytics persistence;
- real file upload/download lifecycle;
- real invoice PDF generation, Chinese text extraction, embedded logo, and raster render;
- real SMTP transport through the installed mail path;
- OAuth provider production redirect/security contracts plus public provider TLS reachability;
- Cloudflare Turnstile through the production Siteverify endpoint using Cloudflare's official CI-only test credentials;
- signed Epay-compatible production callback/return contract.

External test credentials used by CI must be vendor-provided testing credentials and must never be written into the production artifact.

## Authoritative closure

P22 can mutate Issue #8 to COMPLETE only when:

1. P17, P20/G0–G10, and P21/G11 have successful exact-head evidence for the tested SHA;
2. G12 and G13 both succeed;
3. the V5 branch HEAD still equals the tested SHA;
4. the P22 evidence artifact is uploaded for that SHA.

If the branch moves or any prerequisite/Gate fails, the run must not check P22 or claim Final/Production Candidate status.
