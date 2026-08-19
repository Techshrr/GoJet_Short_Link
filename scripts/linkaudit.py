#!/usr/bin/env python3
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "frontend/apps/site/dist"
DOCS = ROOT / "frontend/apps/docs/dist"

DYNAMIC_PREFIXES = (
    "/app", "/admin", "/api/", "/t/", "/p/", "/f/",
)
DYNAMIC_EXACT = {
    "/login", "/login/", "/register", "/register/", "/verify-email", "/verify-email/",
    "/forgot-password", "/forgot-password/", "/reset-password", "/reset-password/",
    "/reportabuse", "/reportabuse/",
}

class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in {"a", "link", "script", "img"}:
            return
        names = {"a": "href", "link": "href", "script": "src", "img": "src"}
        wanted = names[tag]
        for key, value in attrs:
            if key == wanted and value:
                self.links.append(value)


def html_files(base: Path):
    if not base.exists():
        raise SystemExit(f"missing generated tree: {base}")
    yield from base.rglob("*.html")


def site_target(url_path: str) -> bool:
    if url_path in DYNAMIC_EXACT or any(url_path.startswith(p) for p in DYNAMIC_PREFIXES):
        return True
    if url_path == "/docs" or url_path.startswith("/docs/"):
        docs_path = url_path.removeprefix("/docs") or "/"
        return docs_target(docs_path)
    clean = url_path.split("?", 1)[0]
    if clean == "/":
        return (SITE / "index.html").is_file()
    relative = clean.lstrip("/")
    candidates = [SITE / relative, SITE / f"{relative}.html", SITE / relative / "index.html"]
    return any(candidate.is_file() for candidate in candidates)


def docs_target(url_path: str) -> bool:
    clean = url_path.split("?", 1)[0]
    if clean in {"", "/"}:
        return (DOCS / "index.html").is_file()
    relative = clean.lstrip("/")
    candidates = [DOCS / relative, DOCS / f"{relative}.html", DOCS / relative / "index.html"]
    return any(candidate.is_file() for candidate in candidates)


def normalize_local(raw: str) -> str | None:
    if raw.startswith(("mailto:", "tel:", "javascript:", "data:", "#")):
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        if parsed.netloc not in {"gojet.cc", "www.gojet.cc"}:
            return None
        return parsed.path or "/"
    return parsed.path or None

failures: list[str] = []
for base, kind in [(SITE, "site"), (DOCS, "docs")]:
    for file in html_files(base):
        parser = Links()
        parser.feed(file.read_text(encoding="utf-8", errors="replace"))
        for raw in parser.links:
            local = normalize_local(raw)
            if not local:
                continue
            if local.startswith("/assets/") or local.startswith("/_astro/"):
                # Asset fingerprints are checked by the browser/build pipeline.
                continue
            ok = site_target(local) if kind == "site" else (site_target(local) if local.startswith(("/app", "/admin", "/login", "/register", "/legal/", "/report")) else docs_target(local.removeprefix("/docs")))
            if not ok:
                failures.append(f"{file.relative_to(ROOT)} -> {raw}")

# Directly require the high-risk routes that previously returned 404.
for route in [
    "/legal/privacy/", "/legal/terms/", "/legal/acceptable-use/", "/report-abuse/", "/reportabuse/",
    "/zh-CN/legal/privacy/", "/zh-CN/legal/terms/", "/zh-CN/legal/acceptable-use/",
]:
    if not site_target(route):
        failures.append(f"required route missing: {route}")
for route in ["/", "/zh-CN/"]:
    if not docs_target(route):
        failures.append(f"required docs locale missing: /docs{route}")

if (DOCS / "zh-cn").exists():
    failures.append("duplicate docs locale exists: /docs/zh-cn/")
if (SITE / "dev").exists():
    failures.append("internal design route exists: /dev/")

if failures:
    print(f"LINK_ROUTE_AUDIT failed with {len(failures)} broken or forbidden route(s):", file=sys.stderr)
    for failure in failures[:300]:
        print(f" - {failure}", file=sys.stderr)
    raise SystemExit(1)

print("LINK_ROUTE_AUDIT=PASS")
