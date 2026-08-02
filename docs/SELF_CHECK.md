# Installation Self-check

Run:

```bash
php artisan gojet:check
```

For automation:

```bash
php artisan gojet:check --json
```

The command validates:

- PHP version and required extensions
- application key and production debug mode
- writable Laravel storage paths
- database connectivity and migration state
- Redis connectivity when Redis-backed cache, queues, or sessions are configured
- queue configuration
- application URL and HTTPS posture
- GoJet IP hash secret

Exit code `0` means ready. A non-zero exit code means at least one required check failed. Warnings do not fail the command but must be reviewed before production launch.
