"""What is missing, how much it matters, and what would actually help.

Four questions this answers, deterministically:

    What data is missing for this match?
    How complete is this league's data?
    Which gap is the biggest limitation right now?
    What would most plausibly improve this prediction?

And one it refuses to answer by guessing: whether acquiring some new data
source would help. That question has a real answer only where evidence exists
— a measured coverage gap, an ablation result, a sensitivity measurement — and
where none exists the honest output is "I do not have enough evidence to claim
that acquiring this data would improve the model". A language model asked the
same question will always produce a confident shopping list, which is precisely
why the ranking is computed here instead.

The ranking is built from three things this repository already holds:

  * COVERAGE, counted from ai.raw_matches. Not estimated: counted.
  * ABLATION EVIDENCE, from `ai.feature_experiments`, which records rejected
    and inconclusive experiments as well as kept ones. A family measured as
    noise in this league is evidence AGAINST spending money on more of it.
  * PROVIDER CAPABILITY, from what the odds/provider audit has actually
    demonstrated. An endpoint nobody has proven this subscription serves is
    not a plan, and a runtime dependency on one is a future outage.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from config import LEAGUES

# The inputs a prediction wants, and what a missing one costs. Ordered by how
# much of the model's actual behaviour depends on them.
REQUIRED_INPUTS = ("result_history", "shots_on_target", "total_shots", "corners")
OPTIONAL_INPUTS = ("half_time", "cards", "referee", "market_price")


@dataclass(frozen=True)
class Gap:
    key: str
    severity: float               # 0..1
    detail: str
    evidence: dict
    actionable: bool
    recommendation: str


def match_data_gaps(features: dict, market_evidence: dict | None = None) -> dict:
    """What this specific fixture is missing, from its own feature row."""
    gaps: list[dict] = []

    for side in ("home", "away"):
        known = float(features.get(f"{side}_matches_known", 0) or 0)
        if known < 5:
            gaps.append({
                "key": f"{side}_form_history",
                "detail": f"only {known:.0f} prior matches in the {side} side's "
                          "rolling window; most form features are priors",
                "severity": round(min(1.0, (5 - known) / 5), 3),
            })
        for stat, label in (("sot", "shots on target"), ("shots", "total shots"),
                            ("corners", "corners")):
            coverage = features.get(f"{side}_{stat}_known")
            if coverage is None:
                continue
            coverage = float(coverage)
            if coverage < 0.75:
                gaps.append({
                    "key": f"{side}_{stat}_coverage",
                    "detail": f"{coverage:.0%} of the {side} side's window "
                              f"carries {label}",
                    "severity": round(1.0 - coverage, 3),
                })
        if float(features.get(f"{side}_is_newcomer", 0) or 0) >= 1:
            gaps.append({
                "key": f"{side}_division_history",
                "detail": f"the {side} side has under ten matches at this level",
                "severity": 0.5,
            })

    if market_evidence is not None and not market_evidence.get("book_count"):
        gaps.append({
            "key": "market_price",
            "detail": "no current price, so there is nothing to compare the "
                      "model with and no value question to answer",
            "severity": 0.6,
        })

    gaps.sort(key=lambda g: -g["severity"])
    return {
        "gaps": gaps,
        "biggest_limitation": gaps[0]["key"] if gaps else None,
        "complete": not gaps,
        "note": ("A gap is a measured absence in this fixture's own inputs, "
                 "not a guess about what might help."),
    }


def league_coverage(history: pd.DataFrame, league_key: str) -> dict:
    """How complete this league's archive actually is. Counted, not estimated."""
    league = LEAGUES[league_key]
    top = history[history["division"] == league.top_division]
    n = len(top)
    if n == 0:
        return {"league": league_key, "matches": 0,
                "verdict": "INSUFFICIENT_DATA: no matches imported for this division"}

    def share(column: str) -> float | None:
        if column not in top.columns:
            return None
        return float(top[column].notna().mean())

    coverage = {
        "result_history": 1.0,
        "shots_on_target": share("home_shots_ot"),
        "total_shots": share("home_shots"),
        "corners": share("home_corners"),
        "half_time": share("ht_home_goals"),
        "cards": share("home_reds"),
        "referee": share("referee"),
        "market_price": share("odds_avg_h"),
        "closing_price": share("close_avg_h"),
    }
    seasons = sorted(top["season"].unique().tolist())
    return {
        "league": league_key,
        "division": league.top_division,
        "matches": int(n),
        "seasons": seasons,
        "season_count": len(seasons),
        "coverage": {k: (None if v is None else round(v, 4))
                     for k, v in coverage.items()},
        "declared_shot_stats": league.has_shot_stats,
        "liquidity": league.liquidity,
    }


def improvement_opportunities(coverage: dict,
                              ablation_evidence: list[dict] | None = None,
                              provider_capabilities: dict | None = None) -> dict:
    """Rank what would plausibly help, and say when nothing is provable.

    An opportunity needs BOTH a measured gap and a reason to think closing it
    changes a forecast. A league with 100% shot coverage has no shot gap, so
    more shot data cannot help it however attractive that sounds; a league
    where the `corners` family was measured as noise has evidence against
    spending on territory data even where coverage is thin.
    """
    ablation_evidence = ablation_evidence or []
    provider_capabilities = provider_capabilities or {}
    cov = coverage.get("coverage") or {}
    matches = coverage.get("matches", 0)

    # Families measured as noise or harmful in THIS league. Recorded
    # experiments, including the failed ones, are the point of that table.
    verdicts = {e.get("hypothesis", ""): e.get("verdict") for e in ablation_evidence}
    rejected_terms = [h.lower() for h, v in verdicts.items()
                      if v in ("rejected", "inconclusive")]

    gaps: list[Gap] = []
    for key, label, family in (("shots_on_target", "shots on target", "shots_volume"),
                               ("total_shots", "total shots", "shots_volume"),
                               ("corners", "corners", "corners"),
                               ("market_price", "pre-match prices", None)):
        value = cov.get(key)
        if value is None:
            continue
        if value >= 0.98:
            continue
        measured_useless = any(family and family in term for term in rejected_terms)
        gaps.append(Gap(
            key=key,
            severity=round(1.0 - float(value), 3),
            detail=f"{value:.0%} of this division's matches carry {label}",
            evidence={"coverage": value, "matches": matches},
            actionable=not measured_useless,
            recommendation=(
                f"backfilling {label} would change {1 - value:.0%} of rows"
                if not measured_useless else
                f"coverage is incomplete, but the feature family built on "
                f"{label} was measured as noise in this league — more of it is "
                f"not evidenced to help"),
        ))

    if matches and matches < 1500:
        gaps.append(Gap(
            key="sample_size",
            severity=round(min(1.0, (1500 - matches) / 1500), 3),
            detail=f"{matches} top-flight matches is a thin sample for "
                   "distinguishing small effects",
            evidence={"matches": matches, "seasons": coverage.get("season_count")},
            actionable=True,
            recommendation="import earlier seasons for this division"))

    # Current-team information: injuries, lineups, managers. The observation
    # store exists for it and this is where its absence becomes visible.
    observations = provider_capabilities.get("observation_counts") or {}
    if not observations:
        gaps.append(Gap(
            key="current_team_information",
            severity=0.8,
            detail="no injury, lineup or manager observations are recorded, so "
                   "every forecast is made from results and prices alone",
            evidence={"observation_counts": observations},
            actionable=bool(provider_capabilities.get("proven_endpoints")),
            recommendation=(
                "a proven provider endpoint exists; recording team news through "
                "ai.observations would let it be measured"
                if provider_capabilities.get("proven_endpoints") else
                "I do not have enough evidence to claim that acquiring this "
                "data would improve the model: no endpoint in this "
                "subscription has been demonstrated to serve it, and nothing "
                "has been measured with it")))

    gaps.sort(key=lambda g: (-g.severity, g.key))
    actionable = [g for g in gaps if g.actionable]
    return {
        "league": coverage.get("league"),
        "opportunities": [
            {"key": g.key, "severity": g.severity, "detail": g.detail,
             "evidence": g.evidence, "actionable": g.actionable,
             "recommendation": g.recommendation}
            for g in gaps
        ],
        "biggest_limitation": (actionable[0].key if actionable else
                               (gaps[0].key if gaps else None)),
        "verdict": (
            "no measured gap: this division's archive is materially complete, "
            "and additional historical results are unlikely to help"
            if not gaps else
            f"largest measured gap is {(actionable or gaps)[0].key}"),
        "note": ("Ranked from counted coverage and recorded experiments. Where "
                 "neither exists, the answer is that there is not enough "
                 "evidence to make the claim — not a plausible suggestion."),
    }
