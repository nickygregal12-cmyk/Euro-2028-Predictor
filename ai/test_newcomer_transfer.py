"""Newcomer goal-state transfer across a division change.

Offline. No database, no network.

The candidates and the adoption rule are fixed in
`docs/quality/investigations/2026-08-13-newcomer-goal-transfer-predeclaration.md`,
which was committed before any of this existed. These tests assert the two
properties that make the study's result readable at all:

  1. under the default policy, and for any club that has not moved division,
     the feature row is IDENTICAL — so an established-fixture delta in the
     study is a bug rather than football;
  2. the division prior is leak-free by construction, never by a date filter.

Run:  python -m pytest test_newcomer_transfer.py
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import pytest

from features import (NEWCOMER_BLEND_K, NEWCOMER_TRANSFER_DEFAULT,
                      NEWCOMER_TRANSFER_POLICIES, FeatureBuilder, TeamState,
                      _transfer_weight)

MOVING_POLICIES = tuple(p for p in NEWCOMER_TRANSFER_POLICIES
                        if p != NEWCOMER_TRANSFER_DEFAULT)


# ---------------------------------------------------------------------------
# A two-division synthetic history. The lower division scores far more goals
# than the upper one, which is deliberately unlike real football: it makes any
# transfer of a carried rate obvious rather than marginal.
# ---------------------------------------------------------------------------
UPPER, LOWER = "E0", "E1"
UPPER_CLUBS = [f"Up {chr(65 + i)}" for i in range(6)]
LOWER_CLUBS = [f"Low {chr(65 + i)}" for i in range(6)]
# The club that goes up, and the one that comes down. Both directions are in
# the fixture deliberately: the predeclaration requires them measured
# separately, and a suite carrying only a promotion could not tell a policy
# that handles one direction from a policy that handles both.
PROMOTED = LOWER_CLUBS[0]
RELEGATED = UPPER_CLUBS[0]
MOVED = (PROMOTED, RELEGATED)


def _fixture_rows(clubs, division, season, start, goals_each, offset=0):
    rows, day = [], start
    for i, home in enumerate(clubs):
        for j, away in enumerate(clubs):
            if home == away:
                continue
            day = day + timedelta(days=3)
            rows.append({
                "match_date": day, "season": season, "division": division,
                "home_canonical": home, "away_canonical": away,
                "home_goals": goals_each + ((i + j + offset) % 2),
                "away_goals": goals_each,
            })
    return rows


def _history() -> pd.DataFrame:
    """Four seasons. `PROMOTED` is in LOWER for three, then UPPER."""
    rows = []
    for n, season in enumerate(("2223", "2324", "2425")):
        start = date(2022 + n, 8, 1)
        rows += _fixture_rows(UPPER_CLUBS, UPPER, season, start, 1)
        rows += _fixture_rows(LOWER_CLUBS, LOWER, season, start, 3)
    # The promotion season: PROMOTED now plays in UPPER.
    up_next = [c for c in UPPER_CLUBS[1:]] + [PROMOTED]
    rows += _fixture_rows(up_next, UPPER, "2526", date(2025, 8, 1), 1)
    rows += _fixture_rows(LOWER_CLUBS[1:] + [UPPER_CLUBS[0]], LOWER,
                          "2526", date(2025, 8, 1), 3)
    frame = pd.DataFrame(rows)
    frame["result"] = [
        "H" if h > a else ("A" if a > h else "D")
        for h, a in zip(frame["home_goals"], frame["away_goals"])]
    for column in ("home_sot", "away_sot", "home_shots", "away_shots",
                   "home_corners", "away_corners", "home_ht_goals",
                   "away_ht_goals", "home_fouls", "away_fouls",
                   "home_yellow", "away_yellow", "home_red", "away_red"):
        frame[column] = None
    return frame.sort_values("match_date").reset_index(drop=True)


def _frame_for(policy: str) -> pd.DataFrame:
    builder = FeatureBuilder(UPPER, newcomer_transfer=policy)
    # Six-club divisions supply ~180 team-matches over three seasons, below
    # the real support floor — so without this the policies would correctly
    # decline to act and the suite would pass by measuring nothing.
    builder.MIN_DIVISION_PRIOR_MATCHES = 20
    return builder.build_training_frame(_history())


# ---------------------------------------------------------------------------
# Property 1 — the no-op guarantee
# ---------------------------------------------------------------------------

def test_default_policy_is_the_shipped_default() -> None:
    """The study must not change what anything currently trains on."""
    assert NEWCOMER_TRANSFER_DEFAULT == "current"
    assert FeatureBuilder(UPPER).newcomer_transfer == "current"


@pytest.mark.parametrize("policy", MOVING_POLICIES)
def test_a_policy_moves_only_rows_involving_a_club_that_moved(policy) -> None:
    """The load-bearing property of the whole study.

    The predeclaration says an established-fixture delta means the
    implementation is wrong, not the football. This is that sentence as a
    test: every row whose two clubs both stayed put must be identical to the
    control, column for column.
    """
    control, treated = _frame_for(NEWCOMER_TRANSFER_DEFAULT), _frame_for(policy)
    assert len(control) == len(treated)

    involved = (control["home_canonical"].isin(MOVED)
                | control["away_canonical"].isin(MOVED))
    numeric = control.select_dtypes("number").columns

    untouched_control = control.loc[~involved, numeric].reset_index(drop=True)
    untouched_treated = treated.loc[~involved, numeric].reset_index(drop=True)
    pd.testing.assert_frame_equal(untouched_control, untouched_treated)


@pytest.mark.parametrize("policy", MOVING_POLICIES)
@pytest.mark.parametrize("club, direction", [(PROMOTED, "promoted"),
                                             (RELEGATED, "relegated")])
def test_a_policy_moves_a_club_that_changed_division(policy, club,
                                                     direction) -> None:
    """And the suite cannot pass by doing nothing at all.

    Without this, a policy that was silently a no-op everywhere would satisfy
    the test above perfectly. Both directions are asserted separately, because
    a policy keyed on promotion alone would pass a promotion-only check while
    leaving half the population the study is about untreated.
    """
    control, treated = _frame_for(NEWCOMER_TRANSFER_DEFAULT), _frame_for(policy)
    move_season = control["season"] == "2526"
    involved = ((control["home_canonical"] == club)
                | (control["away_canonical"] == club))
    rates = ["home_form5_gf", "home_form5_ga", "away_form5_gf", "away_form5_ga"]

    changed = (control.loc[move_season & involved, rates]
               .ne(treated.loc[move_season & involved, rates])).any().any()
    assert changed, f"{policy} left the {direction} club's goal rates untouched"


def test_an_unknown_policy_is_refused_at_construction() -> None:
    with pytest.raises(ValueError, match="newcomer transfer policy"):
        FeatureBuilder(UPPER, newcomer_transfer="shrink_a_bit")


# ---------------------------------------------------------------------------
# Property 2 — the division prior cannot see the match it is used on
# ---------------------------------------------------------------------------

def test_the_division_prior_excludes_the_match_being_built() -> None:
    """Leak-free by construction: the walk updates AFTER the row is emitted.

    Asserted by driving the builder's own accumulator rather than by reading
    the source: the prior after observing N matches must equal the mean over
    exactly those N, never N+1.
    """
    builder = FeatureBuilder(UPPER)
    builder.MIN_DIVISION_PRIOR_MATCHES = 4
    assert builder.division_goal_prior(UPPER) is None, "no evidence, no prior"

    builder._observe_division_goals(UPPER, 2, 0)     # 2 goals / 2 team-matches
    builder._observe_division_goals(UPPER, 1, 1)     # 2 goals / 2 team-matches
    assert builder.division_goal_prior(UPPER) == pytest.approx(1.0)

    builder._observe_division_goals(UPPER, 6, 0)
    assert builder.division_goal_prior(UPPER) == pytest.approx(10.0 / 6.0)


def test_a_thin_division_supplies_no_prior_rather_than_a_noisy_one() -> None:
    builder = FeatureBuilder(UPPER)
    for _ in range(3):
        builder._observe_division_goals(UPPER, 2, 1)
    assert builder.division_goal_prior(UPPER) is None
    assert builder.division_goal_prior("never seen") is None


# ---------------------------------------------------------------------------
# The transition itself
# ---------------------------------------------------------------------------

def test_division_move_into_sees_the_opening_fixture() -> None:
    """`division_move` reads 0 on the row where the defect is largest.

    It compares `division` with `previous_division`, both set by
    `roll_season`, so it only becomes true once the club has already played in
    its new division. `division_move_into` is the same verdict one match
    earlier, which is the match the study is about.
    """
    club = TeamState(division=LOWER, previous_division=LOWER)
    assert club.division_move() == 0, "the gap this exists to close"
    assert club.division_move_into(UPPER) == 1, "promoted, before a ball is kicked"
    assert club.division_move_into(LOWER) == 0, "staying put is not a move"

    relegated = TeamState(division=UPPER, previous_division=UPPER)
    assert relegated.division_move_into(LOWER) == -1
    assert relegated.division_move_into("SC1") == 0, "never across countries"
    assert relegated.division_move_into(None) == 0


def test_the_blend_weight_decays_with_matches_played() -> None:
    """Candidate C's shrinkage must fade as the club supplies evidence."""
    assert _transfer_weight("decaying_blend", 0) == pytest.approx(1.0)
    assert _transfer_weight("decaying_blend", NEWCOMER_BLEND_K) == pytest.approx(0.5)

    weights = [_transfer_weight("decaying_blend", n) for n in range(0, 40, 5)]
    assert weights == sorted(weights, reverse=True), "must be monotone"
    assert weights[-1] < 0.2, "and must effectively disappear by late season"


def test_the_fixed_shrink_does_not_decay() -> None:
    """Candidate B is the control for C: same target, no fading."""
    assert (_transfer_weight("prior_shrink", 0)
            == _transfer_weight("prior_shrink", 30))


def test_the_default_policy_carries_no_weight() -> None:
    assert _transfer_weight(NEWCOMER_TRANSFER_DEFAULT, 0) == 0.0
