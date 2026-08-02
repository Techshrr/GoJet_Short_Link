# Changelog

## Unreleased

- Reconstructed the missing Go redirect-plane source with Redis lookup caching, control-plane fallback, fsync-backed durable click spooling, idempotent delivery, health reporting, graceful shutdown, and automated Go tests.
- Restored repository-level tests, CI validation, and install/upgrade/rollback entrypoints that had been excluded from the received production archive.

## [Unreleased]

### Added

- Laravel 13 application foundation
- Authentication, dashboard, link management and redirect engine
- Redis-compatible cache and queued click analytics
- Daily click aggregates with privacy-preserving IP hashes
- Custom-domain DNS verification
- Hashed bearer API tokens and v1 link API
- Abuse reporting and administration overview
- Docker Compose and traditional Linux deployment
- Installation self-check, update, backup and health scripts
- GitHub Actions CI and automated feature/unit tests
