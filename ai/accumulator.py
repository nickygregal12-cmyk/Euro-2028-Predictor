"""Combination betting, computed rather than described.

A language model asked for "the best value treble" will produce three
plausible fixtures and multiply three numbers, and the answer will be wrong in
a way that is very hard to see: the multiplication is only valid if the legs
are independent, and the most natural-looking treble a model picks — home win,
over 2.5 and both teams to score in the same match — is one bet written three
times. Its true probability is nowhere near the product, and its true variance
is enormous.

So combination search happens here, deterministically, outside any model:

  * exhaustive over a bounded, explicitly reported candidate pool;
  * one leg per fixture, always, unless a joint probability arrives from the
    scoreline distribution — which is the only object in this package that
    knows how two markets on one match relate;
  * one leg per club, because the same side appearing twice is the same form
    estimate, the same rating and the same injury list priced twice;
  * every returned accumulator carries the evidence for each leg, so a prose
    layer explains a computed object rather than inventing one.

The independence approximation across DIFFERENT fixtures is stated rather than
hidden. Different matches are not perfectly independent either — a wet
Saturday, a referee directive, a model that is systematically wrong about
promoted clubs will move several at once — so the joint probability returned
here is an upper-ish estimate and is labelled `independent_product`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

import numpy as np

# Exhaustive search over everything priced in nine leagues would be millions of
# combinations. The pool is capped, the cap is a parameter, and the number
# dropped is REPORTED — a silent truncation reads as "I considered everything"
# when it did not.
DEFAULT_POOL_CAP = 40
DEFAULT_RESULTS = 5

OBJECTIVES = ("return", "value", "safety", "confidence")


@dataclass(frozen=True)
class Leg:
    fixture_id: str
    league: str
    home: str
    away: str
    kickoff_at: object
    selection: str                 # 'H' | 'D' | 'A'
    odds: float
    probability: float             # calibrated
    # No default. A leg has to say where its price is, because the whole
    # correctness of a combined return depends on the answer, and a default of
    # "MAX" is how a cross-book ceiling became the headline number.
    bookmaker: str
    data_confidence: float | None = None
    data_confidence_state: str | None = None
    agreement: float | None = None
    uncertainty_width: float | None = None
    captured_at: object | None = None
    price_age_seconds: float | None = None

    @property
    def fair_odds(self) -> float:
        return 1.0 / self.probability if self.probability > 0 else float("inf")

    @property
    def edge(self) -> float:
        return self.probability * self.odds - 1.0

    def teams(self) -> set[str]:
        return {self.home, self.away}

    def to_dict(self) -> dict:
        return {
            "fixture_id": self.fixture_id,
            "league": self.league,
            "match": f"{self.home} v {self.away}",
            "kickoff_at": self.kickoff_at,
            "selection": self.selection,
            "bookmaker": self.bookmaker,
            "odds": round(self.odds, 3),
            "calibrated_probability": round(self.probability, 5),
            "fair_odds": round(self.fair_odds, 3),
            "model_edge": round(self.edge, 5),
            "data_confidence": self.data_confidence,
            "data_confidence_state": self.data_confidence_state,
            "model_agreement": self.agreement,
            "uncertainty_width": self.uncertainty_width,
            "odds_captured_at": self.captured_at,
            "price_age_seconds": self.price_age_seconds,
        }


@dataclass
class Accumulator:
    legs: tuple[Leg, ...]
    combined_odds: float
    joint_probability: float
    fair_combined_odds: float
    expected_value: float
    min_data_confidence: float | None
    min_agreement: float | None
    max_uncertainty_width: float | None
    correlation_note: str
    # Where this bet could actually be placed, and whether it could be placed
    # at all. `None` means the legs are priced at more than one venue, which
    # is a research view and not a bet.
    bookmaker: str | None = None
    actionable: bool = False
    actionable_note: str = ""
    exchange_commission: float | None = None
    stake: float = 0.0
    warnings: list[str] = field(default_factory=list)

    @property
    def total_return(self) -> float:
        """What comes back if it wins, INCLUDING the stake."""
        gross = self.stake * self.combined_odds
        if self.exchange_commission:
            # Commission is charged on winnings, not on the stake.
            gross = self.stake + (gross - self.stake) * (1.0 - self.exchange_commission)
        return gross

    @property
    def profit(self) -> float:
        """What comes back MINUS the stake. Never the same number as return."""
        return self.total_return - self.stake

    def to_dict(self) -> dict:
        return {
            "legs": [leg.to_dict() for leg in self.legs],
            "leg_count": len(self.legs),
            "bookmaker": self.bookmaker,
            "actionable": self.actionable,
            "actionable_note": self.actionable_note,
            "exchange_commission": self.exchange_commission,
            "combined_odds": round(self.combined_odds, 3),
            "stake": round(self.stake, 2),
            # Two different numbers with two different names, because calling
            # one of them by the other's name is the single most misleading
            # thing an accumulator page can do.
            "estimated_total_return": round(self.total_return, 2),
            "estimated_profit": round(self.profit, 2),
            "estimated_joint_probability": round(self.joint_probability, 6),
            "fair_combined_odds": round(self.fair_combined_odds, 3),
            "expected_value": round(self.expected_value, 5),
            "min_data_confidence": self.min_data_confidence,
            "min_model_agreement": self.min_agreement,
            "max_uncertainty_width": self.max_uncertainty_width,
            "correlation_treatment": self.correlation_note,
            "warnings": self.warnings,
            "oldest_price_captured_at": min(
                (leg.captured_at for leg in self.legs if leg.captured_at is not None),
                default=None),
        }


@dataclass(frozen=True)
class AccumulatorRequest:
    """Everything a caller can ask for, in one object a tool layer can fill."""

    legs: int = 3
    objective: str = "value"
    min_combined_odds: float | None = None
    max_combined_odds: float | None = None
    min_leg_odds: float | None = None
    max_leg_odds: float | None = None
    min_data_confidence: float | None = None
    min_agreement: float | None = None
    max_uncertainty_width: float | None = None
    min_leg_probability: float | None = None
    exclude_leagues: tuple[str, ...] = ()
    exclude_teams: tuple[str, ...] = ()
    results: int = DEFAULT_RESULTS
    pool_cap: int = DEFAULT_POOL_CAP
    # The stake, used ONLY to turn combined odds into money. It is not a
    # bankroll recommendation and nothing here invents one.
    stake: float = 0.0
    # Legs must all be priced at one venue for the combined return to be a
    # number anybody can take. Setting this false gives the research ceiling,
    # which is then labelled as such and never called actionable.
    require_single_bookmaker: bool = True
    # Restrict the search to one named venue. None means "search each venue
    # separately and return the best from each", never "mix them".
    bookmaker: str | None = None
    # Registry classification, injected so this module needs no database.
    bookmaker_registry: object = None
    # Aggregates are OFF by default. `MAX` is a research ceiling and including
    # it silently would put the most attractive-looking and least placeable
    # combination at the top of the list, which is the exact failure mode this
    # whole section exists to prevent.
    include_reference_ceiling: bool = False


# ---------------------------------------------------------------------------
# Why an accumulator is keyed on ONE bookmaker
#
# `MAX` is the best price on each selection across the sampled books, and those
# best prices routinely sit at different books. Multiplying the best Arsenal
# price at book A by the best Celtic price at book B by the best Leeds price at
# book C produces a combined return that is available at no venue on earth. It
# is a useful ceiling — it says what perfect line shopping across single bets
# would be worth — and it is not an accumulator.
#
# `ai.bookmakers` already says which codes are aggregates. This module asks it
# rather than keeping a list, for the same reason the value gate now does.
# ---------------------------------------------------------------------------

RESEARCH_CEILING_NOTE = (
    "Not placeable. These legs are priced across more than one venue (or at an "
    "aggregate), so the combined return shown is a line-shopping ceiling "
    "rather than a bet. Ask for a single bookmaker to get an actionable one.")

SINGLE_BOOK_NOTE = (
    "Every leg is priced at {book}, so the combined odds are the odds that "
    "bookmaker is offering on this combination of selections.")


def _classify(code: str, registry) -> dict:
    """What this venue is. Falls back to the two aggregates when offline."""
    if registry:
        entry = (registry or {}).get(str(code).upper())
        if entry:
            return entry
    if str(code).upper() in {"AVG", "MAX"}:
        return {"code": str(code).upper(), "kind": "aggregate",
                "is_real_price": False, "exchange_commission": None}
    return {"code": str(code).upper(), "kind": "unknown",
            "is_real_price": False, "exchange_commission": None}


CORRELATION_NOTE = (
    "One leg per fixture and one leg per club. The joint probability is the "
    "product of the leg probabilities, which assumes different fixtures are "
    "independent — they are not perfectly independent (weather, refereeing "
    "directives, and any systematic model error move several at once), so "
    "treat it as an estimate rather than a measurement. Two markets on the "
    "SAME fixture are never combined here: their joint probability is only "
    "available from the scoreline distribution, and multiplying them would "
    "overstate the return of what is largely one bet."
)


def _eligible(leg: Leg, req: AccumulatorRequest) -> str | None:
    if req.min_leg_odds is not None and leg.odds < req.min_leg_odds:
        return "leg odds below the requested minimum"
    if req.max_leg_odds is not None and leg.odds > req.max_leg_odds:
        return "leg odds above the requested maximum"
    if req.min_leg_probability is not None and leg.probability < req.min_leg_probability:
        return "leg probability below the requested minimum"
    if req.min_data_confidence is not None and (
            leg.data_confidence is None or leg.data_confidence < req.min_data_confidence):
        return "leg data confidence below the requested minimum"
    if req.min_agreement is not None and (
            leg.agreement is None or leg.agreement < req.min_agreement):
        return "model agreement below the requested minimum"
    if req.max_uncertainty_width is not None and (
            leg.uncertainty_width is not None
            and leg.uncertainty_width > req.max_uncertainty_width):
        return "probability uncertainty wider than requested"
    if leg.league in req.exclude_leagues:
        return "league excluded by the request"
    if leg.teams() & set(req.exclude_teams):
        return "team excluded by the request"
    return None


def _score(acc: Accumulator, objective: str) -> tuple:
    """Deterministic ordering key. Ties broken by odds, then by leg identity.

    Actionability comes FIRST, ahead of every objective. A reference ceiling
    will usually out-score a real bet — that is what a ceiling is — and a list
    sorted purely on value would put the unplaceable combination at the top of
    the page every single time.

    The four objectives are four different questions and are kept apart:
      return      highest combined odds                 (biggest payout, and
                                                         SILENT on the chance
                                                         of winning)
      safety      highest estimated joint probability   (most likely to land)
      value       highest expected value                (best price for the risk)
      confidence  strongest evidence behind the legs    (NOT most likely to win)

    `return` is the browser's default. It lives here as well as in
    `src/domain/ai/betBuilder.ts` because those two are one authority with two
    implementations, held together by `tests/database-parity/betBuilderParity`
    -- adding it to only one side is precisely what that test exists to catch,
    and it did.
    """
    ids = tuple(sorted(leg.fixture_id for leg in acc.legs))
    placeable = 0 if acc.actionable else 1
    if objective == "safety":
        return (placeable, -acc.joint_probability, -acc.expected_value, ids)
    if objective == "confidence":
        return (placeable, -(acc.min_data_confidence or 0.0), -acc.expected_value, ids)
    if objective == "return":
        return (placeable, -acc.combined_odds, -acc.joint_probability, ids)
    return (placeable, -acc.expected_value, -acc.joint_probability, ids)


def build_accumulators(legs, request: AccumulatorRequest | None = None) -> dict:
    """Every qualifying combination, scored and ranked. No model involved."""
    req = request or AccumulatorRequest()
    if req.objective not in OBJECTIVES:
        raise ValueError(f"unknown objective {req.objective!r}; known: {list(OBJECTIVES)}")
    if req.legs < 1:
        raise ValueError("an accumulator needs at least one leg")

    supplied = list(legs)
    rejected: dict[str, int] = {}
    pool: list[Leg] = []
    for leg in supplied:
        why = _eligible(leg, req)
        if why is None and req.bookmaker is not None and (
                str(leg.bookmaker).upper() != str(req.bookmaker).upper()):
            why = "priced at a different bookmaker than the one requested"
        if why:
            rejected[why] = rejected.get(why, 0) + 1
        else:
            pool.append(leg)

    # Deterministic pool order: best edge first, ties by fixture id so two runs
    # over the same data return the same accumulators in the same order.
    pool.sort(key=lambda leg: (-leg.edge, leg.fixture_id, leg.selection))

    # ------------------------------------------------------------------
    # One venue at a time.
    #
    # A combination is searched WITHIN a bookmaker, never across bookmakers,
    # unless the caller has explicitly asked for the research ceiling. This is
    # the difference between "£10 returns £58.40 at Bet365" and "£10 would
    # return £61.10 if you held an account at four books and each of them
    # happened to be top on a different leg", and only one of those is a bet.
    # ------------------------------------------------------------------
    if req.require_single_bookmaker:
        groups: dict[str, list[Leg]] = {}
        for leg in pool:
            code = str(leg.bookmaker).upper()
            if not req.include_reference_ceiling and not _classify(
                    code, req.bookmaker_registry).get("is_real_price"):
                rejected["priced only at an aggregate, which is not a bet"] = (
                    rejected.get("priced only at an aggregate, which is not a bet", 0) + 1)
                continue
            groups.setdefault(code, []).append(leg)
    else:
        groups = {"__mixed__": pool}

    results: list[Accumulator] = []
    dropped = 0
    considered_total = 0
    for book, book_pool in sorted(groups.items()):
        considered = book_pool[:req.pool_cap]
        dropped += len(book_pool) - len(considered)
        considered_total += len(considered)
        results.extend(_combine(considered, req, book if book != "__mixed__" else None))

    results.sort(key=lambda acc: _score(acc, req.objective))
    top = results[:req.results]

    books_seen = sorted({str(leg.bookmaker).upper() for leg in pool})
    incomplete = _incomplete_books(pool, req)

    return {
        "request": {
            "legs": req.legs, "objective": req.objective,
            "stake": req.stake,
            "bookmaker": req.bookmaker,
            "require_single_bookmaker": req.require_single_bookmaker,
            "min_combined_odds": req.min_combined_odds,
            "max_combined_odds": req.max_combined_odds,
            "min_leg_odds": req.min_leg_odds, "max_leg_odds": req.max_leg_odds,
            "min_data_confidence": req.min_data_confidence,
            "exclude_leagues": list(req.exclude_leagues),
            "exclude_teams": list(req.exclude_teams),
        },
        "candidates_supplied": len(supplied),
        "candidates_eligible": len(pool),
        "candidates_considered": considered_total,
        # Never silent: a caller reading "3 accumulators" must be able to see
        # that 200 candidates were cut to 40 before the search began.
        "candidates_dropped_by_pool_cap": dropped,
        "rejection_reasons": rejected,
        "bookmakers_with_candidates": books_seen,
        # Named rather than counted: "no one bookmaker prices every leg" is a
        # first-class answer, and the caller needs to know which books were
        # close.
        "bookmakers_without_enough_legs": incomplete,
        "combinations_evaluated": len(results),
        "accumulators": [acc.to_dict() for acc in top],
        "note": ("No accumulator is returned unless every leg passed the "
                 "request's own filters. An empty list means nothing "
                 "qualified, which is an answer."),
    }


def _incomplete_books(pool, req: AccumulatorRequest) -> list[dict]:
    """Which venues had candidates but not enough of them for this leg count."""
    counts: dict[str, int] = {}
    for leg in pool:
        code = str(leg.bookmaker).upper()
        counts[code] = counts.get(code, 0) + 1
    return [{"bookmaker": code, "eligible_legs": n, "legs_requested": req.legs}
            for code, n in sorted(counts.items()) if n < req.legs]


def _combine(considered, req: AccumulatorRequest, book: str | None) -> list[Accumulator]:
    """Every valid combination within ONE venue's candidate pool."""
    classification = _classify(book, req.bookmaker_registry) if book else None
    actionable = bool(classification and classification.get("is_real_price"))
    commission = (classification or {}).get("exchange_commission")
    if classification and classification.get("kind") == "exchange" and commission is None:
        # A real price whose net return cannot be stated. Actionable as a bet,
        # but the money figure beside it is gross and must say so.
        note = (SINGLE_BOOK_NOTE.format(book=book)
                + " It is an exchange and ai.bookmakers states no commission, "
                  "so the return shown is GROSS of commission and an exchange "
                  "may not offer a traditional accumulator at all.")
    elif actionable:
        note = SINGLE_BOOK_NOTE.format(book=book)
    else:
        note = RESEARCH_CEILING_NOTE

    results: list[Accumulator] = []
    for combo in combinations(considered, req.legs):
        fixtures = {leg.fixture_id for leg in combo}
        if len(fixtures) != len(combo):
            continue                       # two legs on one match: never
        clubs: set[str] = set()
        duplicated = False
        for leg in combo:
            if clubs & leg.teams():
                duplicated = True
                break
            clubs |= leg.teams()
        if duplicated:
            continue                       # the same club priced twice

        odds = float(np.prod([leg.odds for leg in combo]))
        joint = float(np.prod([leg.probability for leg in combo]))
        if req.min_combined_odds is not None and odds < req.min_combined_odds:
            continue
        if req.max_combined_odds is not None and odds > req.max_combined_odds:
            continue

        warnings: list[str] = []
        leagues = {leg.league for leg in combo}
        if len(leagues) == 1 and len(combo) > 1:
            warnings.append(
                f"every leg is in {leagues.pop()}; a systematic model error in "
                "one league would move all of them together")
        confidences = [leg.data_confidence for leg in combo if leg.data_confidence is not None]
        agreements = [leg.agreement for leg in combo if leg.agreement is not None]
        widths = [leg.uncertainty_width for leg in combo if leg.uncertainty_width is not None]

        if not actionable and book is not None:
            warnings.append(
                f"{book} is not a real price (ai.bookmakers.is_real_price is "
                "false); this combination is a reference ceiling, not a bet")
        if book is None:
            warnings.append(
                "legs are priced across more than one venue; the combined "
                "return is a line-shopping ceiling and is available nowhere")

        results.append(Accumulator(
            legs=combo,
            combined_odds=odds,
            joint_probability=joint,
            fair_combined_odds=(1.0 / joint) if joint > 0 else float("inf"),
            expected_value=joint * odds - 1.0,
            min_data_confidence=min(confidences) if confidences else None,
            min_agreement=min(agreements) if agreements else None,
            max_uncertainty_width=max(widths) if widths else None,
            correlation_note=CORRELATION_NOTE,
            bookmaker=book,
            actionable=actionable,
            actionable_note=note,
            exchange_commission=commission,
            stake=float(req.stake or 0.0),
            warnings=warnings,
        ))
    return results


# ---------------------------------------------------------------------------
# Turning a target into a constraint
#
# "Minimum total return" and "minimum profit" are different numbers and the
# page must never label one as the other. £10 staked at combined odds 5.0
# returns £50 and profits £40.
# ---------------------------------------------------------------------------

def required_odds_for_total_return(stake: float, target_total_return: float) -> float:
    if stake <= 0:
        raise ValueError("a stake of zero cannot reach any return")
    return float(target_total_return) / float(stake)


def required_odds_for_profit(stake: float, target_profit: float) -> float:
    if stake <= 0:
        raise ValueError("a stake of zero cannot reach any profit")
    return (float(stake) + float(target_profit)) / float(stake)
