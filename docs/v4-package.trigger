V4 package/release gate trigger

Browser gate: GREEN
Invoice PDF real render gate: GREEN
Full-stack P0 regression: GREEN
Authentication policy: GREEN
Redirect engine: GREEN
Hardening validation: GREEN
Package target: 4.0.0-rc.11
Purpose: build and independently verify the post-support/Turnstile production fresh-install archive before Fresh Install Candidate acceptance.
Triggered: 2026-08-11 Asia/Singapore
Retry 2: previous build, archive verification, ELF inspection and release evidence all passed; only the stale-branch guard failed because temporary candidate P0 debug workflow files were committed during packaging. Branch is now re-locked for RC11.
