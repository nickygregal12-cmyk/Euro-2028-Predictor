"""Tests for the defects the 13 August 2026 Production audit found.

Every test here corresponds to something that was measurably wrong in a hosted
environment, not to a hypothetical. The audit's own numbers, for orientation:
fifty-one live predictions, thirty-seven with at least one zero-history club,
sixteen with two, eleven above 90% headline probability, six above 99%, and
forty-nine paper selections of which thirty-five depended on one of the
suspect rows.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

import accumulator as accumulator_mod
import aliases
import confidence
import ensemble
import experiments
import identity
import value_engine


# ---------------------------------------------------------------------------
# 1. The alias authority — the specific spellings that broke Production
# ---------------------------------------------------------------------------

# Left column is what The Odds API sends; right is the canonical name the
# retained history actually uses. Every one of these appeared in Production's
# `ai.odds_api_events` unmapped on 13 August 2026.
PROVIDER_SPELLINGS = [
    ("Leicester City", "Leicester"),
    ("Norwich City", "Norwich"),
    ("West Bromwich Albion", "West Brom"),
    ("Blackburn Rovers", "Blackburn"),
    ("Sheffield Wednesday", "Sheffield Weds"),
    ("Queens Park Rangers", "QPR"),
    ("Swansea City", "Swansea"),
    ("Stoke City", "Stoke"),
    ("Cardiff City", "Cardiff"),
    ("Birmingham City", "Birmingham"),
    ("Derby County", "Derby"),
    ("Preston North End", "Preston"),
    ("Bolton Wanderers", "Bolton"),
    ("Charlton Athletic", "Charlton"),
    ("Peterborough United", "Peterboro"),
]

# Names that must pass through untouched. A mapping that "fixes" these has
# broken something: they already agree.
UNCHANGED_SPELLINGS = [
    "Arsenal", "Liverpool", "Everton", "Fulham", "Chelsea", "Sunderland",
    "Notts County", "Newport County", "Bristol City", "Milton Keynes Dons",
    "Celtic", "Rangers", "Aberdeen", "Motherwell", "Kilmarnock", "Hibernian",
]


@pytest.mark.parametrize("provider,canonical", PROVIDER_SPELLINGS)
def test_a_provider_spelling_resolves_to_the_history_s_own_name(provider, canonical):
    resolved, how = aliases.canonical_from_odds_api(provider)
    assert resolved == canonical, (
        f"{provider!r} resolved to {resolved!r}, not {canonical!r}. This is the "
        "exact class of failure that scored Leicester as a newcomer on 1180.")
    assert how == "alias"


@pytest.mark.parametrize("name", UNCHANGED_SPELLINGS)
def test_an_already_agreeing_name_is_left_alone(name):
    resolved, _ = aliases.canonical_from_odds_api(name)
    assert resolved == name


def test_a_club_type_suffix_is_stripped_as_a_whole_word():
    """Contract 137's defect, guarded so it cannot come back.

    Stripping `(afc|fc)` from a name whose spaces had already been removed
    turned 'Chelsea FC' into 'chelse' and 'Aston Villa FC' into 'astonvill'.
    """
    assert aliases.normalise("Chelsea FC") == "chelsea"
    assert aliases.normalise("Aston Villa FC") == "aston villa"
    assert aliases.normalise("AFC Bournemouth") == "afc bournemouth"


def test_two_similar_clubs_in_different_divisions_are_never_confused():
    assert aliases.canonical_from_odds_api("Bristol City")[0] == "Bristol City"
    assert aliases.canonical_from_odds_api("Bristol Rovers")[0] != "Bristol City"


# ---------------------------------------------------------------------------
# 1b. The SECOND doorway, found on 19 August 2026
#
# The 13 August repair fixed the Odds API path and left the FIXTURES path
# exactly as broken. Football-Data ships results and fixtures as two files with
# two vocabularies: the results file writes `Bradford`, the fixtures file writes
# `Bradford City`. `canonical_for` is a dict lookup that falls through to
# itself, so the long spelling was stored verbatim, matched nothing in
# `ai.raw_matches`, and the club was scored as one that had never played.
#
# Measured on Production on 19 August 2026: fifty-four such names in
# `ai.fixtures` and NONE in `ai.raw_matches`, and of fifty-three scheduled
# fixtures in the next seven days exactly one carried no forecast at all —
# EL1 `Sheffield Wed v Bradford City`, 20 August.
# ---------------------------------------------------------------------------

# Left column is the fixtures file's spelling; right is the name the retained
# history uses. Each was present in Production's `ai.fixtures` on 19 August.
FIXTURE_FILE_SPELLINGS = [
    ("Bradford City", "Bradford"),
    ("Hull City", "Hull"),
    ("Coventry City", "Coventry"),
    ("Ipswich Town", "Ipswich"),
    ("Leeds United", "Leeds"),
    ("Dundee FC", "Dundee"),
    ("Falkirk F.C.", "Falkirk"),
    ("Sheffield Wednesday", "Sheffield Weds"),
    ("Queens Park Rangers", "QPR"),
    ("West Bromwich Albion", "West Brom"),
    ("Peterborough United", "Peterboro"),
    ("Bristol Rovers", "Bristol Rvs"),
]


@pytest.mark.parametrize("fixture_file,canonical", FIXTURE_FILE_SPELLINGS)
def test_a_fixtures_file_spelling_reaches_the_history_s_own_name(
        fixture_file, canonical):
    assert aliases.canonical_for_fixture(fixture_file) == canonical


def test_the_fixture_that_had_no_forecast_would_now_have_one():
    """EL1 Sheffield Wed v Bradford City, 20 August 2026 — the single gap.

    Both clubs must land on the name the history holds. Before the fix the
    away side was stored as `Bradford City`, which `ai.raw_matches` has never
    held, so the fixture was never forecast at all.
    """
    assert aliases.canonical_for_fixture("Sheffield Wed") == "Sheffield Weds"
    assert aliases.canonical_for_fixture("Bradford City") == "Bradford"


def test_the_fixture_path_still_refuses_to_merge_two_different_clubs():
    """The reason there is no fuzzy fallback, restated for the new doorway.

    `normalise` strips only `fc`/`afc`/`football club` — never `City` — so the
    shape index cannot collapse these two into one club.
    """
    assert aliases.canonical_for_fixture("Bristol City") == "Bristol City"
    assert aliases.canonical_for_fixture("Bristol Rovers") == "Bristol Rvs"
    assert (aliases.canonical_for_fixture("Bristol City")
            != aliases.canonical_for_fixture("Bristol Rovers"))


def test_the_fixtures_vocabulary_never_leaks_into_the_shared_authority():
    """The guard against repeating the original defect while fixing its twin.

    `ai.canonical_from_odds_api` is mirrored in SQL, and the SQL side answers
    `unmatched` for `Sheffield Wed`. A first attempt at this fix put that name
    in `HISTORICAL_ALIASES`, which feeds the shape index both sides share — so
    Python would have known a name SQL did not. That is precisely the "two
    alias tables that disagreed" failure this project already had, in better
    handwriting. The fixtures file gets its own map instead.
    """
    for name in aliases.FIXTURE_FILE_TO_CANONICAL:
        assert aliases.canonical_from_odds_api(name) == (None, "unmatched"), (
            f"{name!r} leaked into the authority SQL mirrors; the SQL side "
            "does not know it and the two would silently disagree.")
        assert aliases.canonical_for(name) == name, (
            f"{name!r} leaked into the history path, which must not change.")


def test_history_deliberately_does_not_take_the_fixture_path():
    """`fetch_history` keeps `canonical_for`, and this is why.

    The shape index answers a forward-looking question. `Wimbledon` resolves to
    `AFC Wimbledon`, which is right for a fixture next Saturday and is not
    obviously right for a 1998 result. `ai.raw_matches` held zero long-form
    names on 19 August, so history needed no repair and must not be given one
    as a side effect.
    """
    assert aliases.canonical_for("Wimbledon") == "Wimbledon"
    assert aliases.canonical_for_fixture("Wimbledon") == "AFC Wimbledon"
    assert aliases.canonical_for("Bradford City") == "Bradford City"


def test_a_club_the_history_has_never_held_is_reported():
    """The reporter `source_to_canonical`'s docstring already promised.

    That docstring says the fall-through default is correct and that something
    tells you when it has quietly gone wrong. No such reporter existed, which is
    why the Bradford City gap sat through six days of scheduled runs.
    """
    history = {"Arsenal", "Bradford", "Hull", "Sheffield Weds"}
    fixtures = {"Arsenal", "Bradford", "Hull", "Nowhere Athletic"}
    assert aliases.clubs_without_history(fixtures, history) == ["Nowhere Athletic"]


def test_the_reporter_does_not_cry_wolf_over_the_lower_divisions():
    """The first version of this reporter was wrong and this is the guard.

    It checked the alias tables, not the history. `LIVE_CLUBS` holds thirty-two
    clubs while the pyramid holds around two hundred and fifty names, so
    `Barrow`, `Accrington` and most of the lower divisions were reported for
    passing through correctly — and a reporter that cries wolf on correct rows
    is worse than none, because it trains the reader to ignore it.
    """
    history = {"Barrow", "Accrington", "Bromley", "Sutton"}
    assert aliases.clubs_without_history(set(history), history) == []


def test_the_reporter_ignores_blanks_and_deduplicates():
    assert aliases.clubs_without_history(["", "  ", "Arsenal"], {"Arsenal"}) == []
    assert aliases.clubs_without_history(
        ["Zzz United", "Zzz United"], {"Arsenal"}) == ["Zzz United"]


# ---------------------------------------------------------------------------
# 2. The identity guard — the difference between "new club" and "broken join"
# ---------------------------------------------------------------------------

HISTORY = {"Leicester", "Norwich", "West Brom", "Arsenal", "Liverpool",
           "Notts County", "Blackburn"}


def test_a_known_club_under_a_provider_spelling_is_refused_not_forecast():
    """The Notts County v Leicester City case, exactly."""
    verdict = identity.assess_fixture(
        "Notts County", "Leicester City", HISTORY,
        features={"home_matches_known": 10.0, "away_matches_known": 0.0})
    assert verdict.blocks
    assert verdict.reason_codes == ["HISTORY_ALIAS_MISMATCH"]
    assert verdict.away.resolves_to == "Leicester"
    assert verdict.away.alias_history_available is True


def test_a_genuinely_new_club_is_reported_and_not_refused():
    """A promoted or newly-tracked club is a normal low-confidence forecast."""
    verdict = identity.assess_fixture(
        "Arsenal", "Harrogate", HISTORY,
        features={"home_matches_known": 10.0, "away_matches_known": 0.0})
    assert not verdict.blocks
    assert verdict.away.known_in_history is False


def test_a_name_nothing_recognises_is_refused_as_invalid_identity():
    verdict = identity.assess_fixture("Arsenal", "Qwerty Rovers XI", HISTORY)
    assert verdict.blocks
    assert "INVALID_TEAM_IDENTITY" in verdict.reason_codes


def test_both_clubs_present_in_history_never_blocks():
    verdict = identity.assess_fixture("Arsenal", "Liverpool", HISTORY)
    assert not verdict.blocks
    assert verdict.reason_codes == []


def test_the_partition_removes_the_broken_fixture_entirely():
    """A refused fixture must produce NO row, not a discounted one.

    This is the structural guarantee: the value engine and the accumulator read
    stored predictions, so a fixture that is never written cannot reach them
    however high its probability would have been.
    """
    fixtures = [
        (0, "Arsenal", "Liverpool", {}),
        (1, "Notts County", "Leicester City", {}),
        (2, "Norwich", "West Brom", {}),
    ]
    scoreable, refused = identity.partition(fixtures, HISTORY)
    assert [f[0] for f in scoreable] == [0, 2]
    assert [f[0] for f in refused] == [1]
    assert refused[0][4].reason_codes == ["HISTORY_ALIAS_MISMATCH"]


# ---------------------------------------------------------------------------
# 3. Data confidence uses a real calibration measure
# ---------------------------------------------------------------------------

def _binned_ece(probs, correct, bins: int = 10) -> float:
    """The measure `league_grading_evidence` now computes, in Python."""
    probs = np.asarray(probs, dtype=float)
    correct = np.asarray(correct, dtype=float)
    edges = np.linspace(0.0, 1.0, bins + 1)
    total = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (probs > lo) & (probs <= hi)
        if not mask.any():
            continue
        total += (mask.sum() / len(probs)) * abs(
            probs[mask].mean() - correct[mask].mean())
    return float(total)


def _synthetic(rng, claimed, realised, n=4000):
    """`n` forecasts each claiming `claimed`, correct `realised` of the time."""
    probs = np.full(n, claimed)
    correct = (rng.random(n) < realised).astype(float)
    return probs, correct


def test_a_perfectly_calibrated_league_is_not_penalised():
    rng = np.random.default_rng(11)
    probs, correct = _synthetic(rng, 0.70, 0.70)
    ece = _binned_ece(probs, correct)
    # The OLD formula. Kept in the test so the size of the error is visible:
    # a flawless model scored roughly 0.42 on it.
    old = float(np.abs(probs - correct).mean())
    assert ece < 0.02, f"perfectly calibrated set scored ECE {ece}"
    assert old > 0.35, "the old formula is being reproduced incorrectly"

    good = confidence.data_confidence(
        features={"home_matches_known": 10, "away_matches_known": 10},
        league_evidence={"graded_predictions": 500, "calibration_error": ece})
    bad = confidence.data_confidence(
        features={"home_matches_known": 10, "away_matches_known": 10},
        league_evidence={"graded_predictions": 500, "calibration_error": old})
    assert good["score"] > bad["score"]


def test_data_confidence_ranks_calibrated_over_confident_and_under_confident():
    rng = np.random.default_rng(7)
    calibrated = _binned_ece(*_synthetic(rng, 0.70, 0.70))
    overconfident = _binned_ece(*_synthetic(rng, 0.90, 0.60))
    underconfident = _binned_ece(*_synthetic(rng, 0.50, 0.80))

    def score(ece):
        return confidence.data_confidence(
            features={"home_matches_known": 10, "away_matches_known": 10},
            league_evidence={"graded_predictions": 500,
                             "calibration_error": ece})["score"]

    assert calibrated < overconfident
    assert calibrated < underconfident
    assert score(calibrated) > score(overconfident)
    assert score(calibrated) > score(underconfident)


def test_accuracy_and_calibration_stay_separate_measurements():
    """A model can be accurate and badly calibrated, and vice versa."""
    rng = np.random.default_rng(3)
    probs, correct = _synthetic(rng, 0.95, 0.60)
    assert correct.mean() == pytest.approx(0.60, abs=0.03)   # accuracy
    assert _binned_ece(probs, correct) > 0.30                # calibration


# ---------------------------------------------------------------------------
# 4. PASS_INPUT_PENDING is populated, and is not trigger-happy
# ---------------------------------------------------------------------------

def test_an_ordinary_football_forecast_reports_no_missing_required_input():
    missing = confidence.required_inputs_missing(
        features={"home_matches_known": 10}, market_evidence={},
        uses_market=False)
    assert missing == []


def test_a_market_model_without_a_price_reports_one():
    missing = confidence.required_inputs_missing(
        features={"home_matches_known": 10}, market_evidence={"book_count": 0},
        uses_market=True)
    assert missing == ["market_price_unavailable"]


def test_a_pure_model_is_not_penalised_for_having_no_odds():
    assert confidence.required_inputs_missing(
        features={"a": 1}, market_evidence=None, uses_market=False) == []


def test_the_gate_refuses_when_a_required_input_is_missing():
    gate = value_engine.ValueGate()
    now = datetime.now(timezone.utc)
    candidate = value_engine.Candidate(
        selection="H", calibrated_prob=0.60, odds=2.5, bookmaker="B365",
        hours_to_kickoff=48.0, captured_at=now - timedelta(minutes=5),
        market_fair_prob=0.58,
        data_confidence={"score": 0.80, "state": "high"},
        missing_inputs=["market_price_unavailable"])
    rec = gate.assess(candidate, now)
    assert not rec.is_bet
    assert "PASS_INPUT_PENDING" in rec.reason_codes


# ---------------------------------------------------------------------------
# 5. Bookmaker classification comes from the registry
# ---------------------------------------------------------------------------

REGISTRY = {
    "AVG": {"code": "AVG", "kind": "aggregate", "is_real_price": False,
            "exchange_commission": None},
    "MAX": {"code": "MAX", "kind": "aggregate", "is_real_price": False,
            "exchange_commission": None},
    "BFE": {"code": "BFE", "kind": "exchange", "is_real_price": True,
            "exchange_commission": None},
    "B365": {"code": "B365", "kind": "bookmaker", "is_real_price": True,
             "exchange_commission": None},
}


@pytest.fixture(autouse=True)
def _registry():
    value_engine.set_bookmaker_registry(REGISTRY)
    yield
    value_engine.set_bookmaker_registry(None)


def test_betfair_exchange_is_not_an_aggregate():
    """`ai.bookmakers` says BFE is an exchange with is_real_price true."""
    assert value_engine.is_aggregate("BFE") is False
    assert value_engine.is_actionable("BFE") is True
    assert value_engine.is_aggregate("MAX") is True
    assert value_engine.is_actionable("MAX") is False


def test_an_exchange_is_not_held_to_the_aggregate_freshness_standard():
    now = datetime.now(timezone.utc)
    exchange = value_engine.assess_freshness(
        now - timedelta(hours=8), now, 24.0, "BFE")
    aggregate = value_engine.assess_freshness(
        now - timedelta(hours=8), now, 24.0, "MAX")
    assert exchange.fresh is True
    assert aggregate.fresh is False


def test_an_exchange_with_no_stated_commission_says_the_return_is_gross():
    gate = value_engine.ValueGate()
    now = datetime.now(timezone.utc)
    rec = gate.assess(value_engine.Candidate(
        selection="H", calibrated_prob=0.60, odds=2.5, bookmaker="BFE",
        hours_to_kickoff=48.0, captured_at=now - timedelta(minutes=5),
        market_fair_prob=0.58,
        data_confidence={"score": 0.80, "state": "high"}), now)
    assert rec.evidence["exchange_commission"] is None
    assert "GROSS" in rec.evidence["bookmaker_note"]


def test_a_real_money_bet_at_an_aggregate_is_still_refused():
    gate = value_engine.ValueGate()
    now = datetime.now(timezone.utc)
    rec = gate.assess(value_engine.Candidate(
        selection="H", calibrated_prob=0.60, odds=2.5, bookmaker="MAX",
        hours_to_kickoff=48.0, captured_at=now - timedelta(minutes=5),
        market_fair_prob=0.58, is_paper=False,
        data_confidence={"score": 0.80, "state": "high"}), now)
    assert "PASS_UNBETTABLE_BOOK" in rec.reason_codes


# ---------------------------------------------------------------------------
# 6. The accumulator is one bookmaker, and keeps its data-confidence floor
# ---------------------------------------------------------------------------

def _leg(i, book, odds=2.0, prob=0.55, conf=0.70, league="EPL"):
    return accumulator_mod.Leg(
        fixture_id=f"f{i}", league=league, home=f"H{i}", away=f"A{i}",
        kickoff_at=None, selection="H", odds=odds, probability=prob,
        bookmaker=book, data_confidence=conf)


def test_a_cross_book_maximum_is_never_presented_as_an_actionable_bet():
    legs = [_leg(i, "MAX", odds=2.5) for i in range(4)]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, bookmaker_registry=REGISTRY,
            include_reference_ceiling=True))
    assert built["accumulators"], "the ceiling view should still be computable"
    assert all(not acc["actionable"] for acc in built["accumulators"])
    assert all("not a real price" in " ".join(acc["warnings"])
               for acc in built["accumulators"])


def test_an_aggregate_is_excluded_from_the_search_by_default():
    legs = [_leg(i, "MAX", odds=2.5) for i in range(4)]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, bookmaker_registry=REGISTRY))
    assert built["accumulators"] == []
    assert "priced only at an aggregate, which is not a bet" in built["rejection_reasons"]


def test_an_actionable_accumulator_uses_one_real_bookmaker_for_every_leg():
    legs = ([_leg(i, "B365", odds=2.0) for i in range(3)]
            + [_leg(i + 10, "BFE", odds=2.4) for i in range(3)])
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, bookmaker_registry=REGISTRY))
    assert built["accumulators"]
    for acc in built["accumulators"]:
        books = {leg["bookmaker"] for leg in acc["legs"]}
        assert len(books) == 1
        assert acc["bookmaker"] in books
        assert acc["actionable"] is True


def test_no_one_bookmaker_with_enough_legs_is_reported_rather_than_mixed():
    legs = [_leg(0, "B365"), _leg(1, "BFE"), _leg(2, "B365")]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, bookmaker_registry=REGISTRY))
    assert built["accumulators"] == []
    assert {"bookmaker": "BFE", "eligible_legs": 1, "legs_requested": 3} in (
        built["bookmakers_without_enough_legs"])


def test_total_return_and_profit_are_different_numbers():
    legs = [_leg(i, "B365", odds=2.0) for i in range(3)]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, bookmaker_registry=REGISTRY))
    acc = built["accumulators"][0]
    assert acc["combined_odds"] == pytest.approx(8.0)
    assert acc["estimated_total_return"] == pytest.approx(80.0)
    assert acc["estimated_profit"] == pytest.approx(70.0)


def test_exchange_commission_is_taken_out_of_winnings_not_the_stake():
    registry = dict(REGISTRY)
    registry["BFE"] = {**REGISTRY["BFE"], "exchange_commission": 0.02}
    legs = [_leg(i, "BFE", odds=2.0) for i in range(3)]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, bookmaker_registry=registry))
    acc = built["accumulators"][0]
    assert acc["estimated_total_return"] == pytest.approx(10 + 70 * 0.98)


def test_the_target_arithmetic_distinguishes_return_from_profit():
    assert accumulator_mod.required_odds_for_total_return(10.0, 50.0) == pytest.approx(5.0)
    assert accumulator_mod.required_odds_for_profit(10.0, 50.0) == pytest.approx(6.0)


def test_a_low_data_leg_cannot_enter_through_the_accumulator_request():
    """The `min_data_confidence or 0.0` bypass, guarded.

    `build_accumulator` used to substitute 0.0 whenever the caller named no
    floor, so NOT asking for one disabled it. Here the request carries the
    ValueThresholds default explicitly and the weak leg is rejected.
    """
    default = value_engine.ValueThresholds().min_data_confidence
    legs = ([_leg(i, "B365") for i in range(3)]
            + [_leg(9, "B365", conf=0.20)])
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=3, stake=10.0, min_data_confidence=default,
            bookmaker_registry=REGISTRY))
    assert "leg data confidence below the requested minimum" in built["rejection_reasons"]
    for acc in built["accumulators"]:
        assert all(leg["fixture_id"] != "f9" for leg in acc["legs"])


def test_build_accumulator_defaults_to_the_gate_threshold_not_to_zero():
    """The caller-level guarantee, asserted on the tool signature itself."""
    import inspect

    import tools

    signature = inspect.signature(tools.build_accumulator)
    assert signature.parameters["min_data_confidence"].default is None
    # Executable lines only. The docstring quotes the old expression verbatim
    # so the defect stays readable, and a substring search over the whole
    # source would match the explanation rather than the code.
    body = inspect.getsource(tools.build_accumulator)
    body = body.split('"""')[2]
    assert "(min_data_confidence or 0.0)" not in body
    assert "thresholds.min_data_confidence" in body
    assert signature.parameters["book"].default is None


def test_one_leg_per_fixture_and_one_leg_per_club_still_hold():
    legs = [
        accumulator_mod.Leg(fixture_id="f1", league="EPL", home="Arsenal",
                            away="Leeds", kickoff_at=None, selection="H",
                            odds=2.0, probability=0.6, bookmaker="B365",
                            data_confidence=0.8),
        accumulator_mod.Leg(fixture_id="f1", league="EPL", home="Arsenal",
                            away="Leeds", kickoff_at=None, selection="D",
                            odds=3.5, probability=0.25, bookmaker="B365",
                            data_confidence=0.8),
        accumulator_mod.Leg(fixture_id="f2", league="EPL", home="Leeds",
                            away="Everton", kickoff_at=None, selection="H",
                            odds=2.2, probability=0.5, bookmaker="B365",
                            data_confidence=0.8),
    ]
    built = accumulator_mod.build_accumulators(
        legs, accumulator_mod.AccumulatorRequest(
            legs=2, stake=10.0, bookmaker_registry=REGISTRY))
    assert built["accumulators"] == []


# ---------------------------------------------------------------------------
# 7. Ensemble calibration is cross-fitted at the second level
# ---------------------------------------------------------------------------

def _oof(seasons=8, per_season=200, seed=5):
    rng = np.random.default_rng(seed)
    families = ("poisson", "elo", "gbm")
    n = seasons * per_season
    labels = np.concatenate([np.full(per_season, f"{2000 + s}", dtype=object)
                             for s in range(seasons)])
    actual = rng.choice(["H", "D", "A"], size=n, p=[0.45, 0.26, 0.29])
    probs = {}
    for i, family in enumerate(families):
        base = rng.dirichlet([4 + i, 3, 3], size=n)
        probs[family] = base
    return ensemble.OutOfFold(families=families, probs=probs, actual=actual,
                              fold_labels=labels, row_index=np.arange(n))


def test_cross_fitted_meta_predictions_exclude_the_reserved_folds():
    oof = _oof()
    stacked = ensemble.stacked_out_of_time(oof, "logistic_stack", min_fit_folds=3)
    seasons = sorted(set(oof.fold_labels.tolist()))
    assert set(stacked.fold_labels.tolist()) == set(seasons[3:])
    assert stacked.rows_dropped == 3 * 200
    ensemble.assert_meta_out_of_sample(stacked, oof)


def test_the_leakage_guard_fails_on_a_meta_fitted_on_its_own_rows():
    """The mutation test. A stacker fitted on ALL the OOF material and then
    asked to predict those same rows is the exact thing calibration used to do,
    and it must be refused rather than merely discouraged."""
    oof = _oof()
    leaky = ensemble.StackedOutOfTime(
        probs=ensemble.META_MODELS["logistic_stack"](oof.families)
              .fit(oof).combine(oof.probs),
        actual=oof.actual,
        fold_labels=oof.fold_labels,            # every fold, including reserved
        meta="logistic_stack",
        folds_used=len(set(oof.fold_labels.tolist())) - 3,
        rows_dropped=0,
        detail={})
    with pytest.raises(ensemble.SecondLevelLeakage):
        ensemble.assert_meta_out_of_sample(leaky, oof)


def test_too_few_folds_refuses_rather_than_silently_leaking():
    oof = _oof(seasons=3)
    with pytest.raises(ensemble.SecondLevelLeakage):
        ensemble.stacked_out_of_time(oof, "logistic_stack", min_fit_folds=3)


def test_train_calibrates_an_ensemble_on_cross_fitted_material():
    """Read the caller, because the property lives in how train.py wires it."""
    import inspect

    import train

    source = inspect.getsource(train.main)
    assert "stacked_out_of_time" in source
    assert "assert_meta_out_of_sample" in source
    # The old leaky line must be gone, not merely bypassed.
    assert "final_model.meta.combine(oof.probs)" not in source


# ---------------------------------------------------------------------------
# 8. The experiment ledger records the measurement
# ---------------------------------------------------------------------------

def test_a_half_life_study_records_its_comparison_rather_than_zeros():
    result = {
        "study": "half-life", "league": "EPL",
        "rows": [
            {"half_life_days": 600, "mean_log_loss": 1.02, "mean_delta": 0.004,
             "se_delta": 0.002, "folds": 9, "beats_noise": False, "harmful": True},
            {"half_life_days": 1200, "mean_log_loss": 1.00, "mean_delta": -0.012,
             "se_delta": 0.004, "folds": 9, "beats_noise": True, "harmful": False},
        ],
        "chosen": {"half_life_days": 1200},
        "recommendation": "1200 days",
    }
    entry = experiments.ledger_entry("half-life", result)
    assert entry["folds"] == 9
    assert entry["mean_delta"] == -0.012
    assert entry["se_delta"] == 0.004
    assert entry["beats_noise"] is True
    assert entry["candidate"] == "1200"
    assert entry["chosen"] == "1200"
    assert "incumbent" in entry["baseline"]


def test_an_ensemble_study_records_the_stacker_against_the_best_base():
    result = {
        "study": "ensemble", "league": "EPL",
        "comparison": {
            "poisson": {"folds": 6, "mean_log_loss": 1.01, "se_log_loss": 0.01},
            "elo": {"folds": 6, "mean_log_loss": 1.03, "se_log_loss": 0.01},
            "logistic_stack": {
                "folds": 6, "mean_log_loss": 0.99, "se_log_loss": 0.01,
                "vs_best_base": {"base": "poisson", "mean_delta": -0.02,
                                 "se_delta": 0.005, "beats_noise": True}},
            "equal_blend": {
                "folds": 6, "mean_log_loss": 1.00, "se_log_loss": 0.01,
                "vs_best_base": {"base": "poisson", "mean_delta": -0.01,
                                 "se_delta": 0.006, "beats_noise": False}},
            "_best_base": "poisson",
        },
    }
    entry = experiments.ledger_entry("ensemble", result)
    assert entry["candidate"] == "logistic_stack"
    assert entry["baseline"] == "best single base model (poisson)"
    assert entry["folds"] == 6
    assert entry["mean_delta"] == -0.02
    assert entry["beats_noise"] is True


def test_a_calibration_study_records_its_choice_and_both_ece_values():
    result = {
        "study": "calibration", "league": "EPL",
        "choice": {"chosen": "temperature", "scores": {"a": 1, "b": 2, "c": 3}},
        "before": {"ece": 0.041, "log_loss": 1.02},
        "after": {"ece": 0.019, "log_loss": 1.00},
    }
    entry = experiments.ledger_entry("calibration", result)
    assert entry["candidate"] == "temperature"
    assert entry["mean_delta"] == pytest.approx(-0.02)
    assert entry["ece_before"] == 0.041
    assert entry["ece_after"] == 0.019
    assert entry["beats_noise"] is True


def test_an_elo_transition_study_records_a_comparison():
    result = {"study": "elo-transition", "league": "EL2", "rows": [
        {"transition": "global_mean", "mean_delta": 0.0, "se_delta": 0.0,
         "folds": 8, "beats_noise": False, "harmful": False},
        {"transition": "division_mean", "mean_delta": -0.008, "se_delta": 0.003,
         "folds": 8, "beats_noise": True, "harmful": False}]}
    entry = experiments.ledger_entry("elo-transition", result)
    assert entry["candidate"] == "division_mean"
    assert entry["folds"] == 8
    assert entry["mean_delta"] == -0.008


def test_every_study_name_has_a_ledger_extractor():
    for study in experiments.STUDY_FUNCTIONS:
        entry = experiments.ledger_entry(study, {"rows": [], "comparison": {}})
        assert isinstance(entry, dict), study


def test_a_failed_study_records_the_error_rather_than_a_false_verdict():
    entry = experiments.ledger_entry("half-life", {"error": "too few folds"})
    assert entry["folds"] == 0
    assert entry["mean_delta"] is None
    assert entry["error"] == "too few folds"


# ---------------------------------------------------------------------------
# 9. The freshness policy agrees with the SQL that mirrors it
# ---------------------------------------------------------------------------

FRESHNESS_BOUNDARIES = [
    (1.0, False, 1200), (2.0, False, 1200), (2.001, False, 3600),
    (8.0, False, 3600), (8.001, False, 43200), (48.0, False, 43200),
    (1.0, True, 600), (8.0, True, 1800), (48.0, True, 21600),
]


@pytest.mark.parametrize("hours,aggregate,seconds", FRESHNESS_BOUNDARIES)
def test_the_python_freshness_policy_matches_the_sql_mirror(hours, aggregate, seconds):
    """`ai.price_age_limit_seconds` restates this in SQL for the bounded read.

    Two implementations because two languages need it. This is the test that
    stops them disagreeing; the SQL side is exercised in `test_db_lifecycle`.
    """
    limit = value_engine.FreshnessPolicy().limit_for(hours, aggregate)
    assert limit.total_seconds() == seconds
