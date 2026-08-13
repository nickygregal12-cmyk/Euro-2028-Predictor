"""Mutation guards for the evidence-selected challenger policy."""
from __future__ import annotations

from pathlib import Path

import challenger_policy
import train_selected_challengers
from config import LEAGUES


EXPECTED = {
    "EPL": ("ensemble", 1800, ("poisson", "elo"), "equal_blend"),
    "ECH": ("ensemble", 1800, ("poisson", "elo"), "equal_blend"),
    "EL1": ("poisson", 1800, (), None),
    "EL2": ("poisson", 900, (), None),
    "ENL": ("poisson", 900, (), None),
    "SPL": ("poisson", 1800, (), None),
    "SCH": ("poisson", 900, (), None),
    "SL1": ("poisson", 1800, (), None),
    "SL2": ("poisson", 900, (), None),
}


def test_policy_is_exactly_the_predeclared_nine_league_result():
    assert set(challenger_policy.CHALLENGER_POLICY) == set(LEAGUES) == set(EXPECTED)
    actual = {
        league: (spec.family, spec.half_life_days, spec.base_families, spec.meta)
        for league, spec in challenger_policy.CHALLENGER_POLICY.items()
    }
    assert actual == EXPECTED


def test_every_ensemble_uses_only_the_admitted_poisson_elo_pair():
    ensembles = [spec for spec in challenger_policy.CHALLENGER_POLICY.values()
                 if spec.family == "ensemble"]
    assert ensembles
    assert all(spec.base_families == ("poisson", "elo") for spec in ensembles)
    assert all(spec.meta == "equal_blend" for spec in ensembles)


def test_training_command_is_explicit_about_the_evidence_selected_window():
    spec = challenger_policy.CHALLENGER_POLICY["EPL"]
    command = train_selected_challengers.command_for(
        "EPL", spec, "hardening-test", python="python")
    assert command == [
        "python", "train.py", "--league", "EPL", "--family", "ensemble",
        "--half-life-days", "1800", "--version", "hardening-test",
        "--walk-forward", "--base-families", "poisson", "elo",
        "--meta", "equal_blend",
    ]


def test_single_family_command_does_not_invent_ensemble_arguments():
    spec = challenger_policy.CHALLENGER_POLICY["SCH"]
    command = train_selected_challengers.command_for(
        "SCH", spec, "hardening-test", python="python")
    assert command == [
        "python", "train.py", "--league", "SCH", "--family", "poisson",
        "--half-life-days", "900", "--version", "hardening-test",
        "--walk-forward",
    ]
    assert "--base-families" not in command
    assert "--meta" not in command


def test_authority_documents_are_named_next_to_the_policy():
    root = Path(__file__).resolve().parent.parent
    assert (root / challenger_policy.AUTHORITY).is_file()
    assert (root / challenger_policy.CONFIRMATION).is_file()


def test_monday_training_uses_the_selected_policy_not_one_global_family():
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github" / "workflows" / "ai-lab.yml").read_text()
    assert "python train_selected_challengers.py" in workflow
    assert './run_leagues.sh train.py --family poisson --version "auto-$stamp" --walk-forward' not in workflow
