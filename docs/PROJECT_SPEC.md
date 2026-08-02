# GoJet Project Specification

## Product objective

GoJet is a modern short-link platform centered on `gojet.cc`, with an optional compliant domestic presentation site on `gojet.cn`. The international application provides link management, redirect service, analytics, API access, and custom domains.

## Phase 0–5 cumulative delivery

| Phase | Scope | Acceptance signal |
|---|---|---|
| 0 | Governance, architecture, schema, security, deployment foundation | Documentation and base project bootstrapping exist |
| 1 | Public UI, authentication, dashboard, administration shell | User can register, authenticate, and access protected UI |
| 2 | Link lifecycle and redirect engine | User can create and resolve a short link |
| 3 | Queued click analytics and daily aggregates | Redirect produces an event without blocking the response |
| 4 | Bearer-token API and custom domains | API CRUD and DNS verification work |
| 5 | Security hardening, tests, installers, CI, backup/update/self-check | Both deployment methods pass documented acceptance checks |

## Product rules

- Anonymous shortening is disabled by default.
- Registration is configurable.
- Malicious, deceptive, credential-stealing, malware, and policy-violating destinations may be blocked.
- Short codes are unique within a hostname.
- Custom domains require ownership verification.
- Raw IP addresses are never stored; a keyed hash is used for privacy-preserving uniqueness estimates.
- Original click events have a configurable retention period; aggregates may be retained longer.
