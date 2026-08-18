# P17 Admin Contract

Status target: P17 acceptance gate for `rebuild/v5-specification-rebuild`.

## Frozen Admin information architecture

P17 completes every V5 AdminShell destination that was still a placeholder after P16: Overview; Users, Workspaces and Memberships; Links, Domains, QR Codes, Files, Text and Bio Pages; Announcements, Jobs and Services; Administrators, Roles and Permissions; General, Official Domains, Turnstile, Storage and Integrations. P13–P16 Commerce, Support/Mail, Auth/OAuth and Trust & Safety pages remain their accepted implementations and are regression-tested rather than duplicated.

All inventory and governance tables use the shared compact Admin DataTable pattern. Dangerous user and resource status actions require a reason in the browser and at the server trust boundary. Authorization remains enforced by the existing Admin RBAC middleware.

## Storage and service truth

`GET /api/admin/storage` exposes the effective startup-validated storage backend, non-secret filesystem/S3 location metadata, namespaces, temporary/quarantine paths and credential-configured booleans. It never returns an S3 access key or secret key. Storage driver/credential changes remain deployment-owned and are not falsely presented as hot-editable runtime settings.

`GET /api/admin/services` enumerates all eight expected Go services. The serving `platformapi` instance may report healthy with direct request evidence; a service without a trustworthy heartbeat reports `unknown / no heartbeat signal`. P17 does not synthesize green health states.

## Integrations

Platform API keys are generated from cryptographic randomness. Plaintext is returned only by the create response, while MySQL stores only a SHA-256 token hash plus a non-secret prefix and metadata. Revocation requires a reason and is audited. The API-key authenticated `/api/v1/integration/ping` route proves the credential is usable.

Webhooks store only a reference to an AES-GCM encrypted sensitive setting. Creation returns the secret once; list/update responses do not return plaintext. Test delivery requires a reason, signs the request with HMAC-SHA256, limits redirects/timeouts/body reads and rejects loopback, private, link-local, multicast and unspecified targets both during URL validation and network dialing to mitigate SSRF and DNS rebinding.

## Gate

P17 can be marked `DONE` only after the exact branch HEAD passes the complete P01–P16 browser regression set, strict frontend static/type/build checks, Go platform API tests, P17 migration/security verification and the P17 desktop/tablet/mobile Admin browser suite. Capability Matrix and Issue #8 are closed only on a later exact HEAD that contains the P17 evidence and itself re-passes this gate.
