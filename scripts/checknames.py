#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
files = [p for p in subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0") if p]
bad = [p for p in files if any("-" in part for part in p.split("/"))]
if bad:
    print("Repository path policy violation: hyphen is forbidden in tracked file and directory names.", file=sys.stderr)
    for path in bad:
        print(path, file=sys.stderr)
    raise SystemExit(1)
print(f"Repository path policy: PASS ({len(files)} tracked files, zero hyphenated paths)")
