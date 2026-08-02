#!/usr/bin/env python3
"""Exercise the GoJet V4 browser installer and major authenticated surfaces."""

from __future__ import annotations

import argparse
import http.cookiejar
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


TOKEN_PATTERN = re.compile(r'name="_token"\s+value="([^"]+)"')


class Browser:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies)
        )

    def get(self, path: str) -> str:
        return self._open(path, None)

    def post(self, path: str, data: dict[str, str]) -> str:
        payload = urllib.parse.urlencode(data).encode()
        return self._open(path, payload)

    def csrf(self, path: str) -> tuple[str, str]:
        html = self.get(path)
        match = TOKEN_PATTERN.search(html)
        if match is None:
            raise RuntimeError(f"CSRF token missing from {path}\n{html[:2000]}")
        return match.group(1), html

    def _open(self, path: str, payload: bytes | None) -> str:
        url = self.base_url + path
        request = urllib.request.Request(url, data=payload)
        request.add_header("User-Agent", "GoJet-V4-Installer-Test/1.0")
        if payload is not None:
            request.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with self.opener.open(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"HTTP {error.code} for {url}\n{body[:5000]}"
            ) from error


def require(text: str, expected: str, step: str) -> None:
    if expected not in text:
        raise RuntimeError(
            f"Expected {expected!r} during {step}, got:\n{text[:5000]}"
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8090")
    parser.add_argument("--db-host", default="127.0.0.1")
    parser.add_argument("--db-port", default="3306")
    parser.add_argument("--db-name", default="gojet_install_test")
    parser.add_argument("--db-user", default="root")
    parser.add_argument("--db-password", default="root")
    parser.add_argument("--redis-host", default="127.0.0.1")
    parser.add_argument("--redis-port", default="6379")
    parser.add_argument("--admin-path", default=os.environ.get("GOJET_BROWSER_ADMIN_PATH", "manage-e2e"))
    parser.add_argument("--admin-email", default=os.environ.get("GOJET_BROWSER_ADMIN_EMAIL"))
    parser.add_argument("--admin-password", default=os.environ.get("GOJET_BROWSER_ADMIN_PASSWORD"))
    args = parser.parse_args()

    if not args.admin_email or not args.admin_password:
        parser.error("--admin-email and --admin-password are required")

    # The workflow supplies a random secret. Prefixing guaranteed character classes
    # keeps it ephemeral while satisfying Laravel's mixed-case/number/symbol policy.
    admin_password = f"Aa1!{args.admin_password}"
    browser = Browser(args.base_url)

    welcome = browser.get("/install")
    require(welcome, "GoJet", "installer welcome")

    requirements = browser.get("/install/requirements")
    require(requirements, "PHP", "environment requirements")

    token, database_page = browser.csrf("/install/database")
    require(database_page, "Redis", "database form")
    site_page = browser.post(
        "/install/database",
        {
            "_token": token,
            "host": args.db_host,
            "port": args.db_port,
            "name": args.db_name,
            "username": args.db_user,
            "password": args.db_password,
            "redis_host": args.redis_host,
            "redis_port": args.redis_port,
            "redis_password": "",
        },
    )
    require(site_page, "GoJet", "database connection and site form")

    match = TOKEN_PATTERN.search(site_page)
    if match is None:
        raise RuntimeError("CSRF token missing from installer site form")

    completion = browser.post(
        "/install/site",
        {
            "_token": match.group(1),
            "site_name": "GoJet V4 E2E",
            "site_url": args.base_url,
            "site_timezone": "UTC",
            "support_email": "support@gojet.test",
            "default_locale": "en",
            "allow_registration": "1",
            "admin_path": args.admin_path,
            "admin_name": "E2E Administrator",
            "admin_email": args.admin_email,
            "admin_password": admin_password,
            "admin_password_confirmation": admin_password,
            "smtp_host": "",
            "smtp_port": "587",
            "smtp_username": "",
            "smtp_password": "",
            "smtp_scheme": "tls",
            "mail_from_address": "",
        },
    )

    lock_path = Path("storage/app/installed.json")
    if not lock_path.is_file():
        raise RuntimeError(
            "Installer did not create storage/app/installed.json. "
            f"The returned page was:\n{completion[:5000]}"
        )
    require(completion, args.admin_path, "installation completion")
    require(completion, args.admin_email, "administrator summary")

    # A successful installation must expose the normal login surface. If the
    # installer is still active, this request is redirected back to /install.
    login_token, login_page = browser.csrf("/login")
    require(login_page, "Welcome back", "administrator login page")
    dashboard = browser.post(
        "/login",
        {
            "_token": login_token,
            "email": args.admin_email,
            "password": admin_password,
        },
    )
    require(dashboard, "Your links", "administrator dashboard")

    authenticated_pages = [
        "/links",
        "/links/organization",
        "/texts",
        "/files",
        "/profiles",
        "/domains",
        "/workspaces",
        "/sso",
        "/plans",
        "/api-tokens",
        "/webhooks",
    ]
    for path in authenticated_pages:
        require(browser.get(path), "GoJet", f"authenticated page {path}")

    public_pages = [
        "/product",
        "/pricing",
        "/developers",
        "/api-docs",
        "/features/url-shortener",
        "/features/analytics",
        "/features/smart-routing",
        "/features/text-sharing",
        "/features/file-sharing",
        "/features/link-in-bio",
    ]
    for path in public_pages:
        require(browser.get(path), "GoJet", f"public product page {path}")

    administration = browser.get(f"/{args.admin_path}")
    require(administration, "Platform administration", "dynamic administration path")
    require(browser.get(f"/{args.admin_path}/billing"), "GoJet", "billing administration")
    require(browser.get(f"/{args.admin_path}/operations"), "GoJet", "operations administration")
    require(browser.get(f"/{args.admin_path}/diagnostics"), "GoJet", "infrastructure diagnostics")

    print("GoJet V4 browser installation and surface acceptance: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exception:  # noqa: BLE001 - CLI diagnostics must be explicit.
        print(f"GoJet V4 browser installation and surface acceptance: FAIL\n{exception}", file=sys.stderr)
        raise SystemExit(1)
