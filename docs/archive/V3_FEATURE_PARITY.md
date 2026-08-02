# GoJet V3 Feature Parity Specification

## Objective

Expand the deployable V2 short-link MVP into a complete, independently implemented link-management and content-sharing platform with broad functional and page-level parity to mature products such as S.EE.

This specification does not authorize copying another product's source code, trademarks, proprietary assets, exact copy, or pixel-identical page designs. GoJet must retain its own branding, content, component system, data model, and implementation.

## Stable baseline

The V2 release at commit `5cff0babfeb8152678a8bbc450893c106eebce80` remains the stable deployment baseline. V3 development occurs on `feature/see-parity` and must preserve:

- Browser installation and installation locking
- Forward-compatible upgrade from a deployed V2 database
- Configurable administration path
- Simplified Chinese and English interfaces
- PHP 8.3 and PHP 8.4 compatibility
- BaoTa/Nginx/PHP-FPM deployment
- Docker Compose deployment
- Redis queues/cache/session support
- Security, abuse reporting and audit foundations

## Cumulative phases

### V3.1 — Advanced link management

- Complete searchable/filterable/paginated links table
- Campaigns, folders, tags and internal notes
- Bulk create, import, export and bulk actions
- UTM builder and reusable presets
- Scheduled activation, expiry, click limits and password controls
- Archive, restore, duplicate and permanent deletion
- Link previews, favicon metadata and health checks
- Dynamic QR generation, customization and PNG/SVG download

### V3.2 — Smart routing and analytics

- Multiple destinations per short link
- Weighted A/B and multivariate distribution
- Country, region and city routing
- Device, operating-system, browser and language routing
- Referrer, query-parameter, date/time and schedule rules
- Rule priority, fallback destination and rule simulator
- Realtime and historical analytics
- Country/city maps, device/browser/OS/language/referrer/UTM reports
- QR scan attribution and bot-filtered totals
- Campaign, domain and workspace analytics

### V3.3 — Text and file sharing

- Plain text, Markdown and syntax-highlighted code sharing
- Visibility, password, expiry and one-time-view controls
- Raw/rendered views, revision history and analytics
- Local and S3-compatible file storage adapters
- R2/S3/MinIO compatibility
- Direct downloads, resumable uploads and signed sessions
- File policy, quotas, retention, analytics and malware-scanner interface

### V3.4 — Link-in-bio/profile pages

- Multiple profile pages per workspace
- List and grid layouts
- Independent GoJet theme library
- Avatar, biography, social links and custom branding
- Drag-and-drop blocks
- Link, heading, text, image, video, embed and contact blocks
- Scheduling, custom domains and page analytics
- Pluggable RSS/GitHub/Mastodon/X/video feed adapters

### V3.5 — Workspaces, teams, plans and quotas

- Personal and team workspaces
- Invitations and member lifecycle
- Owner/admin/editor/analyst/viewer roles
- Resource transfer and workspace switching
- Configurable plans and feature flags
- Quotas for links, texts, QR, files, storage, domains, profiles, members and API
- Billing-provider abstraction with safe manual/disabled default mode
- Subscription lifecycle, invoices, coupons, grace periods and administrator overrides

### V3.6 — Developer, administration and public pages

- Versioned REST API covering every product resource
- Scoped tokens, rate limits and token activity
- Signed webhooks, retries and delivery logs
- OpenAPI schema and bilingual API documentation
- User/workspace/plan/subscription administration
- Moderation for links, text, files, profiles and domains
- Queue, scheduler, Redis, storage, SMTP and Cloudflare diagnostics
- Site settings, legal content, branding, mail templates and feature switches
- Complete bilingual product, solution, pricing, FAQ, blog/changelog, status and legal pages

### V3.7 — Release hardening

- Clean browser installation acceptance
- In-place V2-to-V3 upgrade acceptance
- PHP 8.3/8.4 validation
- BaoTa and Docker production validation
- Responsive desktop/tablet/mobile browser acceptance
- Security and abuse-resistance review
- Backup, restore and rollback procedures
- Checksummed upgrade and clean-install deployment packages

## Release rules

1. Every phase is cumulative and contains all earlier accepted work.
2. Production database updates use forward migrations; no destructive reset is allowed.
3. Every production page must be complete in Simplified Chinese and English.
4. Each phase requires automated tests and browser acceptance before packaging.
5. Test or production credentials must never enter Git history, CI logs or fixtures.
6. A phase is not complete merely because routes or placeholder pages exist.
7. Final acceptance requires both a clean install and an upgrade from the deployed V2 baseline.
