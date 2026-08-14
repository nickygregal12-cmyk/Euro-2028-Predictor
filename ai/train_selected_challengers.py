"""Create one evidence-selected challenger per league.

The weekly job used to call `run_leagues.sh train.py --family poisson`, which
necessarily trained the same family and the same 900-day default everywhere.
That ceased to describe the admitted model set once the 14-Aug-2026 guarded
selection study finished. This runner is intentionally boring: it expands the
immutable policy into nine explicit `train_verified.py` invocations and returns
non-zero if any one fails, while still giving every other league its attempt.
The verified entrypoint delegates the statistical work to `train.py` but refuses
the challenger insert unless the freshly reloaded artefact reproduces its
recorded fingerprints/reference oracle.

No provider is called here. The workflow decides whether history needs refreshing
before invoking this runner. Model lifecycle changes are handled elsewhere.
"""
from __future__ import annotations

import argparse
import subprocess
import sys

from challenger_policy import ordered_policy


def command_for(league: str, spec, version: str, python: str = sys.executable) -> list[str]:
    return [python, *spec.train_args(league, version)]


def existing_leagues(version: str) -> set[str]:
    """Leagues already materialised at `version`.

    Used only by bounded/manual materialisation runs. The normal weekly version
    contains a fresh UTC stamp, so it has no reason to open this read before
    training. Keeping the check here rather than in a workflow shell loop makes
    partial retries deterministic and testable.
    """
    from db import connect

    with connect() as conn:
        rows = conn.execute(
            "select league from ai.models where version = %s",
            (version,),
        ).fetchall()
    return {str(row["league"]) for row in rows}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True,
                    help="Version stored on every league's challenger row.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Pass the verified training entrypoint --dry-run so no "
                         "model row/artifact is stored.")
    ap.add_argument("--skip-existing", action="store_true",
                    help="Skip leagues that already have an ai.models row at this version; "
                         "intended for retrying a bounded Development materialisation.")
    args = ap.parse_args()

    already = existing_leagues(args.version) if args.skip_existing else set()
    failed: list[str] = []
    trained: list[str] = []
    skipped: list[str] = []

    for league, spec in ordered_policy():
        if league in already:
            print(f"--- {league}: {args.version} already exists; skipping ---",
                  flush=True)
            skipped.append(league)
            continue

        command = command_for(league, spec, args.version)
        if args.dry_run:
            command.append("--dry-run")
        print("---", " ".join(command[1:]), "---", flush=True)
        completed = subprocess.run(command, check=False)
        if completed.returncode != 0:
            failed.append(league)
        else:
            trained.append(league)

    if failed:
        print(f"selected challenger training failed for: {' '.join(failed)}",
              file=sys.stderr)
        return 1
    print(
        "selected challenger training complete: "
        f"trained={','.join(trained) or 'none'}; "
        f"already-present={','.join(skipped) or 'none'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
