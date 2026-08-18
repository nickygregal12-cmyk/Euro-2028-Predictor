"""Domestic cup competitions, as a research path rather than a weekend script.

Four competitions are declared here — the two Scottish ones first because
that is where the near-term fixtures are, then the two English ones — and
nothing in the module knows about a particular round or a particular date. A
tie is a tie: two canonical clubs, a kickoff, and a round label.

WHAT THIS PREDICTS, EXACTLY ONCE, SO IT CANNOT DRIFT.

  The 90-MINUTE result. Home win, draw, away win, at full time.

  NOT who goes through. A cup tie that is level after ninety minutes goes to
  extra time and possibly penalties, and in some competitions to a replay.
  "Draw" and "eliminated" are different events with different probabilities,
  and a model trained on league matches has seen the first and never the
  second. Collapsing them is the single easiest way to produce a number that
  looks like a qualification probability and is not one, so `CupForecast`
  has no field for qualification and `refuse_qualification` exists to make
  the omission deliberate rather than forgotten.

WHY THE LEAGUE MODELS DO NOT SIMPLY TRANSFER.

  A league model is fitted on one division's matches. `LEAGUES["SPL"]` trains
  on SC0 and carries SC1 only so a promoted club arrives with form; every
  fitted coefficient describes the Premiership. A cup tie between a
  Premiership club and a League One club is outside that training domain in a
  way a league fixture never is, and the three model families do not degrade
  equally when it happens:

    elo       Extrapolates HONESTLY. A rating is a single number on one scale,
              `ELO_DIVISION_OFFSET` places every division on that scale, and
              the expected score of a 1500 against a 1200 is defined whether
              or not the pair have ever met. This is the family to trust
              across tiers, and it is why `elo` is the declared cup default.

    poisson   Extrapolates BADLY but predictably. Two goal-rate regressions
              fitted on Premiership matches applied to a League One club's
              features produce a scoreline grid whose absolute level is wrong
              — lower divisions score at different rates — while the ORDERING
              usually survives.

    logistic  Extrapolates WORST of the three. A regularised linear fit on
              standardised features is only meaningful where the standardiser
              was fitted; a cross-tier fixture sits several standard
              deviations out on `elo_diff` and the linear term keeps going.

    gbm       Cannot extrapolate at all, by construction. A tree predicts the
              training-leaf value beyond the range it saw, so a cross-tier
              `elo_diff` is clipped to the most extreme league fixture in the
              training data. It will be confidently wrong in the SAME
              direction every time, and — see `model_candidates.py` — it is
              currently overfitted on its own home ground anyway.

  None of that is a reason to hide the number. It is a reason to SAY it, which
  is what `cross_tier` and `extrapolation` on a forecast are for.

WHAT THIS MODULE DOES NOT DO. It does not fetch, and it stores nothing. Cup
fixtures reach it as records with a stated source; where they should be
persisted is `docs/ai-lab/domestic-cups.md`, and the short answer is that
`ai.observations` can hold them honestly today while `ai.predictions` cannot
hold a cup forecast without a migration this session deliberately did not make.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from features import DIVISION_RANK

# 90-minute outcomes. Spelled out because the whole point of this module is
# that these three are not the same as "went through".
OUTCOMES = ("H", "D", "A")


@dataclass(frozen=True)
class Cup:
    """One domestic knockout competition.

    `divisions` is every division whose clubs can appear, HIGHEST FIRST. It is
    what makes a cross-tier tie detectable without a per-competition special
    case, and what tells a forecast which league model is the natural one to
    ask.
    """

    key: str
    name: str
    country: str
    divisions: tuple[str, ...]
    #: The league key whose fitted model is the natural default for this cup.
    primary_league: str
    #: Competitions where a level tie is replayed rather than settled the same
    #: night. Recorded because it changes what "draw" MEANS to a spectator,
    #: not because this module predicts it.
    replays: bool = False
    #: `schedule_context.REQUIRED_COMPETITIONS` name, so a cup's fixtures can
    #: be fed to the congestion features under the vocabulary that module
    #: already declares.
    schedule_key: str = ""

    def tier_of(self, division: str | None) -> int | None:
        return DIVISION_RANK.get(division or "")

    def includes(self, division: str | None) -> bool:
        return (division or "") in self.divisions


CUPS: dict[str, Cup] = {
    # First, because it is where the fixtures are.
    "scottish_league_cup": Cup(
        "scottish_league_cup", "Scottish League Cup", "Scotland",
        ("SC0", "SC1", "SC2", "SC3"), "SPL",
        replays=False, schedule_key="scottish_league_cup"),
    "scottish_cup": Cup(
        "scottish_cup", "Scottish Cup", "Scotland",
        ("SC0", "SC1", "SC2", "SC3"), "SPL",
        replays=True, schedule_key="scottish_cup"),
    "fa_cup": Cup(
        "fa_cup", "FA Cup", "England",
        ("E0", "E1", "E2", "E3", "EC"), "EPL",
        replays=True, schedule_key="fa_cup"),
    "efl_cup": Cup(
        "efl_cup", "EFL Cup", "England",
        ("E0", "E1", "E2", "E3"), "EPL",
        replays=False, schedule_key="efl_cup"),
}


@dataclass(frozen=True)
class CupTie:
    """One tie, as published, before anything has been modelled.

    `source` is required and is not decorative. A cup calendar assembled from
    a community-maintained site and one confirmed against the competition's
    own governing body are different kinds of evidence, and a forecast built
    on the first should say so.
    """

    competition: str
    round_name: str
    home_canonical: str
    away_canonical: str
    kickoff_at: datetime
    source: str
    home_division: str | None = None
    away_division: str | None = None
    venue: str | None = None
    #: Set when the published home/away orientation could not be confirmed
    #: against the competition's own source. Home advantage is worth roughly
    #: `ELO_HOME_ADV` = 60 rating points, so an unverified orientation is a
    #: material uncertainty rather than a cosmetic one.
    orientation_confirmed: bool = True

    @property
    def cup(self) -> Cup:
        return CUPS[self.competition]

    @property
    def cross_tier(self) -> bool:
        home, away = self.tiers
        return home is not None and away is not None and home != away

    @property
    def tiers(self) -> tuple[int | None, int | None]:
        cup = self.cup
        return cup.tier_of(self.home_division), cup.tier_of(self.away_division)

    @property
    def tier_gap(self) -> int | None:
        home, away = self.tiers
        if home is None or away is None:
            return None
        return abs(home - away)

    def has_kicked_off(self, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        return now >= self.kickoff_at

    def describe(self) -> dict:
        home_tier, away_tier = self.tiers
        return {
            "competition": self.competition,
            "round": self.round_name,
            "home": self.home_canonical,
            "away": self.away_canonical,
            "kickoff_at": self.kickoff_at.isoformat(),
            "venue": self.venue,
            "home_division": self.home_division,
            "away_division": self.away_division,
            "home_tier": home_tier,
            "away_tier": away_tier,
            "cross_tier": self.cross_tier,
            "tier_gap": self.tier_gap,
            "orientation_confirmed": self.orientation_confirmed,
            "source": self.source,
        }


# ---------------------------------------------------------------------------
# The clock
# ---------------------------------------------------------------------------

class BackdatedForecast(RuntimeError):
    """Raised when a forecast is requested for a tie that has already begun."""


def assert_prospective(tie: CupTie, now: datetime | None = None) -> None:
    """A forecast is only a forecast before kickoff.

    This is a hard refusal rather than a warning. A probability computed after
    a match has started is a different object from one computed before it, and
    the two are indistinguishable once written down — the only defence is to
    make the second impossible to produce by accident.
    """
    now = now or datetime.now(timezone.utc)
    if tie.has_kicked_off(now):
        raise BackdatedForecast(
            f"{tie.home_canonical} v {tie.away_canonical} kicked off at "
            f"{tie.kickoff_at.isoformat()}, which is not after {now.isoformat()}; "
            "a post-kickoff calculation is not a forecast and must not be "
            "presented as one")


def refuse_qualification(*_args, **_kwargs):
    """There is deliberately no qualification probability. See the module docstring."""
    raise NotImplementedError(
        "this path predicts the 90-minute result only. Qualification needs "
        "extra time, penalties and — in the Scottish Cup and FA Cup — replays, "
        "none of which the league history contains a single example of. It is "
        "a separate model with its own evidence, not a transformation of this "
        "one")


# ---------------------------------------------------------------------------
# Data confidence for a cup tie
# ---------------------------------------------------------------------------
#
# Deliberately SEPARATE from calibration, from model agreement and from the
# probability itself. Those are four different statements:
#
#   probability   what the model believes about this tie
#   calibration   whether this model's 60% has historically meant 60%
#   agreement     whether independent families concur on this tie
#   confidence    whether we hold enough of the right EVIDENCE to ask at all
#
# Collapsing any pair of them produces a number that cannot be acted on. This
# function answers only the fourth, and it answers it about DATA.

#: Below this many prior matches for either club, the Elo rating is a seed
#: with a few results on top rather than an earned level.
MIN_MATCHES_FOR_CONFIDENCE = 60


def data_confidence(tie: CupTie, home_matches_known: int,
                    away_matches_known: int) -> dict:
    """What we know about the two clubs, and what that does not cover.

    Returns a band and the reasons for it. The reasons are the useful part: a
    caller that shows only the band has thrown away the thing that lets a
    reader disagree.
    """
    reasons: list[str] = []
    band = "high"

    fewest = min(home_matches_known, away_matches_known)
    if fewest < MIN_MATCHES_FOR_CONFIDENCE:
        band = "low"
        reasons.append(
            f"one club has only {fewest} prior matches in the archive; below "
            f"{MIN_MATCHES_FOR_CONFIDENCE} the rating is mostly its division seed")

    if tie.cross_tier:
        gap = tie.tier_gap or 0
        band = "low" if gap >= 2 else ("medium" if band == "high" else band)
        reasons.append(
            f"cross-tier tie across {gap} division(s): the fitted models were "
            f"trained on one division's matches and this fixture sits outside "
            f"that domain. Elo places both clubs on one scale and extrapolates "
            f"honestly; the goal-rate, linear and tree families do not")

    if tie.home_division is None or tie.away_division is None:
        band = "low"
        reasons.append("a club's division is unknown, so tier context and the "
                       "Elo division prior cannot be established")

    if not tie.orientation_confirmed:
        band = "low"
        reasons.append(
            "the home/away orientation is unconfirmed against the "
            "competition's own source; home advantage is worth roughly 60 "
            "rating points, so this is a material uncertainty in the result "
            "itself and not a labelling detail")

    if not reasons:
        reasons.append("both clubs are well represented in the archive and the "
                       "tie is within a single tier")
    return {"band": band, "reasons": reasons,
            "home_matches_known": home_matches_known,
            "away_matches_known": away_matches_known}


def extrapolation_note(tie: CupTie, family: str) -> str | None:
    """How far outside its training domain this family is being asked to go."""
    if not tie.cross_tier:
        return None
    return {
        "elo": "within domain: a rating is one scale and the division offsets "
               "place both clubs on it",
        "poisson": "OUTSIDE domain: goal rates were fitted on one division; "
                   "expect the level to be wrong even where the ordering holds",
        "logistic": "OUTSIDE domain: a standardised linear fit is only "
                    "meaningful near the range it was standardised on",
        "gbm": "CANNOT extrapolate: a tree returns its most extreme training "
               "leaf, so the cross-tier gap is silently clipped",
        "baseline": "no fixture information at all; division base rates only",
    }.get(family, f"unknown extrapolation behaviour for family {family!r}")


# ---------------------------------------------------------------------------
# The forecast record
# ---------------------------------------------------------------------------

@dataclass
class CupForecast:
    """One 90-minute H/D/A forecast, with everything needed to argue with it."""

    tie: CupTie
    p_home: float
    p_draw: float
    p_away: float
    model_family: str
    model_reference: str
    confidence: dict
    agreement: dict | None
    created_at: datetime
    feature_snapshot: dict = field(default_factory=dict)

    def to_record(self) -> dict:
        note = extrapolation_note(self.tie, self.model_family)
        return {
            **self.tie.describe(),
            "market": "90_minute_hda",
            "p_home": round(float(self.p_home), 4),
            "p_draw": round(float(self.p_draw), 4),
            "p_away": round(float(self.p_away), 4),
            "model_family": self.model_family,
            "model_reference": self.model_reference,
            "data_confidence": self.confidence,
            "model_agreement": self.agreement,
            "extrapolation": note,
            "qualification_probability": None,
            "qualification_note": (
                "not modelled: the 90-minute draw is not elimination, and "
                "extra time, penalties and replays have no examples in the "
                "league archive"),
            "created_at": self.created_at.isoformat(),
            "features": self.feature_snapshot,
        }


def agreement_across_families(probabilities: dict[str, tuple[float, float, float]]) -> dict:
    """How far apart independent families are on one tie.

    Reported as the SPREAD of each outcome's probability across families,
    never folded into the probability itself. Two families agreeing on 55% is
    a different statement from one family saying 55%, and a reader can only
    use the difference if both are on the page.
    """
    if len(probabilities) < 2:
        return {"families": list(probabilities), "measurable": False,
                "note": "agreement needs at least two families"}
    spreads = {}
    for index, outcome in enumerate(OUTCOMES):
        values = [p[index] for p in probabilities.values()]
        spreads[outcome] = round(max(values) - min(values), 4)
    widest = max(spreads.values())
    return {
        "families": sorted(probabilities),
        "measurable": True,
        "spread": spreads,
        "max_spread": widest,
        "verdict": ("families agree closely" if widest < 0.05 else
                    "families differ materially" if widest < 0.15 else
                    "families disagree; treat the point estimate as unsettled"),
    }


# ---------------------------------------------------------------------------
# Feeding the congestion features
# ---------------------------------------------------------------------------

def schedule_records(ties, competition: str | None = None) -> list[dict]:
    """Cup ties as `schedule_context.context_from_records` input.

    Two rows per tie, one per club, because congestion is a property of a CLUB
    rather than of a fixture. This is the whole reason the cup calendar is
    worth collecting even before a single cup forecast is made: the congestion
    family measured as noise in every league, and it was counting Saturdays.
    """
    out: list[dict] = []
    for tie in ties:
        key = competition or tie.competition
        cup = CUPS.get(key)
        schedule_key = cup.schedule_key if cup else key
        for club in (tie.home_canonical, tie.away_canonical):
            out.append({"team": club,
                        "match_date": tie.kickoff_at.date(),
                        "competition": schedule_key})
    return out


def observation_rows(ties, known_at: datetime | None = None) -> list[dict]:
    """Cup ties in `ai.observations` shape — the honest home that exists today.

    `subject_type='team'` and `fact_type='schedule_match'` are
    `schedule_context`'s declared vocabulary, and `known_at` is what stops a
    backtest learning on Monday about a replay scheduled on Wednesday.

    This function BUILDS the rows and deliberately does not write them.
    Writing is a hosted mutation with an owner and an approval, and this module
    is research.
    """
    known_at = known_at or datetime.now(timezone.utc)
    rows: list[dict] = []
    for tie in ties:
        cup = CUPS.get(tie.competition)
        for club, opponent, at_home in (
                (tie.home_canonical, tie.away_canonical, True),
                (tie.away_canonical, tie.home_canonical, False)):
            rows.append({
                "subject_type": "team",
                "subject_key": club,
                "fact_type": "schedule_match",
                "applies_from": tie.kickoff_at,
                "known_at": known_at,
                "source": tie.source,
                "is_estimate": False,
                "value": {
                    "competition": cup.schedule_key if cup else tie.competition,
                    "round": tie.round_name,
                    "opponent": opponent,
                    "at_home": at_home,
                    "venue": tie.venue,
                },
            })
    return rows


def cup_for_division(division: str) -> list[Cup]:
    """Which declared cups a club in this division can appear in."""
    return [cup for cup in CUPS.values() if cup.includes(division)]
