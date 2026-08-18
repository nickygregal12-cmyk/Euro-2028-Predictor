"""Leakage-safe feature construction.

The single rule this module exists to enforce: a row describing a match on
date D may only contain information that existed before D. It is enforced
structurally rather than by care — the builder walks matches in date order and
updates its state *after* emitting a row, so there is no code path by which a
match can see itself or anything later. Nothing here computes a season
aggregate over a whole DataFrame.

Same-day matches: state is updated only when the date advances, so two matches
on the same day cannot see each other either. That matters more than it
sounds, because a Saturday 3pm result would otherwise leak into a Saturday
5:30pm fixture.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from config import season_date_bounds

# ---------------------------------------------------------------------------
# Elo
# ---------------------------------------------------------------------------

ELO_START = 1500.0
ELO_K = 20.0
ELO_HOME_ADV = 60.0          # rating points, roughly the long-run home edge
ELO_SEASON_REGRESSION = 0.25  # pull 25% back to the mean between seasons
# Shots on target per team per match, roughly, across these divisions. Used as
# the neutral prior when a window carries no shot data at all — never as a
# stand-in for a real measurement, which is what `sot_known` distinguishes.
NEUTRAL_SOT = 4.5
NEUTRAL_SHOTS = 12.5          # total shots per team per match
NEUTRAL_SOT_PCT = 0.35        # share of shots that hit the target
NEUTRAL_CONVERSION = 0.30     # goals per shot on target
NEUTRAL_CORNERS = 5.0
NEUTRAL_HT_GOALS = 0.65       # goals in one half
# Discipline. Measured on Production, 13 August 2026, over all nine divisions:
# 3.14 to 3.73 cards and 20.3 to 23.3 fouls per match, which is a remarkably
# narrow band across four English tiers and four Scottish ones.
NEUTRAL_FOULS = 11.0          # fouls committed by ONE team per match
NEUTRAL_CARDS = 1.7           # yellows shown to ONE team per match
NEUTRAL_REDS = 0.06           # sendings-off per team per match

# Every column this module reads out of `ai.raw_matches`, declared so the
# loader can be checked against it rather than trusted.
#
# This exists because the first version of the shot features shipped without
# it and was silently inert: `load_history` selected goals, reds, odds and
# market probabilities and no shot columns at all, so `home_shots_ot` was
# absent from every row, every window fell back to NEUTRAL_SOT, and the
# feature columns were constant. Nothing failed. The models trained, the
# metrics printed, and the only symptom was that a change which should have
# moved log loss did not move it — which reads exactly like "shots do not
# help" rather than "shots were never delivered".
SOURCE_COLUMNS: frozenset[str] = frozenset({
    "match_date", "season", "division",
    "home_canonical", "away_canonical",
    "home_goals", "away_goals", "result",
    "red_card_distorted",
    "home_shots_ot", "away_shots_ot",
    "home_shots", "away_shots",
    "home_corners", "away_corners",
    "ht_home_goals", "ht_away_goals",
    "home_fouls", "away_fouls",
    "home_yellows", "away_yellows",
    "home_reds", "away_reds",
})


def _optional_number(value) -> float | None:
    """A missing shot count must stay missing, not become zero.

    The column is nullable on purpose — older files and the National League
    simply do not carry it — and `0` would read as "created nothing", which is
    a strong and false claim about a team.
    """
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

ELO_DIVISION_OFFSET = {       # a promoted club is not a mid-table top-flight club
    "E0": 0.0, "E1": -180.0, "E2": -320.0, "E3": -430.0, "EC": -520.0,
    "SC0": 0.0, "SC1": -170.0, "SC2": -300.0, "SC3": -400.0,
}

# Rank within a national pyramid, smaller is higher. Used to tell a promotion
# from a relegation, which the offset table alone cannot: -180 is further from
# zero than -170, and those two numbers belong to different countries.
DIVISION_RANK = {
    "E0": 1, "E1": 2, "E2": 3, "E3": 4, "EC": 5,
    "SC0": 1, "SC1": 2, "SC2": 3, "SC3": 4,
}

# Which pyramid a division belongs to. `DIVISION_RANK` alone cannot answer
# "is this a promotion", because the two pyramids reuse the same numbers: E0
# and SC0 are both rank 1, so ranking E0 against SC1 returns a confident -1
# for a move between countries that is not a relegation and did not happen.
# The comment above DIVISION_RANK already promised an English club is never
# compared with a Scottish one; this is what makes that true rather than
# merely intended.
DIVISION_COUNTRY = {
    "E0": "ENG", "E1": "ENG", "E2": "ENG", "E3": "ENG", "EC": "ENG",
    "SC0": "SCO", "SC1": "SCO", "SC2": "SCO", "SC3": "SCO",
}


def _rank_move(from_division: str | None, to_division: str | None) -> int:
    """+1 promoted, -1 relegated, 0 unchanged, unknown or across pyramids."""
    here = DIVISION_RANK.get(to_division or "")
    there = DIVISION_RANK.get(from_division or "")
    if here is None or there is None or here == there:
        return 0
    if (DIVISION_COUNTRY.get(to_division or "")
            != DIVISION_COUNTRY.get(from_division or "")):
        return 0
    return 1 if here < there else -1


def division_prior(division: str | None) -> float:
    """The rating an average club in this division carries.

    `ELO_DIVISION_OFFSET` had no `EC` entry, so a National League club seeded
    at 1500 — the Premier League's own anchor — which is the identical defect
    the offset table was added to fix one tier higher. EL2 trains on
    ("E3", "E2", "EC"), so it was reached in practice rather than theory.
    """
    return ELO_START + ELO_DIVISION_OFFSET.get(division or "", 0.0)


# How a club's rating moves between seasons. A parameter rather than a
# constant because the three candidates are a real modelling question and
# `experiments.py --study elo-transition` compares them on paired folds.
#
#   division_prior  shrink toward the mean of the division the rating was
#                   EARNED in. The default, and the fix for the defect below.
#   global_mean     shrink toward 1500. What this file did until now.
#   none            carry the rating unchanged into the new season.
#
# The defect: `roll_season` pulled every club a quarter of the way to
# ELO_START = 1500 each summer, and 1500 is the PREMIER LEAGUE's anchor. A
# League Two club sitting correctly at its division's own prior of 1070 was
# therefore moved to 1177 by nothing more than a summer passing, and again to
# 1257 the summer after — an unearned +187 over two seasons, applied to every
# club in the division at once, from a function whose stated purpose is to
# express that LESS is known in August than in May.
#
# The anchor is the division the rating was earned in rather than the one the
# club is about to play in, and that choice is the whole design:
#
#   * an unchanged lower-division club shrinks toward its own level, so the
#     upward drift disappears entirely;
#   * a promoted club shrinks DOWN toward the division it just won, which is
#     the honest statement — a good Championship side is not a mid-table
#     Premier League side — and it means promotion cannot hand a club rating
#     points for a change of division code, which shrinking toward the
#     DESTINATION prior would do;
#   * a relegated club shrinks UP toward the top flight it just left, keeping
#     the earned strength that makes it a favourite in the division below,
#     rather than destroying it.
#
# Nothing here is applied twice: the seed in `_state_for` and this anchor are
# the same number, so a club that never moves is not re-seeded every August.
ELO_TRANSITIONS = ("division_prior", "global_mean", "none")
ELO_TRANSITION_DEFAULT = "division_prior"

# How a rating update treats a match played with ten men.
#
#   plain            every result moves the rating by the same rule.
#   red_card_aware   a match flagged `red_card_distorted` moves it less.
#
# The principle is LEARN FROM EVERY RESULT, OVERREACT TO NONE. A 4-0 after an
# eighth-minute sending-off is still evidence — it is not evidence about
# eleven-a-side football of the same strength as a 4-0 at full strength, and
# the margin multiplier is the part of the update that treats it as though it
# were. The damping is partial rather than total precisely so the upset still
# counts: a rule that ignored distorted results would be a rule for deleting
# the results a model finds inconvenient.
#
# `plain` remains the default until `experiments.py --study elo-margin` shows
# otherwise on paired folds, for the same reason `halftime` is not in
# DEFAULT_GROUPS: a mechanism that sounds right is not evidence.
ELO_MARGIN_POLICIES = ("plain", "red_card_aware")
ELO_MARGIN_POLICY_DEFAULT = "plain"
ELO_DISTORTED_DAMPING = 0.5

# Goals of result margin that one shot-on-target of dominance is worth, used
# only to express the gap between what a team DID and what it DESERVED. A
# fixed constant rather than a fitted one: this is a descriptive feature handed
# to a model that will fit its own coefficient on it, and fitting it here would
# be a second, hidden model whose errors nothing measures.
PERF_GOALS_PER_SOT_MARGIN = 0.25


def _elo_expected(home_rating: float, away_rating: float) -> float:
    diff = (home_rating + ELO_HOME_ADV) - away_rating
    return 1.0 / (1.0 + 10 ** (-diff / 400.0))


def _elo_margin_multiplier(goal_diff: int, rating_diff: float) -> float:
    """Dixon-style margin weighting: a 4-0 moves ratings more than a 1-0,
    but with diminishing returns, and less when the favourite was expected
    to win comfortably anyway."""
    gd = abs(goal_diff)
    if gd < 1:
        return 1.0
    return float(np.log(gd + 1.0) * (2.2 / (0.001 * abs(rating_diff) + 2.2)))


# ---------------------------------------------------------------------------
# Rolling per-team state
# ---------------------------------------------------------------------------

@dataclass
class TeamState:
    elo: float = ELO_START
    recent: deque = field(default_factory=lambda: deque(maxlen=10))       # all venues
    recent_home: deque = field(default_factory=lambda: deque(maxlen=8))
    recent_away: deque = field(default_factory=lambda: deque(maxlen=8))
    season: str | None = None
    season_played: int = 0
    season_points: int = 0
    season_gf: int = 0
    season_ga: int = 0
    last_played: date | None = None
    top_flight_matches: int = 0
    # Where this club's rating was earned, and where it was earned the season
    # before. `division` is the division of its most recent match (or, before
    # it has played, the one it was seeded from); `previous_division` is what
    # `division` held at the last season change, which is what makes a
    # promotion distinguishable from a relegation without a fixture list.
    division: str | None = None
    previous_division: str | None = None
    seasons_seen: int = 0
    # Kick-off dates, for congestion. Rest days answers 'how long since
    # the last one'; it cannot answer 'how many in the last fortnight',
    # which is the question a third match in seven days poses.
    match_dates: deque = field(default_factory=lambda: deque(maxlen=12))
    # Cup and European dates supplied by `schedule_context`, which are not in
    # ai.raw_matches and are the reason the league-only congestion counts
    # understate exactly the clubs congestion is about. Empty unless a context
    # was supplied, so the default behaviour is unchanged.
    extra_dates: tuple = ()

    def roll_season(self, season: str,
                    transition: str = ELO_TRANSITION_DEFAULT) -> None:
        if self.season == season:
            return
        # Between seasons ratings regress toward the mean: squads change, and a
        # club's June rating overstates how much is actually known in August.
        # WHICH mean is the question `ELO_TRANSITIONS` documents: the mean of
        # the division this rating was earned in, not the top flight's.
        if transition not in ELO_TRANSITIONS:
            raise ValueError(f"unknown Elo transition: {transition!r}; "
                             f"known: {list(ELO_TRANSITIONS)}")
        if transition != "none":
            anchor = (division_prior(self.division)
                      if transition == "division_prior" else ELO_START)
            self.elo = self.elo + (anchor - self.elo) * ELO_SEASON_REGRESSION
        self.previous_division = self.division
        self.seasons_seen += 1
        self.season = season
        self.season_played = 0
        self.season_points = 0
        self.season_gf = 0
        self.season_ga = 0

    # -- read-only views used to build a feature row -------------------------

    def form(self, window: int, source: str = "all") -> dict[str, float]:
        d = {"all": self.recent, "home": self.recent_home, "away": self.recent_away}[source]
        rows = list(d)[-window:]
        n = len(rows)
        if n == 0:
            return {"n": 0.0, "ppg": 1.35, "gf": 1.35, "ga": 1.35, "gd": 0.0,
                "sot_f": NEUTRAL_SOT, "sot_a": NEUTRAL_SOT, "sot_known": 0.0,
                "shots_f": NEUTRAL_SHOTS, "shots_a": NEUTRAL_SHOTS,
                "shots_known": 0.0, "sot_pct": NEUTRAL_SOT_PCT,
                "goals_per_sot": NEUTRAL_CONVERSION,
                "conceded_per_sot": NEUTRAL_CONVERSION,
                "corners_f": NEUTRAL_CORNERS, "corners_a": NEUTRAL_CORNERS,
                "corners_known": 0.0,
                "ht_gf": NEUTRAL_HT_GOALS, "ht_ga": NEUTRAL_HT_GOALS,
                "sh_gf": NEUTRAL_HT_GOALS, "sh_ga": NEUTRAL_HT_GOALS,
                "ht_known": 0.0,
                "fouls_f": NEUTRAL_FOULS, "fouls_a": NEUTRAL_FOULS,
                "cards_f": NEUTRAL_CARDS, "cards_a": NEUTRAL_CARDS,
                "reds_f": NEUTRAL_REDS, "discipline_known": 0.0,
                "overperf": 0.0, "perf_margin": 0.0, "perf_disagree": 0.0,
                "perf_known": 0.0,
                "distorted": 0.0}
        pts = sum(r["pts"] for r in rows)
        gf = sum(r["gf"] for r in rows)
        ga = sum(r["ga"] for r in rows)
        # Shots on target, over the subset of the window that HAS them.
        # Goals are a small, noisy sample of the chances a team created; shots
        # on target are the cheapest honest proxy for those chances, and
        # Football-Data has given them away for free all along. Measured on
        # hosted Development: 82.7% of 46,215 imported matches carry them, and
        # 100% of E0, E1, E2, E3 and SC0.
        shot_rows = [r for r in rows if r.get("sot_f") is not None]
        k = len(shot_rows)

        def mean_of(key: str, source: list, default: float) -> float:
            vals = [r[key] for r in source if r.get(key) is not None]
            return (sum(vals) / len(vals)) if vals else default

        total_rows = [r for r in rows if r.get("shots_f") is not None]
        corner_rows = [r for r in rows if r.get("corners_f") is not None]
        ht_rows = [r for r in rows if r.get("ht_gf") is not None]
        foul_rows = [r for r in rows if r.get("fouls_f") is not None]
        card_rows = [r for r in rows if r.get("cards_f") is not None]
        red_rows = [r for r in rows if r.get("reds_f") is not None]

        # Conversion. This is the half a rolling average of shot VOLUME cannot
        # express, and the reason volume alone measured as noise: eleven goals
        # from seventeen shots on target is not a repeatable rate, and two
        # conceded from twenty-five faced is a goalkeeper having a month. Both
        # regress, and a model that only sees goals cannot know which way.
        sot_f_tot = sum(r["sot_f"] for r in shot_rows)
        sot_a_tot = sum(r["sot_a"] for r in shot_rows)
        gf_when_measured = sum(r["gf"] for r in shot_rows)
        ga_when_measured = sum(r["ga"] for r in shot_rows)
        shots_f_tot = sum(r["shots_f"] for r in total_rows)

        # Result against performance. A bottom club winning 1-0 having been
        # out-shot 3-24 on target is not the same evidence about future
        # strength as one winning 1-0 while dominating, and a form window built
        # from points alone cannot tell those apart — it records three points
        # both times. This does not DISCOUNT the upset: the win is in `ppg`
        # exactly as before. It adds the second half of the observation.
        perf_margin = 0.0
        overperf = 0.0
        disagree = 0.0
        if shot_rows:
            result_margins = [r["gf"] - r["ga"] for r in shot_rows]
            shot_margins = [r["sot_f"] - r["sot_a"] for r in shot_rows]
            perf_margin = sum(shot_margins) / len(shot_rows)
            overperf = (sum(result_margins) / len(shot_rows)
                        - PERF_GOALS_PER_SOT_MARGIN * perf_margin)
            disagree = sum(
                1 for rm, sm in zip(result_margins, shot_margins)
                if rm != 0 and sm != 0 and (rm > 0) != (sm > 0)
            ) / len(shot_rows)

        return {
            "n": float(n),
            "ppg": pts / n,
            "gf": gf / n,
            "ga": ga / n,
            "gd": (gf - ga) / n,
            # NEUTRAL_SOT rather than 0 when nothing is known, paired with
            # `sot_known` so the model can tell "average" from "unmeasured".
            # The National League carries shots for 29.5% of its matches, so
            # without that pair every unmeasured side would look league-average
            # — the same mistake `matches_known` already exists to prevent.
            "sot_f": (sum(r["sot_f"] for r in shot_rows) / k) if k else NEUTRAL_SOT,
            "sot_a": (sum(r["sot_a"] for r in shot_rows) / k) if k else NEUTRAL_SOT,
            "sot_known": (k / n) if n else 0.0,
            "shots_f": mean_of("shots_f", total_rows, NEUTRAL_SHOTS),
            "shots_a": mean_of("shots_a", total_rows, NEUTRAL_SHOTS),
            "shots_known": (len(total_rows) / n) if n else 0.0,
            # Accuracy, and the two conversion rates. Guarded denominators: a
            # window with no shots on target has no finishing rate, and a
            # neutral prior is the honest answer rather than a division.
            "sot_pct": (sot_f_tot / shots_f_tot) if shots_f_tot > 0 else NEUTRAL_SOT_PCT,
            "goals_per_sot": (gf_when_measured / sot_f_tot) if sot_f_tot > 0 else NEUTRAL_CONVERSION,
            "conceded_per_sot": (ga_when_measured / sot_a_tot) if sot_a_tot > 0 else NEUTRAL_CONVERSION,
            "corners_f": mean_of("corners_f", corner_rows, NEUTRAL_CORNERS),
            "corners_a": mean_of("corners_a", corner_rows, NEUTRAL_CORNERS),
            "corners_known": (len(corner_rows) / n) if n else 0.0,
            "ht_gf": mean_of("ht_gf", ht_rows, NEUTRAL_HT_GOALS),
            "ht_ga": mean_of("ht_ga", ht_rows, NEUTRAL_HT_GOALS),
            # Second half derived as full time minus half time, over the rows
            # that carry both, so the two halves cannot disagree about a match.
            "sh_gf": mean_of("sh_gf", [dict(r, sh_gf=r["gf"] - r["ht_gf"]) for r in ht_rows], NEUTRAL_HT_GOALS),
            "sh_ga": mean_of("sh_ga", [dict(r, sh_ga=r["ga"] - r["ht_ga"]) for r in ht_rows], NEUTRAL_HT_GOALS),
            "ht_known": (len(ht_rows) / n) if n else 0.0,
            # Positive `overperf`: this side has taken more from its recent
            # matches than the underlying play produced. It is a candidate for
            # regression rather than a claim that the team is lucky.
            "overperf": overperf,
            "perf_margin": perf_margin,
            "perf_disagree": disagree,
            "perf_known": (k / n) if n else 0.0,
            # Discipline. A team's own foul and card rate is a stable style
            # signal available almost everywhere; the REFEREE's identity is
            # not, and is deliberately absent — see FEATURE_GROUPS["discipline"].
            "fouls_f": mean_of("fouls_f", foul_rows, NEUTRAL_FOULS),
            "fouls_a": mean_of("fouls_a", foul_rows, NEUTRAL_FOULS),
            "cards_f": mean_of("cards_f", card_rows, NEUTRAL_CARDS),
            "cards_a": mean_of("cards_a", card_rows, NEUTRAL_CARDS),
            "reds_f": mean_of("reds_f", red_rows, NEUTRAL_REDS),
            "discipline_known": (len(card_rows) / n) if n else 0.0,
            # Share of the window played with a sending-off. Form built from
            # ten-man matches is weaker evidence about an eleven-a-side
            # fixture, and this lets the model discount it rather than
            # pretending a 4-0 after an eighth-minute red is a normal 4-0.
            "distorted": sum(r.get("distorted", 0) for r in rows) / n,
        }

    def season_view(self) -> dict[str, float]:
        n = self.season_played
        if n == 0:
            return {"played": 0.0, "ppg": 1.35, "gd_pm": 0.0, "gf_pm": 1.35, "ga_pm": 1.35}
        return {
            "played": float(n),
            "ppg": self.season_points / n,
            "gd_pm": (self.season_gf - self.season_ga) / n,
            "gf_pm": self.season_gf / n,
            "ga_pm": self.season_ga / n,
        }

    def congestion(self, today: date) -> dict[str, float]:
        """How crowded the recent calendar has been, not just the last gap.

        `rest_days` answers "how long since the previous match". It cannot
        answer "how many in the last fortnight", and a third match in seven
        days is a different physical proposition from a first one after a
        week's rest even though both can show six rest days.

        League fixtures, plus whatever `schedule_context` supplied. Without a
        context this counts Saturdays only: cup and European matches are not in
        `ai.raw_matches`, so a Premier League club's Thursday in Europe is
        invisible, and that understates congestion for exactly the clubs that
        suffer it most. It is why the measured null result for this family is
        not evidence that fixture congestion does not matter.
        """
        every = list(self.match_dates) + [d for d in self.extra_dates if d < today]
        last7 = sum(1 for d in every if 0 < (today - d).days <= 7)
        last14 = sum(1 for d in every if 0 < (today - d).days <= 14)
        return {
            "matches_7d": float(last7),
            "matches_14d": float(last14),
            "third_in_7d": 1.0 if last7 >= 2 else 0.0,
            "fourth_in_14d": 1.0 if last14 >= 3 else 0.0,
        }

    def rest_days(self, today: date) -> float:
        if self.last_played is None:
            return 14.0
        return float(min((today - self.last_played).days, 30))

    # -- mutation ------------------------------------------------------------

    def record(self, gf: int, ga: int, venue: str, when: date, top_flight: bool,
               division: str | None = None,
               distorted: bool = False,
               sot_f: float | None = None, sot_a: float | None = None,
               shots_f: float | None = None, shots_a: float | None = None,
               corners_f: float | None = None, corners_a: float | None = None,
               ht_gf: float | None = None, ht_ga: float | None = None,
               fouls_f: float | None = None, fouls_a: float | None = None,
               cards_f: float | None = None, cards_a: float | None = None,
               reds_f: float | None = None) -> None:
        pts = 3 if gf > ga else (1 if gf == ga else 0)
        # Both or neither, per pair: a match with one side's shots and not the
        # other's would bias every ratio built from it, so it is unmeasured.
        if sot_f is None or sot_a is None:
            sot_f = sot_a = None
        if shots_f is None or shots_a is None:
            shots_f = shots_a = None
        if corners_f is None or corners_a is None:
            corners_f = corners_a = None
        if ht_gf is None or ht_ga is None:
            ht_gf = ht_ga = None
        # Discipline travels as ONE unit: fouls, cards and sendings-off come
        # from the same Football-Data columns and are absent together. Pairing
        # them per side as well means a match with the home fouls and not the
        # away fouls cannot bias the "fouls drawn" half of the family.
        if fouls_f is None or fouls_a is None:
            fouls_f = fouls_a = None
        if cards_f is None or cards_a is None:
            cards_f = cards_a = None
        row = {"pts": pts, "gf": gf, "ga": ga, "distorted": 1 if distorted else 0,
               "sot_f": sot_f, "sot_a": sot_a,
               "shots_f": shots_f, "shots_a": shots_a,
               "corners_f": corners_f, "corners_a": corners_a,
               "ht_gf": ht_gf, "ht_ga": ht_ga,
               "fouls_f": fouls_f, "fouls_a": fouls_a,
               "cards_f": cards_f, "cards_a": cards_a, "reds_f": reds_f}
        self.match_dates.append(when)
        self.recent.append(row)
        (self.recent_home if venue == "home" else self.recent_away).append(row)
        self.season_played += 1
        self.season_points += pts
        self.season_gf += gf
        self.season_ga += ga
        self.last_played = when
        # The division the rating is being earned in, which is the anchor the
        # next season change will shrink toward.
        if division is not None:
            self.division = division
        if top_flight:
            self.top_flight_matches += 1

    # -- transition state, for regime detection and reporting -----------------

    def division_move(self) -> int:
        """+1 promoted, -1 relegated, 0 unchanged or unknown.

        Ranks rather than rating offsets, so E1 -> E0 and SC1 -> SC0 read the
        same and an English club is never compared with a Scottish one.
        """
        return _rank_move(self.previous_division, self.division)

    def division_move_into(self, division: str | None) -> int:
        """Did this club change division to arrive at THIS match?

        Answered against `previous_division` — the division of the club's last
        match before the most recent season roll — rather than against
        `division`, and the difference is the whole usefulness of the method.

        `division_move` compares `division` with `previous_division`, both set
        by `roll_season`, so it reads 0 until the club has played once in its
        new division. One match too late, and that match is where a carried
        goal rate is most wrong.

        Comparing against `division` instead fixes that and introduces a worse
        fault, which real data caught and a synthetic fixture did not:
        `observe` moves `division` on after the club's FIRST match in the new
        tier, so the verdict is true for exactly one fixture per club per
        season and false for the other forty-five. Measured on the
        Championship it labelled 71 rows out of 7,692 as newcomer fixtures,
        against the ~270 a season the division actually holds.

        `previous_division` is fixed for the whole season by `roll_season`, so
        this is stable from the opening fixture to the last, and it still uses
        nothing from the match's own result.
        """
        return _rank_move(self.previous_division, division)


FEATURE_GROUPS: dict[str, tuple[str, ...]] = {
    # Always on. Elo, form, venue, season, rest, promotion and calendar
    # position — everything the model had before any of this work.
    "core": (
        "elo_diff",
        "elo_home",
        "elo_away",
        "elo_expected_home",
        "home_form5_ppg",
        "home_form5_gf",
        "home_form5_ga",
        "away_form5_ppg",
        "away_form5_gf",
        "away_form5_ga",
        "home_venue_ppg",
        "home_venue_gf",
        "home_venue_ga",
        "away_venue_ppg",
        "away_venue_gf",
        "away_venue_ga",
        "home_season_ppg",
        "away_season_ppg",
        "home_season_gd_pm",
        "away_season_gd_pm",
        "form5_ppg_diff",
        "venue_ppg_diff",
        "season_ppg_diff",
        "season_gd_diff",
        "home_rest_days",
        "away_rest_days",
        "rest_diff",
        "home_form5_distorted",
        "away_form5_distorted",
        "home_matches_known",
        "away_matches_known",
        "home_is_newcomer",
        "away_is_newcomer",
        "season_progress",
    ),
    "shots_volume": (
        "home_form5_sot_f", "home_form5_sot_a",
        "away_form5_sot_f", "away_form5_sot_a",
        "sot_f_diff", "sot_a_diff",
        "home_sot_ratio", "away_sot_ratio",
        "home_sot_known", "away_sot_known",
        "home_shots_f", "home_shots_a", "away_shots_f", "away_shots_a",
        "shots_f_diff", "home_sot_pct", "away_sot_pct",
        "home_shots_known", "away_shots_known",
    ),
    "conversion": (
        "home_goals_per_sot", "away_goals_per_sot",
        "home_conceded_per_sot", "away_conceded_per_sot",
        "goals_per_sot_diff",
    ),
    "corners": (
        "home_corners_f", "home_corners_a",
        "away_corners_f", "away_corners_a",
        "corners_diff", "home_corners_known", "away_corners_known",
    ),
    "halftime": (
        "home_ht_gf", "home_ht_ga", "away_ht_gf", "away_ht_ga",
        "home_sh_gf", "home_sh_ga", "away_sh_gf", "away_sh_ga",
        "ht_gd_diff", "home_ht_known", "away_ht_known",
    ),
    # Result against underlying performance. A candidate family: measured by
    # `ablate.py` before it may enter DEFAULT_GROUPS, exactly as shots,
    # corners, conversion, half-time and congestion were.
    "performance": (
        "home_overperformance", "away_overperformance", "overperformance_diff",
        "home_perf_margin", "away_perf_margin", "perf_margin_diff",
        "home_perf_disagree", "away_perf_disagree",
        "home_perf_known", "away_perf_known",
    ),
    # Team discipline: how a side fouls, is fouled, and collects cards.
    #
    # A CANDIDATE, measured by `ablate.py` before it may join DEFAULT_GROUPS.
    #
    # There are deliberately NO REFEREE FEATURES here, and the reason is a
    # measurement rather than a preference. Per-referee match counts on
    # Production, 13 August 2026, over the whole archive:
    #
    #   division  referees  median matches  share of matches by a
    #                       per referee     referee with 100+ matches
    #   E0          66          50            79.2%
    #   E1         137          21            69.5%
    #   SC0         50          28            70.6%
    #   E2         181          31            32.4%
    #   E3         194          26            27.2%
    #   EC         199          28            16.6%
    #   SC1         51          28             0.0%
    #   SC2         66          22             0.0%
    #   SC3         70          20             0.0%
    #
    # In the three Scottish lower divisions NOT ONE referee has officiated a
    # hundred matches in fifteen seasons, and the median is twenty. A
    # per-referee card or foul rate estimated from twenty matches is mostly
    # the noise of which fixtures they happened to be given, and a model that
    # reads it as a referee's disposition will confidently attribute a
    # bad-tempered derby to whoever was in the middle. Referee identity is
    # also only 63% present at all below SC0.
    #
    # So the family is what the data supports: the TEAM's own rates, which are
    # available for 100% of English league rows and 63% of Scottish lower-tier
    # rows, and which describe a persistent style rather than a person.
    "discipline": (
        "home_fouls_f", "home_fouls_a", "away_fouls_f", "away_fouls_a",
        "home_cards_f", "home_cards_a", "away_cards_f", "away_cards_a",
        "home_reds_f", "away_reds_f",
        "fouls_f_diff", "cards_f_diff",
        "home_discipline_known", "away_discipline_known",
    ),
    "congestion": (
        "home_matches_7d", "away_matches_7d",
        "home_matches_14d", "away_matches_14d",
        "home_third_in_7d", "away_third_in_7d",
        "home_fourth_in_14d", "away_fourth_in_14d",
        "matches_7d_diff",
    ),
}


# ---------------------------------------------------------------------------
# Which columns are a NEUTRAL PRIOR rather than a measurement
# ---------------------------------------------------------------------------
#
# Every column below is filled with a NEUTRAL_* constant when its source stat
# was not recorded, and paired with a `*_known` column so a model can tell
# "average" from "unmeasured". That pairing is the whole reason the neutral
# constants are safe.
#
# It also means something that was asserted about this feature block and is
# NOT true: the frame handed to a model contains no NaN anywhere, on any
# league, including the National League where shots, corners and half-time
# goals are absent from every row. `GradientBoostedModel` was chosen partly
# for its native missingness handling, described there as letting "the
# neutral-prior columns become a fallback rather than the only
# representation". Measured, they ARE the only representation and the tree's
# NaN branch is never taken, because nothing upstream ever emits a NaN.
#
# This map exists so that claim can be TESTED rather than repeated: a model
# may opt in to reconstructing genuine missingness from it. It is deliberately
# not applied by default, because turning neutral priors back into NaN changes
# what every model sees and that is a measurement, not a tidy-up.
#
# The flag is a COVERAGE FRACTION (k/n over the form window), not a boolean.
# Reconstruction therefore applies only where it is exactly zero — nothing in
# the window was measured. A partially covered window has a real, if noisy,
# mean, and blanking it would discard a measurement rather than mark its
# absence.
NEUTRAL_FILLED_BY_FLAG: dict[str, tuple[str, ...]] = {
    "home_sot_known": ("home_form5_sot_f", "home_form5_sot_a",
                       "home_sot_ratio", "home_sot_pct"),
    "away_sot_known": ("away_form5_sot_f", "away_form5_sot_a",
                       "away_sot_ratio", "away_sot_pct"),
    "home_shots_known": ("home_shots_f", "home_shots_a"),
    "away_shots_known": ("away_shots_f", "away_shots_a"),
    "home_corners_known": ("home_corners_f", "home_corners_a"),
    "away_corners_known": ("away_corners_f", "away_corners_a"),
    "home_ht_known": ("home_ht_gf", "home_ht_ga", "home_sh_gf", "home_sh_ga"),
    "away_ht_known": ("away_ht_gf", "away_ht_ga", "away_sh_gf", "away_sh_ga"),
    "home_perf_known": ("home_overperformance", "home_perf_margin",
                        "home_perf_disagree"),
    "away_perf_known": ("away_overperformance", "away_perf_margin",
                        "away_perf_disagree"),
    "home_discipline_known": ("home_fouls_f", "home_fouls_a",
                              "home_cards_f", "home_cards_a", "home_reds_f"),
    "away_discipline_known": ("away_fouls_f", "away_fouls_a",
                              "away_cards_f", "away_cards_a", "away_reds_f"),
    # Conversion is derived from shots on target, so it is unmeasured exactly
    # when the shot data is.
    "home_sot_known_conversion": ("home_goals_per_sot", "home_conceded_per_sot"),
    "away_sot_known_conversion": ("away_goals_per_sot", "away_conceded_per_sot"),
}

# A difference column is a measurement only when BOTH sides are measured, so
# it is blanked if either flag is zero. Listing them separately keeps the
# one-flag map above honest rather than pretending a diff has a single owner.
NEUTRAL_FILLED_DIFFS: dict[str, tuple[str, str]] = {
    "sot_f_diff": ("home_sot_known", "away_sot_known"),
    "sot_a_diff": ("home_sot_known", "away_sot_known"),
    "shots_f_diff": ("home_shots_known", "away_shots_known"),
    "goals_per_sot_diff": ("home_sot_known", "away_sot_known"),
    "corners_diff": ("home_corners_known", "away_corners_known"),
    "ht_gd_diff": ("home_ht_known", "away_ht_known"),
    "overperformance_diff": ("home_perf_known", "away_perf_known"),
    "perf_margin_diff": ("home_perf_known", "away_perf_known"),
    "fouls_f_diff": ("home_discipline_known", "away_discipline_known"),
    "cards_f_diff": ("home_discipline_known", "away_discipline_known"),
}


def reconstruct_missing(frame: "pd.DataFrame") -> "pd.DataFrame":
    """Return a copy where neutral-prior cells become NaN.

    "Neutral prior" means the source stat was never recorded for that window,
    which the paired `*_known` coverage fraction reports as exactly zero. The
    `*_known` columns themselves are LEFT IN PLACE: they are real measurements
    about the data, a learner that can use them should still see them, and
    removing them here would confound "the tree got NaN" with "the tree lost
    its coverage signal".
    """
    out = frame.copy()
    for flag, columns in NEUTRAL_FILLED_BY_FLAG.items():
        real_flag = flag.replace("_conversion", "")
        if real_flag not in out.columns:
            continue
        blank = out[real_flag] == 0.0
        for column in columns:
            if column in out.columns:
                out.loc[blank, column] = np.nan
    for column, (left, right) in NEUTRAL_FILLED_DIFFS.items():
        if column not in out.columns:
            continue
        if left not in out.columns or right not in out.columns:
            continue
        out.loc[(out[left] == 0.0) | (out[right] == 0.0), column] = np.nan
    return out


# What a model trains on unless told otherwise. A family is in this tuple
# because `ablate.py` measured it beating the fold-to-fold noise, not because
# it sounded useful. Paired expanding-window folds on hosted Development,
# 13 August 2026, log-loss delta against core with its standard error:
#
#                      EPL                SPL                EL2
#   shots_volume   -0.0040 ±0.0011   -0.0038 ±0.0019   -0.0036 ±0.0009
#   corners        -0.0018 ±0.0008   -0.0074 ±0.0021   -0.0037 ±0.0007
#   conversion     -0.0019 ±0.0005   -0.0003 ±0.0008   -0.0012 ±0.0005
#   halftime       +0.0005 ±0.0004   +0.0007 ±0.0004   -0.0001 ±0.0003
#   congestion     +0.0002 ±0.0003   -0.0003 ±0.0006   -0.0001 ±0.0002
#
# Shots and corners clear the bar in all three leagues; conversion clears it
# in two and is flat in the third, and is kept because it is never harmful and
# is the one family with a mechanism that says it should regress. Half-time
# and congestion are excluded: measured, they are noise, and congestion has a
# known reason to be — cup and European fixtures are not in `ai.raw_matches`,
# so it cannot see the midweeks that matter most.
#
# These are small numbers, and they are meant to be. The reason to trust them
# is the PAIRING: the standard error on the difference is 0.0005 to 0.002,
# against roughly 0.010 on either mean alone. An earlier unpaired measurement
# of the same shot features reported them as noise, which is what an error bar
# ten times too wide will do to a real effect.
DEFAULT_GROUPS: tuple[str, ...] = ("core", "shots_volume", "corners", "conversion")


# Bumped when the MEANING of a feature changes without its NAME changing.
#
# 'f1' is everything up to and including contract 185. 'f2' is this change:
# `elo_home`, `elo_away`, `elo_diff` and `elo_expected_home` are all still
# spelled the same and are all computed under a different between-seasons
# transition, and `division_prior` now knows about the National League. A
# name-for-name column check cannot see any of that, which is exactly why the
# version is stored on the artefact and compared on load.
FEATURES_VERSION = "f2"


def feature_names(groups: "tuple[str, ...] | list[str] | None" = None) -> list[str]:
    """Resolve a group selection to an ordered, de-duplicated column list."""
    chosen = tuple(groups) if groups else DEFAULT_GROUPS
    unknown = [g for g in chosen if g not in FEATURE_GROUPS]
    if unknown:
        raise ValueError(f"unknown feature groups: {unknown}; "
                         f"known: {sorted(FEATURE_GROUPS)}")
    out: list[str] = []
    for group in chosen:
        for name in FEATURE_GROUPS[group]:
            if name not in out:
                out.append(name)
    return out


ALL_FEATURE_NAMES: list[str] = feature_names(tuple(FEATURE_GROUPS))

# Backwards compatible: the name the rest of the package already imports.
FEATURE_NAMES: list[str] = feature_names()


# ---------------------------------------------------------------------------
# Coverage-regime guard
#
# PREDECLARED in the same document as the transfer study. The dangerous state
# is a `*_known` indicator that is NEAR zero across the training window but
# not exactly zero. Exactly zero is safe: a constant column admits no
# coefficient at all. Near-zero is not: SCH 1718 trains on coverage of
# 0.000, 0.008, 0.017, 0.007, 0.011 — a handful of matches in nearly nine
# hundred — which admits a coefficient fitted on almost no support, and that
# coefficient then multiplies a feature active across 92.6% of the next
# season's rows.
#
# The rule is written against MEASURED SUPPORT and never against a league.
# `if league == "SCH"` would fix one fold and leave the mechanism live
# everywhere else, and its real test is being a no-op in the eight leagues
# whose histories contain the same break without the same harm.
# ---------------------------------------------------------------------------

# The indicator that says how much of a family's window was actually observed.
# Derived from FEATURE_GROUPS rather than retyped, so a family that gains or
# loses an indicator cannot fall out of step with this table.
def known_indicators(group: str) -> tuple[str, ...]:
    return tuple(c for c in FEATURE_GROUPS.get(group, ()) if c.endswith("_known"))


# Below this mean support a family is treated as unavailable. Declared before
# the first run. SCH 1718's training coverage tops out at 0.017, so 0.05 is
# comfortably above the regime this exists to catch and comfortably below the
# 0.9+ a genuinely covered family carries — the gap is two orders of
# magnitude, so the threshold is not a tuned quantity.
COVERAGE_SUPPORT_FLOOR = 0.05

# `core` is never dropped: `home_matches_known` counts matches played, which
# is always observed, and dropping core would leave no model at all.
COVERAGE_PROTECTED_GROUPS = ("core",)


def groups_with_support(train, groups, floor: float = COVERAGE_SUPPORT_FLOOR):
    """The subset of `groups` whose coverage indicators clear the floor.

    Returns (kept, dropped). A family with no indicator cannot be measured
    this way and is always kept — silence is not evidence of absence.
    """
    kept, dropped = [], []
    for group in groups:
        indicators = known_indicators(group)
        if group in COVERAGE_PROTECTED_GROUPS or not indicators:
            kept.append(group)
            continue
        present = [c for c in indicators if c in train.columns]
        if not present:
            kept.append(group)
            continue
        support = float(train[present].to_numpy().mean())
        (kept if support >= floor else dropped).append(group)
    return tuple(kept), tuple(dropped)


# ---------------------------------------------------------------------------
# Newcomer goal-state transfer
#
# PREDECLARED in docs/quality/investigations/
# 2026-08-13-newcomer-goal-transfer-predeclaration.md, before any candidate was
# implemented. The candidates and the adoption rule are fixed there.
#
# The defect: `roll_season` resets the season counters and deliberately does
# NOT clear the form deques, which is correct within a division and wrong
# across one. A club promoted from League One enters August carrying League
# One goal rates. Contract 188 fixed the RATING half of exactly this by
# shrinking Elo toward `division_prior`; nothing did the same to the goal
# level, so the model is handed a club whose rating says "Championship
# newcomer" and whose goal features say "League One promotion winner".
#
# `season_gd_pm` is deliberately NOT touched: `roll_season` zeroes the season
# counters, so that feature is already measured inside the new division. Only
# the deque-derived rates cross the boundary.
# ---------------------------------------------------------------------------
NEWCOMER_TRANSFER_POLICIES = ("current", "prior_shrink", "decaying_blend",
                              "elo_informed")
NEWCOMER_TRANSFER_DEFAULT = "current"

# Candidate B: a fixed share of the target division's prior, all season.
NEWCOMER_PRIOR_SHRINK_LAMBDA = 0.5
# Candidate C: w(n) = k / (k + n), n = matches played in the new division.
# k = 6 puts the weight at one half after six matches, which is inside the
# "first 5 / first 10" window the study reports separately. The value is
# declared here rather than searched: the predeclaration forbids a grid.
NEWCOMER_BLEND_K = 6.0
# Candidate D: goals per 100 Elo points of departure from the division's own
# mean rating. A single declared constant, not a fitted one — fitting it would
# put a second, unmeasured model inside a feature, which is the objection the
# predeclaration records against this candidate.
NEWCOMER_ELO_GOALS_PER_100 = 0.10

# Goal rates that are carried by the form deques and therefore cross a
# division change. Named once so the study, the test and the row builder
# cannot disagree about what was adjusted.
TRANSFERRED_GOAL_RATES = ("gf", "ga")


def _transfer_weight(policy: str, played_in_division: int) -> float:
    """How much of the target division's prior to use, in [0, 1]."""
    if policy == "prior_shrink":
        return NEWCOMER_PRIOR_SHRINK_LAMBDA
    if policy == "decaying_blend":
        return NEWCOMER_BLEND_K / (NEWCOMER_BLEND_K + float(played_in_division))
    return 0.0


def _transfer_goal_rates(state: "TeamState", division: str | None, policy: str,
                         division_goal_prior, form_all: dict, form_venue: dict):
    """Move a moved club's carried goal rates toward its new division's level.

    Returns the two form dicts unchanged for the default policy, for a club
    that has not changed division, and when no prior is available — so every
    path that is not the studied one is untouched rather than approximately
    untouched.
    """
    if policy == NEWCOMER_TRANSFER_DEFAULT or division_goal_prior is None:
        return form_all, form_venue
    if policy not in NEWCOMER_TRANSFER_POLICIES:
        raise ValueError(f"unknown newcomer transfer policy: {policy!r}; "
                         f"known: {list(NEWCOMER_TRANSFER_POLICIES)}")
    if state.division_move_into(division) == 0:
        return form_all, form_venue
    prior = division_goal_prior(division)
    if prior is None:
        return form_all, form_venue

    if policy == "elo_informed":
        # The club's strength relative to its NEW division's mean rating,
        # expressed as goals. It replaces the carried rate outright rather
        # than blending, because the candidate's whole claim is that the
        # rating knows the division and the carried rate does not.
        edge = (state.elo - division_prior(division)) / 100.0
        scored = max(prior + NEWCOMER_ELO_GOALS_PER_100 * edge, 0.05)
        conceded = max(prior - NEWCOMER_ELO_GOALS_PER_100 * edge, 0.05)
        target = {"gf": scored, "ga": conceded}
        weight = 1.0
    else:
        target = {"gf": prior, "ga": prior}
        weight = _transfer_weight(policy, state.season_played)

    out = []
    for form in (form_all, form_venue):
        moved = dict(form)
        for key in TRANSFERRED_GOAL_RATES:
            if key in moved:
                moved[key] = weight * target[key] + (1.0 - weight) * moved[key]
        out.append(moved)
    return out[0], out[1]


def _row_from_state(
    home: TeamState, away: TeamState, when: date, season_progress: float,
    division: str | None = None,
    newcomer_transfer: str = NEWCOMER_TRANSFER_DEFAULT,
    division_goal_prior=None,
) -> dict[str, float]:
    hf = home.form(5, "all")
    af = away.form(5, "all")
    hv = home.form(6, "home")
    av = away.form(6, "away")
    # Goal-rate transfer across a division change. A no-op under the default
    # policy and for any club that has not moved, so the row is byte-identical
    # to the one this function built before the policy existed.
    hf, hv = _transfer_goal_rates(home, division, newcomer_transfer,
                                  division_goal_prior, hf, hv)
    af, av = _transfer_goal_rates(away, division, newcomer_transfer,
                                  division_goal_prior, af, av)
    hs = home.season_view()
    as_ = away.season_view()
    hc = home.congestion(when)
    ac = away.congestion(when)

    return {
        "elo_diff": home.elo - away.elo,
        "elo_home": home.elo,
        "elo_away": away.elo,
        "elo_expected_home": _elo_expected(home.elo, away.elo),
        "home_form5_ppg": hf["ppg"], "home_form5_gf": hf["gf"], "home_form5_ga": hf["ga"],
        "away_form5_ppg": af["ppg"], "away_form5_gf": af["gf"], "away_form5_ga": af["ga"],
        "home_venue_ppg": hv["ppg"], "home_venue_gf": hv["gf"], "home_venue_ga": hv["ga"],
        "away_venue_ppg": av["ppg"], "away_venue_gf": av["gf"], "away_venue_ga": av["ga"],
        "home_season_ppg": hs["ppg"], "away_season_ppg": as_["ppg"],
        "home_season_gd_pm": hs["gd_pm"], "away_season_gd_pm": as_["gd_pm"],
        "form5_ppg_diff": hf["ppg"] - af["ppg"],
        "venue_ppg_diff": hv["ppg"] - av["ppg"],
        "season_ppg_diff": hs["ppg"] - as_["ppg"],
        "season_gd_diff": hs["gd_pm"] - as_["gd_pm"],
        "home_form5_distorted": hf["distorted"],
        "away_form5_distorted": af["distorted"],
        # Chance creation and concession, and how much of each window actually
        # measured it. The ratio is the shape most of the signal lives in: a
        # side out-shooting opponents 6-3 on target is a better side than the
        # scoreline often says, and the reverse decays faster than form does.
        "home_form5_sot_f": hf["sot_f"],
        "home_form5_sot_a": hf["sot_a"],
        "away_form5_sot_f": af["sot_f"],
        "away_form5_sot_a": af["sot_a"],
        "sot_f_diff": hf["sot_f"] - af["sot_f"],
        "sot_a_diff": hf["sot_a"] - af["sot_a"],
        "home_sot_ratio": hf["sot_f"] / max(hf["sot_f"] + hf["sot_a"], 1e-6),
        "away_sot_ratio": af["sot_f"] / max(af["sot_f"] + af["sot_a"], 1e-6),
        "home_sot_known": hf["sot_known"],
        "away_sot_known": af["sot_known"],
        # -- total shots and accuracy ---------------------------------------
        "home_shots_f": hf["shots_f"], "home_shots_a": hf["shots_a"],
        "away_shots_f": af["shots_f"], "away_shots_a": af["shots_a"],
        "shots_f_diff": hf["shots_f"] - af["shots_f"],
        "home_sot_pct": hf["sot_pct"], "away_sot_pct": af["sot_pct"],
        "home_shots_known": hf["shots_known"], "away_shots_known": af["shots_known"],
        # -- conversion, the regression candidates ---------------------------
        "home_goals_per_sot": hf["goals_per_sot"],
        "away_goals_per_sot": af["goals_per_sot"],
        "home_conceded_per_sot": hf["conceded_per_sot"],
        "away_conceded_per_sot": af["conceded_per_sot"],
        "goals_per_sot_diff": hf["goals_per_sot"] - af["goals_per_sot"],
        # -- territory --------------------------------------------------------
        "home_corners_f": hf["corners_f"], "home_corners_a": hf["corners_a"],
        "away_corners_f": af["corners_f"], "away_corners_a": af["corners_a"],
        "corners_diff": (hf["corners_f"] - hf["corners_a"]) - (af["corners_f"] - af["corners_a"]),
        "home_corners_known": hf["corners_known"], "away_corners_known": af["corners_known"],
        # -- result against performance ---------------------------------------
        "home_overperformance": hf["overperf"], "away_overperformance": af["overperf"],
        "overperformance_diff": hf["overperf"] - af["overperf"],
        "home_perf_margin": hf["perf_margin"], "away_perf_margin": af["perf_margin"],
        "perf_margin_diff": hf["perf_margin"] - af["perf_margin"],
        "home_perf_disagree": hf["perf_disagree"], "away_perf_disagree": af["perf_disagree"],
        "home_perf_known": hf["perf_known"], "away_perf_known": af["perf_known"],
        # -- discipline --------------------------------------------------------
        "home_fouls_f": hf["fouls_f"], "home_fouls_a": hf["fouls_a"],
        "away_fouls_f": af["fouls_f"], "away_fouls_a": af["fouls_a"],
        "home_cards_f": hf["cards_f"], "home_cards_a": hf["cards_a"],
        "away_cards_f": af["cards_f"], "away_cards_a": af["cards_a"],
        "home_reds_f": hf["reds_f"], "away_reds_f": af["reds_f"],
        "fouls_f_diff": hf["fouls_f"] - af["fouls_f"],
        "cards_f_diff": hf["cards_f"] - af["cards_f"],
        "home_discipline_known": hf["discipline_known"],
        "away_discipline_known": af["discipline_known"],
        # -- halves -----------------------------------------------------------
        "home_ht_gf": hf["ht_gf"], "home_ht_ga": hf["ht_ga"],
        "away_ht_gf": af["ht_gf"], "away_ht_ga": af["ht_ga"],
        "home_sh_gf": hf["sh_gf"], "home_sh_ga": hf["sh_ga"],
        "away_sh_gf": af["sh_gf"], "away_sh_ga": af["sh_ga"],
        "ht_gd_diff": (hf["ht_gf"] - hf["ht_ga"]) - (af["ht_gf"] - af["ht_ga"]),
        "home_ht_known": hf["ht_known"], "away_ht_known": af["ht_known"],
        # -- congestion --------------------------------------------------------
        "home_matches_7d": hc["matches_7d"], "away_matches_7d": ac["matches_7d"],
        "home_matches_14d": hc["matches_14d"], "away_matches_14d": ac["matches_14d"],
        "home_third_in_7d": hc["third_in_7d"], "away_third_in_7d": ac["third_in_7d"],
        "home_fourth_in_14d": hc["fourth_in_14d"], "away_fourth_in_14d": ac["fourth_in_14d"],
        "matches_7d_diff": hc["matches_7d"] - ac["matches_7d"],
        "home_rest_days": home.rest_days(when),
        "away_rest_days": away.rest_days(when),
        "rest_diff": home.rest_days(when) - away.rest_days(when),
        "home_matches_known": float(min(len(home.recent), 10)),
        "away_matches_known": float(min(len(away.recent), 10)),
        # A club with almost no top-flight history is a different prediction
        # problem, and telling the model so is better than pretending otherwise.
        "home_is_newcomer": 1.0 if home.top_flight_matches < 10 else 0.0,
        "away_is_newcomer": 1.0 if away.top_flight_matches < 10 else 0.0,
        "season_progress": season_progress,
    }


class FeatureBuilder:
    """Walks matches in date order, emitting a feature row per match.

    Use `build_training_frame` for history. Keep the returned builder and call
    `features_for_fixture` to score a future match against the state as it
    stands at the end of the walk — that is exactly the same code path the
    training rows went through, which is what stops train and predict drifting
    apart.
    """

    def __init__(self, top_division: str,
                 elo_transition: str = ELO_TRANSITION_DEFAULT,
                 elo_margin_policy: str = ELO_MARGIN_POLICY_DEFAULT,
                 schedule_context=None,
                 newcomer_transfer: str = NEWCOMER_TRANSFER_DEFAULT) -> None:
        self.top_division = top_division
        if elo_transition not in ELO_TRANSITIONS:
            raise ValueError(f"unknown Elo transition: {elo_transition!r}; "
                             f"known: {list(ELO_TRANSITIONS)}")
        if elo_margin_policy not in ELO_MARGIN_POLICIES:
            raise ValueError(f"unknown Elo margin policy: {elo_margin_policy!r}; "
                             f"known: {list(ELO_MARGIN_POLICIES)}")
        if newcomer_transfer not in NEWCOMER_TRANSFER_POLICIES:
            raise ValueError(
                f"unknown newcomer transfer policy: {newcomer_transfer!r}; "
                f"known: {list(NEWCOMER_TRANSFER_POLICIES)}")
        self.elo_transition = elo_transition
        self.elo_margin_policy = elo_margin_policy
        self.schedule_context = schedule_context
        self.newcomer_transfer = newcomer_transfer
        # Goals per team-match, per division, accumulated as the walk passes
        # each match. Leak-free BY CONSTRUCTION rather than by a date filter:
        # the builder walks in date order and a division's total is updated
        # only after the row for that match has been emitted, so a prior can
        # never contain the fixture it is used to predict, nor its season.
        self._division_goals: dict[str, list[float]] = {}
        # A plain dict, not a defaultdict: every club must enter through
        # `_state_for`, which seeds its rating from the division it first
        # appears in. A defaultdict would silently hand back an unseeded
        # 1500 to any code path that forgot.
        self.state: dict[str, TeamState] = {}
        self._pending: list[tuple] = []
        self._pending_date: date | None = None

    # -- division goal level -------------------------------------------------

    # Below this many team-matches a division's mean is noise, and shrinking a
    # club toward noise is worse than leaving its own history alone. The
    # transfer is skipped entirely rather than applied weakly.
    MIN_DIVISION_PRIOR_MATCHES = 200

    def _observe_division_goals(self, division: str | None,
                                home_goals, away_goals) -> None:
        if division is None or home_goals is None or away_goals is None:
            return
        bucket = self._division_goals.setdefault(division, [0.0, 0.0])
        bucket[0] += float(home_goals) + float(away_goals)
        bucket[1] += 2.0            # two team-matches per fixture

    def division_goal_prior(self, division: str | None) -> float | None:
        """Mean goals scored per team per match in this division, so far.

        `None` when the division has not been seen enough for the mean to mean
        anything, which the caller treats as "leave the club's own rates
        alone".
        """
        bucket = self._division_goals.get(division or "")
        if bucket is None or bucket[1] < self.MIN_DIVISION_PRIOR_MATCHES:
            return None
        return bucket[0] / bucket[1]

    # -- internal ------------------------------------------------------------

    def _flush(self) -> None:
        """Apply every result buffered for the previous date. Called only when
        the date advances, so same-day matches never see one another."""
        for (home_name, away_name, hg, ag, when, division, distorted,
             stats) in self._pending:
            top = division == self.top_division
            self.state[home_name].record(
                hg, ag, "home", when, top, division, distorted,
                sot_f=stats["h_sot"], sot_a=stats["a_sot"],
                shots_f=stats["h_shots"], shots_a=stats["a_shots"],
                corners_f=stats["h_corners"], corners_a=stats["a_corners"],
                ht_gf=stats["h_ht"], ht_ga=stats["a_ht"],
                fouls_f=stats["h_fouls"], fouls_a=stats["a_fouls"],
                cards_f=stats["h_cards"], cards_a=stats["a_cards"],
                reds_f=stats["h_reds"])
            self.state[away_name].record(
                ag, hg, "away", when, top, division, distorted,
                sot_f=stats["a_sot"], sot_a=stats["h_sot"],
                shots_f=stats["a_shots"], shots_a=stats["h_shots"],
                corners_f=stats["a_corners"], corners_a=stats["h_corners"],
                ht_gf=stats["a_ht"], ht_ga=stats["h_ht"],
                fouls_f=stats["a_fouls"], fouls_a=stats["h_fouls"],
                cards_f=stats["a_cards"], cards_a=stats["h_cards"],
                reds_f=stats["a_reds"])

            h, a = self.state[home_name], self.state[away_name]
            expected = _elo_expected(h.elo, a.elo)
            actual = 1.0 if hg > ag else (0.5 if hg == ag else 0.0)
            mult = _elo_margin_multiplier(hg - ag, (h.elo + ELO_HOME_ADV) - a.elo)
            if distorted and self.elo_margin_policy == "red_card_aware":
                # Damp the MARGIN term only. The win, draw or defeat still
                # moves the rating by its full amount; what is discounted is
                # the extra credit a wide scoreline earns, which is the part a
                # sending-off actually manufactures.
                mult = 1.0 + (mult - 1.0) * ELO_DISTORTED_DAMPING
            delta = ELO_K * mult * (actual - expected)
            h.elo += delta
            a.elo -= delta
        self._pending.clear()

    def _state_for(self, name: str, division: str,
                   season: str | None = None) -> TeamState:
        """Fetch a club's state, seeding a first-seen club by its division.

        `ELO_DIVISION_OFFSET` was defined with the comment "a promoted club is
        not a mid-table top-flight club" and then never read — the constant
        appeared exactly once in this file, at its own definition. So every
        club entered the pool at 1500 regardless of where it entered, and a
        League Two side arriving in the archive was rated identically to a
        Premier League side arriving in it, which is a 430-point error by the
        table's own numbers.

        Once a club has played, its rating is earned rather than assumed: the
        offset seeds and is never re-applied, so a promoted club carries the
        rating it actually built rather than being pushed back down for
        changing division. Ratings across divisions share one pool because
        clubs move between them, and that is what makes the pool comparable.
        """
        if name not in self.state:
            state = TeamState()
            state.elo = division_prior(division)
            # The seed division is also the first anchor: a club seeded in
            # League Two and then rolled into a new season before playing must
            # shrink toward League Two, not toward the Premier League.
            state.division = division
            # The seed is also the club's first season, so the between-seasons
            # regression does not immediately undo it. Without this, a League
            # Two club seeded at 1070 was pulled a quarter of the way back to
            # the mean before its first match — 1177.5 — because `roll_season`
            # fires whenever the stored season differs, and None differs from
            # everything. The counters it would reset are already zero.
            state.season = season
            # Cup and European dates, when a schedule context was supplied.
            # Attached at seeding rather than looked up per row so that the
            # congestion counts cost the same whether the context is present
            # or absent.
            if self.schedule_context is not None:
                state.extra_dates = tuple(self.schedule_context.for_team(name))
            self.state[name] = state
        return self.state[name]

    def _advance_to(self, when: date) -> None:
        if self._pending_date is not None and when > self._pending_date:
            self._flush()
        self._pending_date = when

    # -- public --------------------------------------------------------------

    def build_training_frame(self, matches: pd.DataFrame) -> pd.DataFrame:
        """`matches` must have: match_date, home_canonical, away_canonical,
        home_goals, away_goals, result, division, season. Sorted internally."""
        required = {
            "match_date", "home_canonical", "away_canonical",
            "home_goals", "away_goals", "result", "division", "season",
        }
        missing = required - set(matches.columns)
        if missing:
            raise ValueError(f"missing columns: {sorted(missing)}")

        df = matches.sort_values(["match_date", "home_canonical"]).reset_index(drop=True)
        rows: list[dict] = []

        for rec in df.itertuples(index=False):
            when = rec.match_date
            self._advance_to(when)

            home = self._state_for(rec.home_canonical, rec.division, rec.season)
            away = self._state_for(rec.away_canonical, rec.division, rec.season)
            home.roll_season(rec.season, self.elo_transition)
            away.roll_season(rec.season, self.elo_transition)

            season_start, season_end = season_date_bounds(rec.season)
            span = max((season_end - season_start).days, 1)
            progress = min(max((when - season_start).days / span, 0.0), 1.0)

            # Division offset is applied to the *view* of a cross-division
            # opponent, never written back into the rating.
            # Read before the row is built and before anything is observed,
            # so the stratum a row is reported under is the same state the
            # transfer acted on.
            home_move = home.division_move_into(rec.division)
            away_move = away.division_move_into(rec.division)

            feats = _row_from_state(home, away, when, progress,
                                    division=rec.division,
                                    newcomer_transfer=self.newcomer_transfer,
                                    division_goal_prior=self.division_goal_prior)
            # AFTER the row is built, never before: a division's goal level
            # must not contain the match it is being used to predict.
            self._observe_division_goals(rec.division, rec.home_goals,
                                         rec.away_goals)

            rows.append(
                {
                    "match_date": when,
                    "season": rec.season,
                    "division": rec.division,
                    "home_canonical": rec.home_canonical,
                    "away_canonical": rec.away_canonical,
                    "home_goals": rec.home_goals,
                    "away_goals": rec.away_goals,
                    "result": rec.result,
                    # Strata for the newcomer study, captured at the instant
                    # the row was built. METADATA, not features: they are
                    # absent from every FEATURE_GROUPS entry, so no model can
                    # slice them in, and `feature_names()` remains the single
                    # answer to what a model sees. Recorded here rather than
                    # recomputed later because "how many matches had this club
                    # played in this division when this row was built" is not
                    # recoverable from the finished frame.
                    "home_division_move": home_move,
                    "away_division_move": away_move,
                    "home_played_in_division": home.season_played,
                    "away_played_in_division": away.season_played,
                    **feats,
                }
            )

            self._pending.append(
                (rec.home_canonical, rec.away_canonical,
                 int(rec.home_goals), int(rec.away_goals), when, rec.division,
                 bool(getattr(rec, "red_card_distorted", False) or False),
                 {
                     "h_sot": _optional_number(getattr(rec, "home_shots_ot", None)),
                     "a_sot": _optional_number(getattr(rec, "away_shots_ot", None)),
                     "h_shots": _optional_number(getattr(rec, "home_shots", None)),
                     "a_shots": _optional_number(getattr(rec, "away_shots", None)),
                     "h_corners": _optional_number(getattr(rec, "home_corners", None)),
                     "a_corners": _optional_number(getattr(rec, "away_corners", None)),
                     "h_ht": _optional_number(getattr(rec, "ht_home_goals", None)),
                     "a_ht": _optional_number(getattr(rec, "ht_away_goals", None)),
                     "h_fouls": _optional_number(getattr(rec, "home_fouls", None)),
                     "a_fouls": _optional_number(getattr(rec, "away_fouls", None)),
                     "h_cards": _optional_number(getattr(rec, "home_yellows", None)),
                     "a_cards": _optional_number(getattr(rec, "away_yellows", None)),
                     "h_reds": _optional_number(getattr(rec, "home_reds", None)),
                     "a_reds": _optional_number(getattr(rec, "away_reds", None)),
                 })
            )

        self._flush()
        return pd.DataFrame(rows)

    def features_for_fixture(
        self, home_name: str, away_name: str, when: date, season: str,
        season_start: date, season_end: date,
    ) -> dict[str, float]:
        self._flush()
        # A club with no history at all is seeded at this league's own level —
        # a newly promoted side scored before it has played is a top-division
        # club now, not a 1500 default.
        home = self._state_for(home_name, self.top_division, season)
        away = self._state_for(away_name, self.top_division, season)
        home.roll_season(season, self.elo_transition)
        away.roll_season(season, self.elo_transition)
        span = max((season_end - season_start).days, 1)
        progress = min(max((when - season_start).days / span, 0.0), 1.0)
        # The same policy the training rows went through. A fixture scored
        # under a different transfer from the one the model was fitted on is
        # the train/predict drift this class exists to prevent.
        return _row_from_state(home, away, when, progress,
                               division=self.top_division,
                               newcomer_transfer=self.newcomer_transfer,
                               division_goal_prior=self.division_goal_prior)
