V4 package/release gate trigger

RC12 real-install fix validation:
- Browser gate: GREEN
- Invoice PDF real render gate: GREEN
- Full-stack P0 regression: GREEN
- Authentication policy: GREEN
- Redirect engine: GREEN
- Hardening validation: GREEN

Package target: 4.0.0-rc.12
Purpose: build and independently verify the production fresh-install archive after aaPanel real-install fixes for settings persistence, SMTP feedback, system/generated/user resource isolation, USD-base FX, canonical public/legal pages, unified mail fragments, PHP extension checks and open_basedir-safe ClamAV detection.

Policy:
- package the current hardening snapshot only
- run go test/vet and build all eight Linux services
- run base + hardening archive verifiers
- verify ZIP integrity, SHA-256, FRESH_INSTALL_ONLY and eight x86-64 ELF binaries
- refuse runtime/package changes after the snapshot is locked
- only a successful RC12 artifact may enter Fresh Install Candidate acceptance

Triggered: 2026-08-11 Asia/Singapore