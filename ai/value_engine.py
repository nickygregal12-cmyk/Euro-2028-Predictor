"""When a probability and a price add up to a bet, and — mostly — when they do not.

The rule this replaces was one line: edge over 3%, therefore selection. That
rule cannot express any of the things that actually decide whether an edge is
real. It fires on a stale price nobody will offer. It fires on a promoted club
with four matches of history. It fires when three independent models are spread
from 51% to 82% and the average happens to land above the threshold. And it
never, ever says no for a reason you can read afterwards.

So the gate is a sequence of named refusals, each producing a code, and the
codes are stored. Two properties follow from that and both matter more than
the thresholds:

  * "No selections currently pass the threshold" is a valid, recordable
    output. A system that must produce a bet will always produce one, and the
    bet it produces when it has nothing is the worst bet it makes all week.

  * Every PASS says which gate stopped it. Passing on price, on data and on
    disagreement have completely different fixes — a better feed, more history,
    a better model — and a log that only counts refusals cannot tell them apart.

Nothing here places a bet or changes the paper-betting boundary. It decides,
records the decision, and hands the BET rows to the existing writer.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


import betting

OUTCOMES = ("H", "D", "A")

# The vocabulary. Closed on purpose: a free-text reason cannot be counted, and
# the count is what tells you which gate is doing the work.
DECISIONS = ("BET", "PASS")
REASON_CODES = (
    "PASS_LOW_EDGE",
    "PASS_STALE_PRICE",
    "PASS_LOW_DATA",
    "PASS_HIGH_MODEL_DISAGREEMENT",
    "PASS_WIDE_UNCERTAINTY",
    "PASS_MARKET_DISCREPANCY",
    "PASS_INPUT_PENDING",
    "PASS_LONGSHOT",
    "PASS_ODDS_OUT_OF_RANGE",
    "PASS_UNBETTABLE_BOOK",
    "PASS_NO_MARKET_REFERENCE",
)


# ---------------------------------------------------------------------------
# Odds freshness
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FreshnessPolicy:
    """How old a price may be, and why it depends on the clock.

    `find_value.py` took "the latest captured price" and never asked when that
    was. On a Tuesday, with the next fixture on Saturday, the latest price can
    be four days old — and a four-day-old price is not a price, it is a
    historical record. The edge computed against it is an edge against a number
    nobody is offering, which is the most common way a paper-betting record
    looks profitable and cannot be reproduced with money.

    The limit tightens as kickoff approaches because that is when the market
    moves: a six-hour-old price on Tuesday is ordinary, and a six-hour-old
    price ninety minutes before kickoff has been superseded several times.

    Aggregates are held to a stricter standard again. `AVG` and `MAX` are
    computed across books; neither is a price any bookmaker will accept. They
    remain useful REFERENCE prices — market consensus, dispersion and ceilings
    — but they are never actionable candidates, including in paper mode.
    """

    max_age_far: timedelta = timedelta(hours=12)
    max_age_near: timedelta = timedelta(hours=1)
    max_age_imminent: timedelta = timedelta(minutes=20)
    near_kickoff_hours: float = 8.0
    imminent_kickoff_hours: float = 2.0
    aggregate_tightening: float = 0.5      # references get half the allowance

    def limit_for(self, hours_to_kickoff: float, is_aggregate: bool = False) -> timedelta:
        if hours_to_kickoff <= self.imminent_kickoff_hours:
            limit = self.max_age_imminent
        elif hours_to_kickoff <= self.near_kickoff_hours:
            limit = self.max_age_near
        else:
            limit = self.max_age_far
        if is_aggregate:
            limit = timedelta(seconds=limit.total_seconds() * self.aggregate_tightening)
        return limit


@dataclass(frozen=True)
class FreshnessVerdict:
    fresh: bool
    age_seconds: float | None
    limit_seconds: float
    captured_at: datetime | None
    detail: str


# ---------------------------------------------------------------------------
# What a bookmaker code MEANS. One authority: `ai.bookmakers`.
#
# This was a static set `{"AVG", "MAX", "BFE"}`, and it disagreed with the
# database it was supposed to be shadowing. `ai.bookmakers` says BFE is
# Betfair Exchange, kind `exchange`, `is_real_price = true` — a real, bettable
# price at a real venue. Calling it an aggregate held every exchange price to
# the aggregate freshness standard and refused it on a real-money bet for a
# reason that was not true, while the two things that ARE aggregates were
# correctly listed beside it, which is what made the error hard to see.
#
# The classification is LOADED from the registry, with the two aggregates as
# the fallback for an offline caller. Actionability is fail-closed: a code must
# exist, must say `is_real_price = true`, and must not be `kind = aggregate`.
# Paper mode changes whether money is at risk; it does not manufacture a venue.
# ---------------------------------------------------------------------------

FALLBACK_AGGREGATES = frozenset({"AVG", "MAX"})

_REGISTRY_CACHE: dict[str, dict] | None = None


def bookmaker_registry(reload: bool = False) -> dict[str, dict]:
    """`ai.bookmakers`, keyed by code. Falls back to the two known aggregates.

    A lab process without a database — a unit test, an offline analysis — still
    has to be able to reason about AVG and MAX, so the fallback covers exactly
    those two and classifies nothing else. It never invents an entry for a code
    the registry does not hold: an unknown book is unknown, not bettable.
    """
    global _REGISTRY_CACHE
    if _REGISTRY_CACHE is not None and not reload:
        return _REGISTRY_CACHE
    rows: dict[str, dict] = {}
    try:                                     # pragma: no cover - needs a database
        from db import query_df
        frame = query_df(
            "select code, name, kind, is_real_price, exchange_commission "
            "from ai.bookmakers")
        if not frame.empty:
            rows = {str(r["code"]): {
                "code": str(r["code"]), "name": r["name"], "kind": r["kind"],
                "is_real_price": bool(r["is_real_price"]),
                "exchange_commission": (None if r["exchange_commission"] is None
                                        else float(r["exchange_commission"]))}
                for r in frame.to_dict("records")}
    except (Exception, SystemExit):
        # SystemExit as well as Exception: `config.database_url` raises
        # SystemExit when DATABASE_URL is unset, which is the ordinary state of
        # a unit-test process and must not take the interpreter down. A lab
        # process with no database still has to be able to classify AVG and MAX.
        rows = {}
    if not rows:
        rows = {code: {"code": code, "name": code, "kind": "aggregate",
                       "is_real_price": False, "exchange_commission": None}
                for code in FALLBACK_AGGREGATES}
    _REGISTRY_CACHE = rows
    return rows


def set_bookmaker_registry(registry: dict[str, dict] | None) -> None:
    """Inject a registry. Tests and the accumulator adapter use this."""
    global _REGISTRY_CACHE
    _REGISTRY_CACHE = registry


def is_aggregate(code: str) -> bool:
    """True only for a derived/non-real reference price, never for an exchange."""
    entry = bookmaker_registry().get(str(code).upper())
    if entry is None:
        return str(code).upper() in FALLBACK_AGGREGATES
    return entry["kind"] == "aggregate" or not entry["is_real_price"]


def is_actionable(code: str) -> bool:
    """True only when the registry says this is a real, non-aggregate venue."""
    entry = bookmaker_registry().get(str(code).upper())
    return bool(entry and entry["is_real_price"] and entry["kind"] != "aggregate")


def exchange_commission(code: str) -> float | None:
    """Commission on winnings, or None when the registry does not state one.

    None is not zero. An exchange whose commission is unknown cannot be used to
    show an exact expected return, and the accumulator says so rather than
    quietly assuming a rate.
    """
    entry = bookmaker_registry().get(str(code).upper())
    if entry is None or entry["kind"] != "exchange":
        return 0.0 if entry and entry["kind"] == "bookmaker" else None
    return entry["exchange_commission"]


def assess_freshness(captured_at, now: datetime, hours_to_kickoff: float,
                     bookmaker: str,
                     policy: FreshnessPolicy | None = None) -> FreshnessVerdict:
    policy = policy or FreshnessPolicy()
    aggregate = is_aggregate(bookmaker)
    limit = policy.limit_for(hours_to_kickoff, aggregate)

    if captured_at is None:
        return FreshnessVerdict(
            False, None, limit.total_seconds(), None,
            "the price carries no capture time, so its age cannot be established")

    captured = captured_at
    if getattr(captured, "tzinfo", None) is None:
        captured = captured.replace(tzinfo=timezone.utc)
    age = (now - captured).total_seconds()
    if age < 0:
        return FreshnessVerdict(
            False, age, limit.total_seconds(), captured,
            "the price is stamped in the future; the capture clock is wrong")
    fresh = age <= limit.total_seconds()
    return FreshnessVerdict(
        fresh, age, limit.total_seconds(), captured,
        f"captured {age / 60:.0f} min ago; limit at {hours_to_kickoff:.1f}h to "
        f"kickoff is {limit.total_seconds() / 60:.0f} min"
        f"{' (aggregate)' if aggregate else ''}")


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ValueThresholds:
    """Every number the gate uses, in one readable place.

    Stated as a dataclass rather than scattered through the code because these
    are opinions, not facts, and an opinion that cannot be found cannot be
    revised. Each is defended in the gate that reads it.
    """

    min_edge: float = 0.03
    min_prob: float = 0.10
    min_odds: float = 1.30
    max_odds: float = 8.0
    # Data confidence below this is not evidence, whatever the edge says.
    min_data_confidence: float = 0.55
    # Independent models this far apart are not producing a consensus.
    min_agreement: float = 0.55
    # A 95% interval this wide makes the point estimate uninformative at the
    # precision an edge calculation needs.
    max_uncertainty_width: float = 0.20
    # Disagreeing with a liquid market by more than this is, empirically and
    # overwhelmingly, the model being wrong rather than the market.
    max_market_discrepancy: float = 0.15
    kelly_fraction: float = 0.25
    max_stake_fraction: float = 0.02


@dataclass
class Candidate:
    """One (fixture, selection) with everything the gate needs to judge it."""

    selection: str
    calibrated_prob: float
    odds: float
    bookmaker: str
    hours_to_kickoff: float
    captured_at: datetime | None = None
    market_fair_prob: float | None = None
    data_confidence: dict | None = None
    agreement: dict | None = None
    uncertainty: dict | None = None
    missing_inputs: list[str] = field(default_factory=list)
    raw_prob: float | None = None
    is_paper: bool = True


@dataclass
class Recommendation:
    decision: str
    reason_codes: list[str]
    candidate: Candidate
    expected_value: float | None
    fair_odds: float | None
    stake_fraction: float
    evidence: dict

    @property
    def is_bet(self) -> bool:
        return self.decision == "BET"


class ValueGate:
    """Assess a candidate and say yes or, far more often, exactly why not."""

    def __init__(self, thresholds: ValueThresholds | None = None,
                 freshness: FreshnessPolicy | None = None) -> None:
        self.t = thresholds or ValueThresholds()
        self.freshness = freshness or FreshnessPolicy()

    def assess(self, candidate: Candidate, now: datetime | None = None) -> Recommendation:
        now = now or datetime.now(timezone.utc)
        t = self.t
        reasons: list[str] = []
        evidence: dict = {}

        p = float(candidate.calibrated_prob)
        odds = float(candidate.odds)
        ev = float(betting.expected_value(p, odds))
        fair = (1.0 / p) if p > 0 else None
        evidence["expected_value"] = round(ev, 5)
        evidence["fair_odds"] = round(fair, 3) if fair else None

        # 1. Inputs the model wanted and did not get. First, because every
        #    number below is computed from inputs and a missing one makes them
        #    all less meaningful rather than slightly wrong.
        if candidate.missing_inputs:
            reasons.append("PASS_INPUT_PENDING")
            evidence["missing_inputs"] = list(candidate.missing_inputs)

        # 2. The price itself. Age before edge: an edge against a price nobody
        #    is offering is arithmetic, not value.
        fresh = assess_freshness(candidate.captured_at, now,
                                 candidate.hours_to_kickoff, candidate.bookmaker,
                                 self.freshness)
        evidence["price_age_seconds"] = (round(fresh.age_seconds)
                                         if fresh.age_seconds is not None else None)
        evidence["price_age_limit_seconds"] = round(fresh.limit_seconds)
        evidence["price_captured_at"] = fresh.captured_at
        evidence["freshness_detail"] = fresh.detail
        if not fresh.fresh:
            reasons.append("PASS_STALE_PRICE")

        registry_entry = bookmaker_registry().get(str(candidate.bookmaker).upper())
        evidence["bookmaker_kind"] = (registry_entry or {}).get("kind")
        evidence["bookmaker_actionable"] = is_actionable(candidate.bookmaker)
        if not evidence["bookmaker_actionable"]:
            reasons.append("PASS_UNBETTABLE_BOOK")
            evidence["bookmaker_note"] = (
                f"{candidate.bookmaker} is not a price any venue will accept "
                "(ai.bookmakers.is_real_price is false, it is an aggregate, "
                "or the code is unknown)")

        commission = exchange_commission(candidate.bookmaker)
        evidence["exchange_commission"] = commission
        if (registry_entry is not None and registry_entry.get("kind") == "exchange"
                and commission is None):
            # An exchange whose commission the registry does not state cannot
            # be used to show an exact expected return. Reported, not refused:
            # the price is real, and the number beside it is gross.
            evidence["bookmaker_note"] = (
                f"{candidate.bookmaker} is an exchange and ai.bookmakers "
                "states no commission; the return shown is GROSS of it")

        if not (t.min_odds <= odds <= t.max_odds):
            reasons.append("PASS_ODDS_OUT_OF_RANGE")
        if p < t.min_prob:
            # A 4% edge on a 6% shot is almost always the model being wrong
            # about a longshot rather than the market being wrong about one.
            reasons.append("PASS_LONGSHOT")

        # 3. The edge.
        if ev < t.min_edge:
            reasons.append("PASS_LOW_EDGE")

        # 4. Data confidence — a statement about evidence, never about the
        #    outcome. A 70% favourite with limited data confidence is a 70%
        #    favourite this lab cannot defend.
        conf = candidate.data_confidence or {}
        conf_score = conf.get("score")
        evidence["data_confidence"] = conf_score
        evidence["data_confidence_state"] = conf.get("state")
        if conf_score is None or float(conf_score) < t.min_data_confidence:
            reasons.append("PASS_LOW_DATA")

        # 5. Model agreement. Not measurable is not the same as bad: a single
        #    promoted model has nothing to disagree with, and refusing every
        #    bet for that reason would make a non-ensemble lab unable to act.
        agree = candidate.agreement or {}
        if agree.get("measurable"):
            evidence["agreement_score"] = agree.get("score")
            evidence["agreement_state"] = agree.get("state")
            if float(agree.get("score", 0.0)) < t.min_agreement:
                reasons.append("PASS_HIGH_MODEL_DISAGREEMENT")

        # 6. Probability uncertainty. An interval wider than the edge it is
        #    supposed to justify cannot justify it.
        unc = candidate.uncertainty or {}
        width = None
        if unc.get("interval"):
            lo, hi = unc["interval"].get(candidate.selection, [None, None])
            if lo is not None and hi is not None:
                width = float(hi) - float(lo)
        elif unc.get("max_width") is not None:
            width = float(unc["max_width"])
        evidence["uncertainty_width"] = None if width is None else round(width, 4)
        if width is not None and width > t.max_uncertainty_width:
            reasons.append("PASS_WIDE_UNCERTAINTY")

        # 7. Distance from the market. The market is not an oracle, and beating
        #    it is the entire point — but a fifteen-point disagreement on a
        #    liquid 1X2 market is the shape of a broken feature, a wrong club
        #    mapping or a stale rating far more often than it is an edge.
        if candidate.market_fair_prob is None:
            reasons.append("PASS_NO_MARKET_REFERENCE")
        else:
            gap = p - float(candidate.market_fair_prob)
            evidence["market_fair_prob"] = round(float(candidate.market_fair_prob), 5)
            evidence["model_minus_market"] = round(gap, 5)
            if abs(gap) > t.max_market_discrepancy:
                reasons.append("PASS_MARKET_DISCREPANCY")

        stake = 0.0
        if not reasons:
            stake = float(betting.fractional_kelly(
                p, odds, t.kelly_fraction, t.max_stake_fraction))

        return Recommendation(
            decision="BET" if not reasons else "PASS",
            reason_codes=reasons,
            candidate=candidate,
            expected_value=ev,
            fair_odds=fair,
            stake_fraction=stake,
            evidence=evidence,
        )

    def assess_all(self, candidates, now: datetime | None = None) -> list[Recommendation]:
        now = now or datetime.now(timezone.utc)
        return [self.assess(c, now) for c in candidates]


def summarise_reasons(recommendations) -> dict[str, int]:
    """Which gate is doing the work. Read this before changing a threshold."""
    counts: dict[str, int] = {}
    for rec in recommendations:
        if rec.is_bet:
            counts["BET"] = counts.get("BET", 0) + 1
        for code in rec.reason_codes:
            counts[code] = counts.get(code, 0) + 1
    return counts
