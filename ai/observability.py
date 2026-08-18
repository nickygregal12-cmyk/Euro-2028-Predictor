"""Local AI Lab monitoring utilities powered by optional Evidently extras.

Nothing in this module uploads data or starts a hosted service.  It consumes
point-in-time CSV extracts supplied by an operator and writes local HTML/JSON
reports.  The caller is responsible for producing leakage-safe extracts from
existing AI Lab authorities.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import pandas as pd


def _select_columns(reference: pd.DataFrame, current: pd.DataFrame,
                    columns: Iterable[str] | None) -> tuple[pd.DataFrame, pd.DataFrame]:
    if columns is None:
        common = [column for column in reference.columns if column in current.columns]
    else:
        common = [column for column in columns if column]
    if not common:
        raise ValueError("reference and current datasets have no selected columns in common")
    missing_reference = [column for column in common if column not in reference.columns]
    missing_current = [column for column in common if column not in current.columns]
    if missing_reference or missing_current:
        raise ValueError(
            f"selected columns missing: reference={missing_reference}, current={missing_current}")
    return reference[common].copy(), current[common].copy()


def build_drift_report(reference: pd.DataFrame, current: pd.DataFrame,
                       output_html: str | Path,
                       columns: Iterable[str] | None = None) -> dict:
    """Create a data-drift report and a JSON sidecar, returning its dictionary."""
    try:
        from evidently import Report  # type: ignore
        from evidently.presets import DataDriftPreset  # type: ignore
    except ImportError as exc:  # pragma: no cover - exercised by operator path
        raise RuntimeError(
            "Evidently is optional. Run scripts/agent-tools/ai-sync.sh observability first."
        ) from exc

    reference, current = _select_columns(reference, current, columns)
    report = Report([DataDriftPreset(method="psi")], include_tests=True)
    evaluation = report.run(current, reference)

    html_path = Path(output_html)
    html_path.parent.mkdir(parents=True, exist_ok=True)
    evaluation.save_html(str(html_path))

    payload = evaluation.dict()
    json_path = html_path.with_suffix(".json")
    import json
    json_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    return payload


def _parse_columns(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [part.strip() for part in value.split(",") if part.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AI Lab local observability tools")
    sub = parser.add_subparsers(dest="command", required=True)

    drift = sub.add_parser("drift", help="compare current feature data with a reference window")
    drift.add_argument("--reference", required=True, help="reference CSV path")
    drift.add_argument("--current", required=True, help="current CSV path")
    drift.add_argument("--output", required=True, help="HTML report path")
    drift.add_argument(
        "--columns",
        help="optional comma-separated feature subset; default is every shared column",
    )

    args = parser.parse_args(argv)
    if args.command == "drift":
        reference = pd.read_csv(args.reference)
        current = pd.read_csv(args.current)
        build_drift_report(
            reference,
            current,
            args.output,
            columns=_parse_columns(args.columns),
        )
        print(f"wrote Evidently drift report to {args.output}")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
