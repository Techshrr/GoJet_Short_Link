#!/usr/bin/env python3
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
migration_dir = root / "database" / "migrations"
files = sorted(migration_dir.glob("*.sql"))
if not files:
    raise SystemExit("no database migrations found")

expected_prefixes = [f"{i:03d}" for i in range(1, len(files) + 1)]
actual_prefixes = []
filename_re = re.compile(r"^(\d{3})([a-z0-9]+)\.sql$")
identifier_re = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")

for path in files:
    match = filename_re.fullmatch(path.name)
    if not match:
        raise SystemExit(f"migration filename is not canonical: {path.name}")
    actual_prefixes.append(match.group(1))
if actual_prefixes != expected_prefixes:
    raise SystemExit(
        "migration sequence must be contiguous: "
        + ", ".join(actual_prefixes)
    )

violations = []
tables = set()
columns = set()
indexes = set()
constraints = set()


def check(kind: str, identifier: str, source: str) -> None:
    identifier = identifier.strip("` ")
    if identifier.upper() == "PRIMARY":
        return
    if not identifier_re.fullmatch(identifier):
        violations.append(f"{source}: {kind} '{identifier}' is not lower_snake_case")


create_re = re.compile(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?", re.I)
alter_re = re.compile(r"\bALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?", re.I)
# KEY is also SQL syntax in expressions such as ON DUPLICATE KEY UPDATE. Only
# table-definition lines beginning with KEY/UNIQUE KEY declare an index.
index_decl_re = re.compile(r"^\s*(?:UNIQUE\s+)?KEY\s+`?([A-Za-z0-9_]+)`?", re.I | re.M)
create_index_re = re.compile(r"\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([A-Za-z0-9_]+)`?", re.I)
constraint_re = re.compile(r"^\s*CONSTRAINT\s+`?([A-Za-z0-9_]+)`?", re.I | re.M)

for path in files:
    text = path.read_text(encoding="utf-8")
    for match in create_re.finditer(text):
        name = match.group(1)
        check("table", name, path.name)
        tables.add(name)
    for match in alter_re.finditer(text):
        check("altered table", match.group(1), path.name)
    for regex in (index_decl_re, create_index_re):
        for match in regex.finditer(text):
            name = match.group(1)
            check("index", name, path.name)
            indexes.add(name)
    for match in constraint_re.finditer(text):
        name = match.group(1)
        check("constraint", name, path.name)
        constraints.add(name)

    # Column declarations in this project are one-per-line inside CREATE TABLE.
    # Parse only declaration-looking lines and skip table-level clauses.
    in_create = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if create_re.search(line):
            in_create = True
            continue
        if in_create and line.startswith(")"):
            in_create = False
            continue
        if not in_create or not line or line.startswith("--"):
            continue
        upper = line.upper()
        if upper.startswith(("PRIMARY ", "UNIQUE ", "KEY ", "CONSTRAINT ", "FOREIGN ", "CHECK ", "FULLTEXT ", "SPATIAL ")):
            continue
        token = line.split(None, 1)[0].rstrip(",").strip("`")
        if token and re.fullmatch(r"[A-Za-z0-9_]+", token):
            check("column", token, path.name)
            columns.add(token)

if violations:
    print("Database schema naming violations:", file=sys.stderr)
    for violation in violations:
        print(violation, file=sys.stderr)
    raise SystemExit(1)

print(
    f"Database schema source naming: PASS ({len(files)} migrations, "
    f"{len(tables)} tables, {len(columns)} column names, "
    f"{len(indexes)} index names, {len(constraints)} constraint names; lower_snake_case)"
)
