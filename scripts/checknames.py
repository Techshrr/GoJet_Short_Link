#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
files = [p for p in subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0") if p]


def invalid_component(component: str) -> bool:
    if "-" in component:
        return True
    # Go's test discovery requires the literal *_test.go suffix. Keep that
    # toolchain-owned separator, but project-defined test prefixes must still
    # be connector free (billing_pdf_test.go is invalid; billingpdf_test.go is valid).
    if component.endswith("_test.go"):
        return "_" in component[:-len("_test.go")]
    return "_" in component


bad = [p for p in files if any(invalid_component(part) for part in p.split("/"))]
if bad:
    print(
        "Repository path policy violation: project-defined hyphen/underscore connectors are forbidden; only Go's required *_test.go suffix is allowed.",
        file=sys.stderr,
    )
    for path in bad:
        print(path, file=sys.stderr)
    raise SystemExit(1)
print(
    f"Repository path policy: PASS ({len(files)} tracked files, zero project-defined hyphen/underscore connectors; Go *_test.go suffix allowed)"
)
