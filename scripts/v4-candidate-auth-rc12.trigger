V4 RC12 final candidate Auth continuation trigger

Package run: 31474701339
Package tested SHA: ee876bcd598f38660f6a6267298327765fc1fe27
Production ZIP SHA-256: eebcc4a7ecdf13dd3439eaca2509406a3056c0843c8ef8822ad46e81a4b3a896
Base Candidate Retry 2: 31475653144
Base Candidate control SHA: a35214b8419da7e4a5f700525647c5343074e20d

Purpose:
- verify Retry 2 passed every RC12 candidate gate before Auth
- consume the exact same verified RC12 production ZIP
- apply packaged migrations to a fresh Auth database
- start the packaged platform-api with the credentials required by auth-policy.sh
- run the real authentication policy suite
- emit composite final Fresh Install Candidate evidence without rebuilding runtime/package content

Triggered: 2026-08-11 Asia/Singapore
