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

from collections import defaultdict, deque
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
    "E0": 0.0, "E1": -180.0, "E2": -320.0, "E3": -430.0,
    "SC0": 0.0, "SC1": -170.0, "SC2": -300.0, "SC3": -400.0,
}


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
    # Kick-off dates, for congestion. Rest days answers 'how long since
    # the last one'; it cannot answer 'how many in the last fortnight',
    # which is the question a third match in seven days poses.
    match_dates: deque = field(default_factory=lambda: deque(maxlen=12))

    def roll_season(self, season: str) -> None:
        if self.season == season:
            return
        # Between seasons ratings regress toward the mean: squads change, and a
        # club's June rating overstates how much is actually known in August.
        self.elo = self.elo + (ELO_START - self.elo) * ELO_SEASON_REGRESSION
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
        shots_a_tot = sum(r["shots_a"] for r in total_rows)

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

        League fixtures only, for now: cup and European matches are not in
        `ai.raw_matches`, so a Premier League club's Thursday in Europe is
        invisible here. That is a real limitation and it understates
        congestion for exactly the clubs that suffer it most.
        """
        last7 = sum(1 for d in self.match_dates if 0 < (today - d).days <= 7)
        last14 = sum(1 for d in self.match_dates if 0 < (today - d).days <= 14)
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
               distorted: bool = False,
               sot_f: float | None = None, sot_a: float | None = None,
               shots_f: float | None = None, shots_a: float | None = None,
               corners_f: float | None = None, corners_a: float | None = None,
               ht_gf: float | None = None, ht_ga: float | None = None) -> None:
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
        row = {"pts": pts, "gf": gf, "ga": ga, "distorted": 1 if distorted else 0,
               "sot_f": sot_f, "sot_a": sot_a,
               "shots_f": shots_f, "shots_a": shots_a,
               "corners_f": corners_f, "corners_a": corners_a,
               "ht_gf": ht_gf, "ht_ga": ht_ga}
        self.match_dates.append(when)
        self.recent.append(row)
        (self.recent_home if venue == "home" else self.recent_away).append(row)
        self.season_played += 1
        self.season_points += pts
        self.season_gf += gf
        self.season_ga += ga
        self.last_played = when
        if top_flight:
            self.top_flight_matches += 1


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
    "congestion": (
        "home_matches_7d", "away_matches_7d",
        "home_matches_14d", "away_matches_14d",
        "home_third_in_7d", "away_third_in_7d",
        "home_fourth_in_14d", "away_fourth_in_14d",
        "matches_7d_diff",
    ),
}

# What a model trains on unless told otherwise. Only `core` is in it: every
# other family is a claim that has to earn its place through `ablate.py`,
# because a null result measured once is not a reason to carry ten features
# for ever. Groups a model was trained with are recorded on the model row.
DEFAULT_GROUPS: tuple[str, ...] = ("core",)


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


def _row_from_state(
    home: TeamState, away: TeamState, when: date, season_progress: float
) -> dict[str, float]:
    hf = home.form(5, "all")
    af = away.form(5, "all")
    hv = home.form(6, "home")
    av = away.form(6, "away")
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

    def __init__(self, top_division: str) -> None:
        self.top_division = top_division
        # A plain dict, not a defaultdict: every club must enter through
        # `_state_for`, which seeds its rating from the division it first
        # appears in. A defaultdict would silently hand back an unseeded
        # 1500 to any code path that forgot.
        self.state: dict[str, TeamState] = {}
        self._pending: list[tuple] = []
        self._pending_date: date | None = None

    # -- internal ------------------------------------------------------------

    def _flush(self) -> None:
        """Apply every result buffered for the previous date. Called only when
        the date advances, so same-day matches never see one another."""
        for (home_name, away_name, hg, ag, when, division, distorted,
             stats) in self._pending:
            top = division == self.top_division
            self.state[home_name].record(
                hg, ag, "home", when, top, distorted,
                sot_f=stats["h_sot"], sot_a=stats["a_sot"],
                shots_f=stats["h_shots"], shots_a=stats["a_shots"],
                corners_f=stats["h_corners"], corners_a=stats["a_corners"],
                ht_gf=stats["h_ht"], ht_ga=stats["a_ht"])
            self.state[away_name].record(
                ag, hg, "away", when, top, distorted,
                sot_f=stats["a_sot"], sot_a=stats["h_sot"],
                shots_f=stats["a_shots"], shots_a=stats["h_shots"],
                corners_f=stats["a_corners"], corners_a=stats["h_corners"],
                ht_gf=stats["a_ht"], ht_ga=stats["h_ht"])

            h, a = self.state[home_name], self.state[away_name]
            expected = _elo_expected(h.elo, a.elo)
            actual = 1.0 if hg > ag else (0.5 if hg == ag else 0.0)
            mult = _elo_margin_multiplier(hg - ag, (h.elo + ELO_HOME_ADV) - a.elo)
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
            state.elo = ELO_START + ELO_DIVISION_OFFSET.get(division, 0.0)
            # The seed is also the club's first season, so the between-seasons
            # regression does not immediately undo it. Without this, a League
            # Two club seeded at 1070 was pulled a quarter of the way back to
            # the mean before its first match — 1177.5 — because `roll_season`
            # fires whenever the stored season differs, and None differs from
            # everything. The counters it would reset are already zero.
            state.season = season
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
            home.roll_season(rec.season)
            away.roll_season(rec.season)

            season_start, season_end = season_date_bounds(rec.season)
            span = max((season_end - season_start).days, 1)
            progress = min(max((when - season_start).days / span, 0.0), 1.0)

            # Division offset is applied to the *view* of a cross-division
            # opponent, never written back into the rating.
            feats = _row_from_state(home, away, when, progress)

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
        home.roll_season(season)
        away.roll_season(season)
        span = max((season_end - season_start).days, 1)
        progress = min(max((when - season_start).days / span, 0.0), 1.0)
        return _row_from_state(home, away, when, progress)
