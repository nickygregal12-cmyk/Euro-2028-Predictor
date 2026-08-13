"""Create one evidence-selected challenger per league, and promote none of them.

The weekly job used to call `run_leagues.sh train.py --family poisson`, which
necessarily trained the same family and the same 900-day default everywhere.
That ceased to describe the admitted model set once the 14-Aug-2026 guarded
selection study finished. This runner is intentionally boring: it expands the
immutable policy into nine explicit `train.py` invocations and returns non-zero
if any one fails, while still giving every other league its attempt.

No provider is called here. The workflow decides whether history needs refreshing
before invoking this runner. No promotion command exists here either.
"""
from __future__ import annotations

import argparse
import subprocess
import sys

from challenger_policy import ordered_policy


def command_for(league: str, spec, version: str, python: str = sys.executable) -> list[str]:
    return [python, *spec.train_args(league, version)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True,
                    help="Version stored on every league's challenger row.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Pass train.py --dry-run so no model row/artifact is stored.")
    args = ap.parse_args()

    failed: list[str] = []
    for league, spec in ordered_policy():
        command = command_for(league, spec, args.version)
        if args.dry_run:
            command.append("--dry-run")
        print("---", " ".join(command[1:]), "---", flush=True)
        completed = subprocess.run(command, check=False)
        if completed.returncode != 0:
            failed.append(league)

    if failed:
        print(f"selected challenger training failed for: {' '.join(failed)}",
              file=sys.stderr)
        return 1
    print("selected challenger training completed for all nine leagues")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
