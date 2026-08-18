"""Refuse to run if anything in this package writes outside schema `ai`.

The lab may now be pointed at a hosted project that carries real
competitions, real entries and real player predictions. What makes that
defensible is not that the code currently happens to write only to `ai`: it is
that a run cannot start unless that is still true.

ADR 0029 gives schema `ai` no authority over platform fixtures, official
results, scoring, locks, standings, progression, memberships or player
predictions. A single `update public.season_fixtures` slipping into this
package would silently convert an analytical subsystem into one that can move
a settled score, and the first evidence would be a player's points changing.

So this reads the package's own source, finds every write statement, and
requires each to name a relation in `ai`. It runs before the database
credential is resolved, so a package that fails it never learns the URL.

It is deliberately a source check rather than a database grant: a grant is the
right second line, but it lives in the environment being protected, and the
whole point is to decide before connecting to it.
"""
from __future__ import annotations

import re
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# `insert into X`, `update X`, `delete from X`, and the DDL a lab job has no
# business issuing at all. Whitespace is collapsed first so a statement broken
# across lines reads the same as one that is not.
WRITE = re.compile(
    r"\b(insert\s+into|update|delete\s+from|drop\s+table|truncate|alter\s+table)\s+"
    r"([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)",
    re.IGNORECASE,
)

# `update` also appears as the tail of `insert ... on conflict do update set`,
# where the target is the one already named by the insert.
CONFLICT_TAIL = re.compile(r"do\s+update\s+set", re.IGNORECASE)

ALLOWED_SCHEMA = "ai"

# Tests build a disposable database from scratch, including the public tables
# the migration references. They never touch a hosted project: the lifecycle
# suite refuses to run at all unless TEST_DATABASE_URL is set.
EXCLUDED = {"check_write_scope.py"}
EXCLUDED_DIRECTORIES = {".venv", "__pycache__"}


def _string_literals(path: Path) -> list[str]:
    """Every string literal in a file, comments and code excluded."""
    out: list[str] = []
    with path.open("rb") as handle:
        for token in tokenize.tokenize(handle.readline):
            if token.type == tokenize.STRING:
                out.append(token.string)
    return out


def violations() -> list[str]:
    found: list[str] = []
    # Recursive. This used to glob `*.py`, which covered every file in the
    # package for as long as the package was flat — and stopped covering it the
    # moment one subdirectory appeared. A guard whose reach depends on nobody
    # ever adding a subpackage is a guard with an expiry date nobody wrote
    # down, and the failure is silent: code in `ai/anything/` would simply not
    # be read.
    for path in sorted(ROOT.rglob("*.py")):
        relative = path.relative_to(ROOT)
        if (
            path.name in EXCLUDED
            or path.name.startswith("test_")
            or any(part in EXCLUDED_DIRECTORIES for part in relative.parts)
        ):
            continue
        for literal in _string_literals(path):
            collapsed = " ".join(literal.split())
            for match in WRITE.finditer(collapsed):
                verb, target = match.group(1), match.group(2)
                if verb.lower() == "update" and CONFLICT_TAIL.search(
                        collapsed[max(0, match.start() - 12):match.end()]):
                    continue
                if "." not in target:
                    found.append(
                        f"{relative}: `{verb} {target}` names no schema — "
                        f"say `{ALLOWED_SCHEMA}.{target}` so the target cannot "
                        f"depend on a search_path")
                elif target.split(".", 1)[0].lower() != ALLOWED_SCHEMA:
                    found.append(f"{relative}: `{verb} {target}` writes "
                                 f"outside schema {ALLOWED_SCHEMA}")
    return found


def main() -> int:
    found = violations()
    if found:
        print("The AI Lab package may only write to schema "
              f"`{ALLOWED_SCHEMA}`. Refusing to run:\n", file=sys.stderr)
        for line in found:
            print(f"  {line}", file=sys.stderr)
        print("\nIf a platform table genuinely needs writing, it does not "
              "belong in this package.", file=sys.stderr)
        return 1
    print(f"Write scope verified: every write in ai/ names schema "
          f"`{ALLOWED_SCHEMA}`.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
