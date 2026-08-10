V4 fresh-install RC10 candidate trigger

Package/release gate: GREEN
Package workflow run: 31421124096
Package artifact id: 9075404402
Package tested SHA: 5f5282e8e329c5c38b91733de379d1666f7014bd
Package version: 4.0.0-rc.10
Production ZIP SHA-256: 6bcefc6b0160ca67b92c05d98866d4868ba8492605baaf624de3faed12b55c6c

Candidate policy:
- consume the exact verified Package artifact; do not rebuild production binaries
- allow only candidate workflow/trigger changes after the Package-tested SHA
- apply packaged migrations to independent fresh databases
- execute P0 acceptance against packaged runtime binaries
- execute real support-ticket, central Turnstile-settings and public-abuse API acceptance
- execute authentication policy against packaged runtime
- upload the exact same RC10 ZIP plus candidate evidence only if every gate passes

Triggered: 2026-08-11 Asia/Singapore
