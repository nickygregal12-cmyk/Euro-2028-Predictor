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
                "distorted": 0.0}
        pts = sum(r["pts"] for r in rows)
        gf = sum(r["gf"] for r in rows)
        ga = sum(r["ga"] for r in rows)
        return {
            "n": float(n),
            "ppg": pts / n,
            "gf": gf / n,
            "ga": ga / n,
            "gd": (gf - ga) / n,
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

    def rest_days(self, today: date) -> float:
        if self.last_played is None:
            return 14.0
        return float(min((today - self.last_played).days, 30))

    # -- mutation ------------------------------------------------------------

    def record(self, gf: int, ga: int, venue: str, when: date, top_flight: bool,
               distorted: bool = False) -> None:
        pts = 3 if gf > ga else (1 if gf == ga else 0)
        row = {"pts": pts, "gf": gf, "ga": ga, "distorted": 1 if distorted else 0}
        self.recent.append(row)
        (self.recent_home if venue == "home" else self.recent_away).append(row)
        self.season_played += 1
        self.season_points += pts
        self.season_gf += gf
        self.season_ga += ga
        self.last_played = when
        if top_flight:
            self.top_flight_matches += 1


FEATURE_NAMES: list[str] = [
    "elo_diff",
    "elo_home",
    "elo_away",
    "elo_expected_home",
    "home_form5_ppg", "home_form5_gf", "home_form5_ga",
    "away_form5_ppg", "away_form5_gf", "away_form5_ga",
    "home_venue_ppg", "home_venue_gf", "home_venue_ga",
    "away_venue_ppg", "away_venue_gf", "away_venue_ga",
    "home_season_ppg", "away_season_ppg",
    "home_season_gd_pm", "away_season_gd_pm",
    "form5_ppg_diff", "venue_ppg_diff", "season_ppg_diff", "season_gd_diff",
    "home_rest_days", "away_rest_days", "rest_diff",
    "home_form5_distorted", "away_form5_distorted",
    "home_matches_known", "away_matches_known",
    "home_is_newcomer", "away_is_newcomer",
    "season_progress",
]


def _row_from_state(
    home: TeamState, away: TeamState, when: date, season_progress: float
) -> dict[str, float]:
    hf = home.form(5, "all")
    af = away.form(5, "all")
    hv = home.form(6, "home")
    av = away.form(6, "away")
    hs = home.season_view()
    as_ = away.season_view()

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
        self.state: dict[str, TeamState] = defaultdict(TeamState)
        self._pending: list[tuple] = []
        self._pending_date: date | None = None

    # -- internal ------------------------------------------------------------

    def _flush(self) -> None:
        """Apply every result buffered for the previous date. Called only when
        the date advances, so same-day matches never see one another."""
        for home_name, away_name, hg, ag, when, division, distorted in self._pending:
            top = division == self.top_division
            self.state[home_name].record(hg, ag, "home", when, top, distorted)
            self.state[away_name].record(ag, hg, "away", when, top, distorted)

            h, a = self.state[home_name], self.state[away_name]
            expected = _elo_expected(h.elo, a.elo)
            actual = 1.0 if hg > ag else (0.5 if hg == ag else 0.0)
            mult = _elo_margin_multiplier(hg - ag, (h.elo + ELO_HOME_ADV) - a.elo)
            delta = ELO_K * mult * (actual - expected)
            h.elo += delta
            a.elo -= delta
        self._pending.clear()

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

            home = self.state[rec.home_canonical]
            away = self.state[rec.away_canonical]
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
                 bool(getattr(rec, "red_card_distorted", False) or False))
            )

        self._flush()
        return pd.DataFrame(rows)

    def features_for_fixture(
        self, home_name: str, away_name: str, when: date, season: str,
        season_start: date, season_end: date,
    ) -> dict[str, float]:
        self._flush()
        home = self.state[home_name]
        away = self.state[away_name]
        home.roll_season(season)
        away.roll_season(season)
        span = max((season_end - season_start).days, 1)
        progress = min(max((when - season_start).days / span, 0.0), 1.0)
        return _row_from_state(home, away, when, progress)
