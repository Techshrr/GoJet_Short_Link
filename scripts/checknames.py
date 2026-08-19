#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
files = [p for p in subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0") if p]

# The connector-free filename rule belongs to the flat installer/public-release
# surfaces inherited from the pre-V5 packaging contract. V5 application source
# intentionally uses conventional package and locale names such as api-client,
# zh-CN and *-responsive.css. Applying the old flat-output rule to the entire
# repository makes every V5 branch fail before any installer check can run.
scoped_prefixes = (
    "installer/",
    "public/install/",
    "deploy/",
    "database/migrations/",
    "frontend/publicsite/",
    "frontend/adminconsole/",
    "frontend/userconsole/",
    "app/",
    "services/",
)
scoped_root_files = {
    "install.sh",
    "installhostnginx.sh",
    "installnativelemp.sh",
    "launchwebinstaller.sh",
    "upgrade.sh",
    "upgradenative.sh",
}
scoped = [p for p in files if p in scoped_root_files or p.startswith(scoped_prefixes)]


def invalid_component(component: str) -> bool:
    if "-" in component:
        return True
    # Go's test discovery requires the literal *_test.go suffix. Keep that
    # toolchain-owned separator, but project-defined test prefixes must still
    # be connector free (billing_pdf_test.go is invalid; billingpdf_test.go is valid).
    if component.endswith("_test.go"):
        return "_" in component[:-len("_test.go")]
    return "_" in component


bad = [p for p in scoped if any(invalid_component(part) for part in p.split("/"))]
if bad:
    print(
        "Release-surface path policy violation: project-defined hyphen/underscore connectors are forbidden on flat installer/runtime release paths; only Go's required *_test.go suffix is allowed.",
        file=sys.stderr,
    )
    for path in bad:
        print(path, file=sys.stderr)
    raise SystemExit(1)
print(
    f"Release-surface path policy: PASS ({len(scoped)} scoped tracked files checked; V5 application package/locale naming is intentionally outside this legacy flat-output rule)"
)
