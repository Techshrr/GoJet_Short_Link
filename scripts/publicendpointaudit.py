#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
client = (ROOT / "frontend/apps/site/src/routes/ReportAbusePage.tsx").read_text(encoding="utf-8")
match = re.search(r'fetch\("(/api/[^"\n]*abuse-reports)"', client)
if not match:
    raise SystemExit("ReportAbusePage does not call a public abuse-report API endpoint")
endpoint = match.group(1)
server_text = "\n".join(
    file.read_text(encoding="utf-8", errors="replace")
    for file in (ROOT / "services/platformapi/cmd/server").glob("*.go")
)
if endpoint not in server_text:
    print(f"Public abuse-report form calls {endpoint}, but the platform API does not register that path.", file=sys.stderr)
    candidates = sorted(set(re.findall(r'[/]api[/][A-Za-z0-9_{}./-]*abuse[A-Za-z0-9_{}./-]*', server_text)))
    if candidates:
        print("Server abuse-related routes: " + ", ".join(candidates), file=sys.stderr)
    raise SystemExit(1)

# The request must remain protected against unauthenticated form abuse.
if 'turnstile_token' not in client or 'surface="abuse"' not in client:
    raise SystemExit("Public abuse-report form is missing its Turnstile contract")

print(f"PUBLIC_ENDPOINT_AUDIT=PASS ({endpoint})")
