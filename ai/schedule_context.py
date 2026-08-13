"""The midweeks the league table cannot see.

`ai.raw_matches` holds league fixtures. It does not hold the Champions League,
the Europa League, the Conference League, the FA Cup, the League Cup, the
Scottish Cup or the Scottish League Cup — which is to say it does not hold the
matches that make a fixture pile-up a pile-up. The congestion features measured
as noise for a reason that has nothing to do with whether fixture congestion
matters: they were counting Saturdays.

That is exactly the wrong reason to conclude anything, and it is why
`congestion` sits outside DEFAULT_GROUPS with a note saying so rather than
being deleted. A null result from an instrument that cannot see the phenomenon
is not evidence about the phenomenon.

This module is the missing input, and it deliberately arrives through
`ai.observations` rather than through a new table. That store already exists,
is already append-only, and already carries the one property this data must
have: `known_at`, so a backtest cannot learn on Monday about a cup replay
scheduled on Wednesday. A parallel `ai.cup_fixtures` table would need its own
bitemporal machinery and would be a second thing to keep honest.

WHAT THIS MODULE DOES NOT DO. It does not fetch. There is no free, verified
feed for these competitions in this repository's provider audit, and spending
paid provider calls to develop logic is explicitly not how this lab works. So
it reads what has been recorded, reports honestly how little that currently is,
and refuses to let the congestion family be enabled on a feed that covers a
handful of clubs — because a congestion count that sees Arsenal's Tuesdays and
not Brighton's is worse than one that sees neither: it is a systematic error
correlated with exactly the clubs the feature is about.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone

import pandas as pd

# The competitions a complete workload picture needs for the nine modelled
# leagues. Named so that coverage can be reported per competition rather than
# as one reassuring percentage.
REQUIRED_COMPETITIONS = (
    "uefa_champions_league",
    "uefa_europa_league",
    "uefa_conference_league",
    "fa_cup",
    "efl_cup",
    "efl_trophy",
    "scottish_cup",
    "scottish_league_cup",
    "scottish_challenge_cup",
    "playoffs",
)

# `ai.observations.fact_type` for a scheduled or played match outside the
# league programme. One row per (team, match), value carrying the competition
# and the opponent.
FACT_TYPE = "schedule_match"

# Below this share of a league's clubs carrying at least one such observation,
# the feed is not usable for a congestion feature. Set high on purpose: partial
# coverage is not a smaller version of full coverage, it is a bias.
MIN_TEAM_COVERAGE = 0.90


@dataclass
class ScheduleContext:
    """Extra fixture dates per club, as known at a stated instant."""

    as_of: datetime
    dates_by_team: dict[str, list[date]] = field(default_factory=dict)
    competitions_seen: set[str] = field(default_factory=set)
    source: str = "ai.observations"

    def for_team(self, team: str) -> list[date]:
        return self.dates_by_team.get(team, [])

    def coverage(self, teams) -> dict:
        teams = sorted(set(teams))
        covered = [t for t in teams if self.dates_by_team.get(t)]
        share = (len(covered) / len(teams)) if teams else 0.0
        missing_competitions = [c for c in REQUIRED_COMPETITIONS
                                if c not in self.competitions_seen]
        usable = bool(teams) and share >= MIN_TEAM_COVERAGE
        return {
            "teams": len(teams),
            "teams_with_context": len(covered),
            "team_coverage": round(share, 4),
            "competitions_seen": sorted(self.competitions_seen),
            "competitions_missing": missing_competitions,
            "usable_for_congestion": usable,
            "verdict": ("usable" if usable else
                        "INSUFFICIENT_DATA: partial cup and European coverage is "
                        "a bias, not a smaller version of full coverage — it is "
                        "missing precisely for the clubs congestion is about"),
        }


def empty_context(as_of: datetime | None = None) -> ScheduleContext:
    return ScheduleContext(as_of=as_of or datetime.now(timezone.utc))


def load_schedule_context(as_of: datetime | None = None) -> ScheduleContext:
    """Read every non-league fixture this system knew about at `as_of`.

    The leakage guarantee is `ai.observations_as_of`'s, not this function's:
    it filters on `known_at <= p_as_of` inside the database, so a caller that
    forgets cannot break it.
    """
    from db import query_df

    as_of = as_of or datetime.now(timezone.utc)
    frame = query_df(
        "select subject_key, applies_from, value "
        "  from ai.observations_as_of(%s, %s, 'team')",
        (as_of, FACT_TYPE),
    )
    context = ScheduleContext(as_of=as_of)
    if frame.empty:
        return context
    for row in frame.to_dict("records"):
        when = row["applies_from"]
        if isinstance(when, (datetime, pd.Timestamp)):
            when = when.date()
        context.dates_by_team.setdefault(row["subject_key"], []).append(when)
        competition = (row.get("value") or {}).get("competition")
        if competition:
            context.competitions_seen.add(str(competition))
    for team in context.dates_by_team:
        context.dates_by_team[team] = sorted(set(context.dates_by_team[team]))
    return context


def context_from_records(records, as_of: datetime | None = None) -> ScheduleContext:
    """Build a context from plain dicts, for tests and for a future importer.

    Each record: {"team": str, "match_date": date, "competition": str}.
    """
    context = ScheduleContext(as_of=as_of or datetime.now(timezone.utc),
                              source="records")
    for row in records:
        context.dates_by_team.setdefault(row["team"], []).append(row["match_date"])
        if row.get("competition"):
            context.competitions_seen.add(str(row["competition"]))
    for team in context.dates_by_team:
        context.dates_by_team[team] = sorted(set(context.dates_by_team[team]))
    return context
