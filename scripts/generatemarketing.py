#!/usr/bin/env python3
"""Compatibility entry point for rebuilding GoJet public marketing pages.

The legacy generator used its own navigation, product-only stylesheet and
engineering-oriented copy. That made a manual regeneration silently reintroduce
an older visual system. Keep this filename for existing operator habits, but
route every rebuild through the same canonical builders used by Browser and
Package gates.
"""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
for script in ('rebuild-public-product-pages.py', 'rebuild-marketing-pages.py'):
    subprocess.run([sys.executable, str(ROOT / 'scripts' / script)], cwd=ROOT, check=True)
print('GoJet canonical marketing pages validated/rebuilt successfully.')
