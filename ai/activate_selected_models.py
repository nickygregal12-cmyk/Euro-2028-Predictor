"""Make the verified selected model set current, atomically and fail-closed.

The model research authority chooses exactly one admitted configuration per league
in ``challenger_policy.py``. Training still writes those rows as ``challenger``
so an incomplete or non-reproducible run can never displace a working model.
After *all nine* selected rows pass the policy, artefact, training-data,
semantic-contract and reference-oracle checks, this module crosses the lifecycle
boundary in one database transaction.

Owner decision, 15-Aug-2026: the verified selected winner should provide the
predictions automatically. The browser/admin UI is not a second selection
authority.

This module calls no provider and writes only schema ``ai``.
"""
from __future__ import annotations

import argparse
import json
from typing import Any

from artifacts import ModelBundle
from challenger_policy import CHALLENGER_POLICY, ordered_policy
from db import connect, load_model_artifact
from reproducibility import bundle_contract_fingerprint, verify_reference_gate


class SelectedActivationError(ValueError):
    """The selected version is incomplete, drifted or not reproducible."""


def _validate_policy_row(row: Any, version: str, spec: Any) -> None:
    league = str(row["league"])
    if str(row["version"]) != version:
        raise SelectedActivationError(f"{league} version drift")
    if row["status"] not in {"challenger", "current"}:
        raise SelectedActivationError(
            f"{league} is not activatable from status {row['status']!r}")
    if row["family"] != spec.family or int(row["half_life_days"]) != spec.half_life_days:
        raise SelectedActivationError(
            f"{league} policy drift: {row['family']}/{row['half_life_days']} vs {spec}")
    if spec.family == "ensemble":
        if tuple(row["component_families"] or ()) != spec.base_families:
            raise SelectedActivationError(f"{league} ensemble component drift")
        if row["meta_model"] != spec.meta:
            raise SelectedActivationError(f"{league} ensemble meta-model drift")
    elif row["component_families"] is not None or row["meta_model"] is not None:
        raise SelectedActivationError(f"{league} unexpectedly carries ensemble provenance")
    if not row["artifact_sha256"]:
        raise SelectedActivationError(f"{league} has no artefact hash")


def verify_selected_version(version: str) -> list[dict[str, str]]:
    """Verify the complete selected version before any lifecycle write occurs."""
    expected = dict(ordered_policy())
    with connect() as conn:
        rows = conn.execute(
            """
            select id,league,version,family,status,training_matches,
                   feature_groups,half_life_days,component_families,meta_model,
                   artifact_sha256
              from ai.models
             where version=%s
             order by league
            """,
            (version,),
        ).fetchall()

    if len(rows) != len(expected) != 0:
        raise SelectedActivationError(
            f"expected {len(expected)} selected rows for {version}, got {len(rows)}")
    if len(rows) != 9:
        raise SelectedActivationError(f"selected policy must cover exactly nine leagues, got {len(rows)}")

    seen: set[str] = set()
    verified: list[dict[str, str]] = []
    for row in rows:
        league = str(row["league"])
        if league in seen or league not in expected:
            raise SelectedActivationError(f"unexpected/duplicate selected league {league}")
        seen.add(league)
        _validate_policy_row(row, version, expected[league])

        bundle = ModelBundle.from_payload(load_model_artifact(str(row["id"])))
        if bundle.league != league or bundle.version != version or bundle.family != row["family"]:
            raise SelectedActivationError(f"{league} artefact identity disagrees with database row")
        if int(bundle.half_life_days or 0) != int(row["half_life_days"]):
            raise SelectedActivationError(f"{league} artefact half-life disagrees")
        if tuple(bundle.feature_groups) != tuple(row["feature_groups"] or ()):
            raise SelectedActivationError(f"{league} requested feature groups disagree")
        if not bundle.metadata.get("coverage_guard"):
            raise SelectedActivationError(f"{league} artefact has no effective coverage provenance")

        repro = bundle.metadata.get("reproducibility") or {}
        if repro.get("schema") != 1:
            raise SelectedActivationError(f"{league} has no verified reproducibility schema")
        data_sha = str(repro.get("training_data_sha256") or "")
        contract_sha = str(repro.get("bundle_contract_sha256") or "")
        if len(data_sha) != 64 or len(contract_sha) != 64:
            raise SelectedActivationError(f"{league} reproducibility fingerprints are incomplete")
        if contract_sha != bundle_contract_fingerprint(bundle):
            raise SelectedActivationError(f"{league} semantic bundle fingerprint disagrees")
        gate = repro.get("reference_gate") or {}
        verify_reference_gate(bundle, gate)
        if gate.get("bundle_contract_sha256") != contract_sha:
            raise SelectedActivationError(f"{league} reference gate targets another bundle contract")
        if int(repro.get("training_rows") or 0) != int(row["training_matches"]):
            raise SelectedActivationError(f"{league} reproducibility row count disagrees")

        verified.append({"league": league, "id": str(row["id"])})

    if seen != set(CHALLENGER_POLICY):
        raise SelectedActivationError(
            f"league set mismatch: got {sorted(seen)}, expected {sorted(CHALLENGER_POLICY)}")
    return verified


def activate_selected_version(version: str, reason: str) -> list[dict[str, str]]:
    """Retire superseded currents and make the verified selected set current."""
    verified = verify_selected_version(version)
    chosen = {row["league"]: row["id"] for row in verified}

    with connect() as conn:
        with conn.transaction():
            locked = conn.execute(
                """
                select id,league,status
                  from ai.models
                 where version=%s
                 order by league
                 for update
                """,
                (version,),
            ).fetchall()
            if len(locked) != 9:
                raise SelectedActivationError(
                    f"selected set changed during verification: expected 9 rows, got {len(locked)}")
            for row in locked:
                league = str(row["league"])
                if chosen.get(league) != str(row["id"]):
                    raise SelectedActivationError(f"{league} selected row changed during verification")
                if row["status"] not in {"challenger", "current"}:
                    raise SelectedActivationError(
                        f"{league} changed to non-activatable status {row['status']!r}")

            for league, model_id in chosen.items():
                conn.execute(
                    """
                    update ai.models
                       set status='retired'
                     where league=%s and status='current' and id<>%s::uuid
                    """,
                    (league, model_id),
                )
                conn.execute(
                    """
                    update ai.models
                       set status='current',
                           notes=case when status='challenger' then
                             coalesce(notes || E'\n','') ||
                             'Auto-promoted ' || now()::text || ': ' || %s
                           else notes end
                     where id=%s::uuid and status in ('challenger','current')
                    """,
                    (reason, model_id),
                )

            state = conn.execute(
                """
                select count(*) filter (where status='current') as current_total,
                       count(*) filter (where status='current' and version=%s) as selected_current,
                       count(distinct league) filter (where status='current' and version=%s) as selected_leagues,
                       count(*) filter (where status='challenger' and version=%s) as selected_challengers
                  from ai.models
                """,
                (version, version, version),
            ).fetchone()
            actual = {
                "current_total": int(state["current_total"]),
                "selected_current": int(state["selected_current"]),
                "selected_leagues": int(state["selected_leagues"]),
                "selected_challengers": int(state["selected_challengers"]),
            }
            expected_state = {
                "current_total": 9,
                "selected_current": 9,
                "selected_leagues": 9,
                "selected_challengers": 0,
            }
            if actual != expected_state:
                raise SelectedActivationError(
                    f"activation postcondition failed: {actual} != {expected_state}")

    return verified


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument(
        "--reason",
        default=(
            "Owner policy: verified evidence-selected winner automatically becomes current "
            "after policy, coverage, artefact, training-data, semantic-contract and reference-oracle gates pass."
        ),
    )
    args = parser.parse_args()
    rows = activate_selected_version(args.version, args.reason)
    print("SELECTED_CURRENT " + json.dumps(rows, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
