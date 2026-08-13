"""The domestic-cup research path, held to the promises it makes.

The tests that matter most here are the refusals. A cup path is easy to build
and easy to quietly corrupt in three specific ways, each of which produces
numbers that look completely normal:

  * back-dating a forecast past a kickoff that has already happened;
  * letting a 90-minute draw become a qualification probability;
  * reporting a cross-tier tie as though the model were on home ground.

Each of those is a test below, and each fails loudly rather than warning.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

import cups
from cups import (CUPS, BackdatedForecast, CupForecast, CupTie,
                  agreement_across_families, assert_prospective,
                  data_confidence, extrapolation_note, observation_rows,
                  refuse_qualification, schedule_records)

KICKOFF = datetime(2026, 8, 16, 13, 0, tzinfo=timezone.utc)


def tie(**overrides) -> CupTie:
    base = dict(
        competition="scottish_league_cup",
        round_name="Last 16",
        home_canonical="Hibernian",
        away_canonical="Partick",
        kickoff_at=KICKOFF,
        source="test",
        home_division="SC0",
        away_division="SC1",
    )
    base.update(overrides)
    return CupTie(**base)


# ---------------------------------------------------------------------------
# The clock
# ---------------------------------------------------------------------------

def test_a_forecast_before_kickoff_is_allowed():
    assert_prospective(tie(), now=KICKOFF - timedelta(hours=1))


def test_a_forecast_after_kickoff_is_refused():
    with pytest.raises(BackdatedForecast, match="not a forecast"):
        assert_prospective(tie(), now=KICKOFF + timedelta(seconds=1))


def test_a_forecast_exactly_at_kickoff_is_refused():
    """The boundary goes to the refusal. A tie kicking off this instant is not
    a thing anybody is still forecasting."""
    with pytest.raises(BackdatedForecast):
        assert_prospective(tie(), now=KICKOFF)


# ---------------------------------------------------------------------------
# The market boundary
# ---------------------------------------------------------------------------

def test_qualification_is_refused_rather_than_approximated():
    with pytest.raises(NotImplementedError, match="90-minute"):
        refuse_qualification()


def test_a_forecast_record_states_that_qualification_is_not_modelled():
    record = CupForecast(
        tie=tie(), p_home=0.55, p_draw=0.25, p_away=0.20,
        model_family="elo", model_reference="none",
        confidence=data_confidence(tie(), 500, 480), agreement=None,
        created_at=KICKOFF - timedelta(days=1),
    ).to_record()
    assert record["market"] == "90_minute_hda"
    assert record["qualification_probability"] is None
    assert "not modelled" in record["qualification_note"]
    assert abs(record["p_home"] + record["p_draw"] + record["p_away"] - 1.0) < 1e-9


def test_a_forecast_record_carries_the_fields_a_reader_needs():
    record = CupForecast(
        tie=tie(), p_home=0.55, p_draw=0.25, p_away=0.20,
        model_family="elo", model_reference="none",
        confidence=data_confidence(tie(), 500, 480),
        agreement=agreement_across_families({"elo": (0.55, 0.25, 0.20),
                                             "poisson": (0.58, 0.24, 0.18)}),
        created_at=KICKOFF - timedelta(days=1),
    ).to_record()
    for key in ("competition", "round", "home", "away", "kickoff_at",
                "p_home", "p_draw", "p_away", "model_family",
                "data_confidence", "model_agreement", "extrapolation",
                "home_division", "away_division", "cross_tier", "created_at",
                "source"):
        assert key in record, f"a cup forecast must report {key}"


# ---------------------------------------------------------------------------
# Cross-tier honesty
# ---------------------------------------------------------------------------

def test_a_same_tier_tie_is_not_flagged_cross_tier():
    same = tie(home_canonical="Rangers", away_canonical="St Mirren",
               home_division="SC0", away_division="SC0")
    assert not same.cross_tier
    assert same.tier_gap == 0
    assert extrapolation_note(same, "gbm") is None


def test_a_cross_tier_tie_is_flagged_with_its_gap():
    wide = tie(home_canonical="Hearts", away_canonical="Inverness C",
               home_division="SC0", away_division="SC2")
    assert wide.cross_tier
    assert wide.tier_gap == 2


def test_each_family_states_its_own_extrapolation_behaviour():
    wide = tie(home_division="SC0", away_division="SC2")
    assert "within domain" in extrapolation_note(wide, "elo")
    for family in ("poisson", "logistic"):
        assert "OUTSIDE domain" in extrapolation_note(wide, family)
    assert "CANNOT extrapolate" in extrapolation_note(wide, "gbm")


def test_confidence_is_lowered_by_a_two_tier_gap():
    narrow = data_confidence(tie(home_division="SC0", away_division="SC1"), 500, 480)
    wide = data_confidence(tie(home_division="SC0", away_division="SC2"), 500, 480)
    assert narrow["band"] == "medium"
    assert wide["band"] == "low"
    assert any("cross-tier" in r for r in wide["reasons"])


def test_confidence_is_lowered_by_a_thin_archive():
    thin = data_confidence(tie(home_division="SC0", away_division="SC0"), 500, 12)
    assert thin["band"] == "low"
    assert any("prior matches" in r for r in thin["reasons"])


def test_confidence_is_lowered_when_the_orientation_is_unconfirmed():
    """Home advantage is ~60 Elo points, so this is a result uncertainty."""
    unsure = data_confidence(
        tie(home_division="SC0", away_division="SC0",
            orientation_confirmed=False), 500, 480)
    assert unsure["band"] == "low"
    assert any("orientation" in r for r in unsure["reasons"])


def test_a_clean_same_tier_tie_is_high_confidence_with_a_stated_reason():
    clean = data_confidence(tie(home_division="SC0", away_division="SC0"), 500, 480)
    assert clean["band"] == "high"
    assert clean["reasons"]


def test_confidence_never_returns_a_bare_band():
    """The reasons are the part a reader can disagree with."""
    for home_div, away_div, known in (("SC0", "SC0", 500), ("SC0", "SC3", 40)):
        result = data_confidence(tie(home_division=home_div, away_division=away_div),
                                 known, known)
        assert result["reasons"], "a confidence band with no reasons is unusable"


# ---------------------------------------------------------------------------
# Agreement is not confidence and not calibration
# ---------------------------------------------------------------------------

def test_agreement_reports_a_spread_rather_than_a_single_score():
    result = agreement_across_families({"elo": (0.50, 0.28, 0.22),
                                        "poisson": (0.62, 0.22, 0.16)})
    assert result["measurable"]
    assert result["spread"]["H"] == pytest.approx(0.12)
    assert "differ materially" in result["verdict"]


def test_agreement_needs_two_families():
    result = agreement_across_families({"elo": (0.5, 0.3, 0.2)})
    assert result["measurable"] is False


def test_agreement_and_confidence_are_separate_objects():
    """They answer different questions and must not be folded together."""
    one = tie(home_division="SC0", away_division="SC0")
    confidence = data_confidence(one, 500, 500)
    agreement = agreement_across_families({"elo": (0.5, 0.3, 0.2),
                                           "poisson": (0.51, 0.29, 0.20)})
    assert set(confidence) & set(agreement) == set()


# ---------------------------------------------------------------------------
# Feeding the congestion features
# ---------------------------------------------------------------------------

def test_schedule_records_produce_one_row_per_club():
    rows = schedule_records([tie()])
    assert len(rows) == 2
    assert {r["team"] for r in rows} == {"Hibernian", "Partick"}
    assert {r["competition"] for r in rows} == {"scottish_league_cup"}
    assert {r["match_date"] for r in rows} == {KICKOFF.date()}


def test_schedule_records_use_the_vocabulary_schedule_context_declares():
    import schedule_context
    rows = schedule_records([tie(competition=key) for key in CUPS])
    for row in rows:
        assert row["competition"] in schedule_context.REQUIRED_COMPETITIONS


def test_observation_rows_are_bitemporal_and_name_their_source():
    known_at = datetime(2026, 8, 13, 12, 0, tzinfo=timezone.utc)
    rows = observation_rows([tie(source="spfl.co.uk")], known_at=known_at)
    assert len(rows) == 2
    for row in rows:
        assert row["subject_type"] == "team"
        assert row["fact_type"] == "schedule_match"
        assert row["known_at"] == known_at
        assert row["applies_from"] == KICKOFF
        assert row["source"] == "spfl.co.uk"
        assert row["value"]["opponent"]
    assert {r["value"]["at_home"] for r in rows} == {True, False}


def test_observation_rows_are_built_and_not_written():
    """The module must have no writer. Persisting is a hosted mutation."""
    assert not hasattr(cups, "write_observations")
    assert not hasattr(cups, "insert_observations")


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------

def test_every_declared_cup_names_a_real_league_and_real_divisions():
    from config import ALL_DIVISIONS, LEAGUES
    for cup in CUPS.values():
        assert cup.primary_league in LEAGUES
        for division in cup.divisions:
            assert division in ALL_DIVISIONS
        assert cup.divisions == tuple(
            sorted(cup.divisions, key=lambda d: cups.DIVISION_RANK[d])), (
            f"{cup.key} divisions must be highest tier first")


def test_no_uefa_competition_is_declared():
    """European club strength is a separate, larger project and is explicitly
    not what this path is for."""
    for key in CUPS:
        assert "uefa" not in key
        assert "champions" not in key


def test_scottish_cups_come_first_in_the_registry():
    assert list(CUPS)[:2] == ["scottish_league_cup", "scottish_cup"]
