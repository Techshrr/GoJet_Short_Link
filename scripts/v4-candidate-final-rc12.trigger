V4 RC12 final fresh-install candidate trigger

Package/release gate: GREEN
Package workflow run: 31474701339
Package tested SHA: ee876bcd598f38660f6a6267298327765fc1fe27
Package version: 4.0.0-rc.12
Production ZIP SHA-256: eebcc4a7ecdf13dd3439eaca2509406a3056c0843c8ef8822ad46e81a4b3a896
Package artifact: gojet-4.0.0-rc.12-package-release

Candidate policy:
- consume the exact verified RC12 Package artifact; do not rebuild production binaries
- allow only the RC12 Candidate workflow and this trigger after the Package-tested SHA
- apply packaged migrations to independent fresh databases
- execute settings, QR, protected files, isolated system images, branded SMTP/mail lifecycle, billing conflict and USD FX freeze against packaged runtime binaries
- execute support tickets, central Turnstile secret boundary, public abuse intake and authentication policy
- upload the exact same RC12 production ZIP plus candidate evidence only if every gate passes

Triggered: 2026-08-11 Asia/Singapore
