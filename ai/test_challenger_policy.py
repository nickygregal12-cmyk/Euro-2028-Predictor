"""Mutation guards for the evidence-selected challenger policy."""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

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


def _actual_policy():
    return {
        league: (spec.family, spec.half_life_days, spec.base_families, spec.meta)
        for league, spec in challenger_policy.ordered_policy()
    }


def test_policy_is_exactly_the_predeclared_nine_league_result():
    ordered = challenger_policy.ordered_policy()
    assert len(ordered) == len(LEAGUES) == len(EXPECTED) == 9
    assert [league for league, _ in ordered] == list(LEAGUES)
    assert set(challenger_policy.CHALLENGER_POLICY) == set(LEAGUES) == set(EXPECTED)
    assert _actual_policy() == EXPECTED


def test_every_ensemble_uses_only_the_admitted_poisson_elo_pair():
    ensembles = [spec for spec in challenger_policy.CHALLENGER_POLICY.values()
                 if spec.family == "ensemble"]
    assert len(ensembles) == 2
    assert all(spec.base_families == ("poisson", "elo") for spec in ensembles)
    assert all(spec.meta == "equal_blend" for spec in ensembles)


def test_every_policy_command_matches_the_authority_exactly_once():
    """Mutation guard for missing leagues and accidental family/window drift."""
    commands = {}
    for league, spec in challenger_policy.ordered_policy():
        command = train_selected_challengers.command_for(
            league, spec, "hardening-test", python="python")
        assert league not in commands
        commands[league] = command

        family = command[command.index("--family") + 1]
        half_life = int(command[command.index("--half-life-days") + 1])
        expected_family, expected_half_life, expected_bases, expected_meta = EXPECTED[league]
        assert family == expected_family
        assert half_life == expected_half_life
        if expected_family == "ensemble":
            start = command.index("--base-families") + 1
            end = command.index("--meta")
            assert tuple(command[start:end]) == expected_bases
            assert command[end + 1] == expected_meta
        else:
            assert "--base-families" not in command
            assert "--meta" not in command

    assert set(commands) == set(EXPECTED)


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


def test_retry_mode_skips_a_league_that_already_materialised(monkeypatch):
    epl = challenger_policy.CHALLENGER_POLICY["EPL"]
    ech = challenger_policy.CHALLENGER_POLICY["ECH"]
    monkeypatch.setattr(train_selected_challengers, "ordered_policy",
                        lambda: [("EPL", epl), ("ECH", ech)])
    monkeypatch.setattr(train_selected_challengers, "existing_leagues",
                        lambda version: {"EPL"})
    calls = []

    def fake_run(command, check=False):
        calls.append(command)
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(train_selected_challengers.subprocess, "run", fake_run)
    monkeypatch.setattr(
        train_selected_challengers.sys, "argv",
        ["train_selected_challengers.py", "--version", "bounded-v1", "--skip-existing"],
    )

    assert train_selected_challengers.main() == 0
    assert len(calls) == 1
    assert calls[0][calls[0].index("--league") + 1] == "ECH"


def test_selected_runner_is_challenger_only_and_contains_no_promotion_path():
    root = Path(__file__).resolve().parent.parent
    runner = (root / "ai" / "train_selected_challengers.py").read_text().lower()
    training = (root / "ai" / "train.py").read_text().lower()

    assert "promote" not in runner
    assert "status='current'" not in runner
    assert 'status="current"' not in runner
    assert "--status" not in runner
    assert '"status": "challenger"' in training


def test_authority_documents_are_named_next_to_the_policy():
    root = Path(__file__).resolve().parent.parent
    assert (root / challenger_policy.AUTHORITY).is_file()
    assert (root / challenger_policy.CONFIRMATION).is_file()


def test_monday_training_uses_the_selected_policy_not_one_global_family():
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github" / "workflows" / "ai-lab.yml").read_text()
    assert "python train_selected_challengers.py" in workflow
    assert './run_leagues.sh train.py --family poisson' not in workflow
    assert "admin_ai_promote_model" not in workflow
