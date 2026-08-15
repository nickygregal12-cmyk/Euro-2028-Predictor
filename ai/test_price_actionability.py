"""Regression tests for the real-venue actionability boundary.

AVG/MAX remain useful market references. They must never become the venue on an
actionable recommendation, including in paper mode.
"""
from __future__ import annotations

import inspect
from datetime import datetime, timedelta, timezone

import pytest

import find_value
import value_engine


REGISTRY = {
    "AVG": {"code": "AVG", "kind": "aggregate", "is_real_price": False,
            "exchange_commission": None},
    "MAX": {"code": "MAX", "kind": "aggregate", "is_real_price": False,
            "exchange_commission": None},
    "B365": {"code": "B365", "kind": "bookmaker", "is_real_price": True,
             "exchange_commission": None},
    "CLOSED": {"code": "CLOSED", "kind": "bookmaker", "is_real_price": False,
               "exchange_commission": None},
}


@pytest.fixture(autouse=True)
def registry():
    value_engine.set_bookmaker_registry(REGISTRY)
    yield
    value_engine.set_bookmaker_registry(None)


def candidate(book: str, paper: bool = True):
    now = datetime.now(timezone.utc)
    return value_engine.Candidate(
        selection="H", calibrated_prob=0.60, odds=2.0,
        bookmaker=book, hours_to_kickoff=24.0,
        captured_at=now - timedelta(minutes=5),
        market_fair_prob=0.58,
        data_confidence={"score": 0.80, "state": "high"},
        is_paper=paper,
    ), now


@pytest.mark.parametrize("book", ["AVG", "MAX"])
def test_aggregate_reference_is_not_actionable_in_paper_mode(book):
    item, now = candidate(book, paper=True)
    result = value_engine.ValueGate().assess(item, now)
    assert result.expected_value > 0
    assert result.decision == "PASS"
    assert "PASS_UNBETTABLE_BOOK" in result.reason_codes


@pytest.mark.parametrize("book", ["AVG", "MAX"])
def test_aggregate_reference_is_not_actionable_in_real_mode(book):
    item, now = candidate(book, paper=False)
    result = value_engine.ValueGate().assess(item, now)
    assert result.expected_value > 0
    assert result.decision == "PASS"
    assert "PASS_UNBETTABLE_BOOK" in result.reason_codes


def test_same_quality_candidate_at_a_real_registry_venue_can_pass():
    item, now = candidate("B365")
    result = value_engine.ValueGate().assess(item, now)
    assert result.decision == "BET"
    assert result.reason_codes == []


def test_unknown_and_registered_non_real_codes_fail_closed():
    for book in ("UNKNOWN", "CLOSED"):
        item, now = candidate(book)
        result = value_engine.ValueGate().assess(item, now)
        assert result.decision == "PASS"
        assert "PASS_UNBETTABLE_BOOK" in result.reason_codes


def test_aggregate_kind_cannot_become_actionable_by_flipping_only_real_price():
    mutated = dict(REGISTRY)
    mutated["MAX"] = {**REGISTRY["MAX"], "is_real_price": True}
    value_engine.set_bookmaker_registry(mutated)
    assert value_engine.is_actionable("MAX") is False


def test_find_value_default_uses_real_venue_search_and_keeps_max_as_reference():
    assert find_value.DEFAULT_BOOK is None
    source = inspect.getsource(find_value.load_candidates)
    assert "bk.is_real_price = true" in source
    assert "bk.kind <> 'aggregate'" in source
    assert "bookmaker='MAX'" in source
    assert "action_book" in source


def test_existing_advice_is_reassessed_but_never_recorded_as_a_second_bet():
    source = inspect.getsource(find_value.load_candidates)
    assert "has_existing_bet" in source
    # The old query-level exclusion made fresh odds unable to update Bet Builder.
    assert "not exists (select 1 from ai.bets" not in source

    assert find_value._should_record_new_bet(True, False) is True
    assert find_value._should_record_new_bet(True, True) is False
    assert find_value._should_record_new_bet(False, False) is False
    assert find_value._should_record_new_bet(False, True) is False


def test_fresh_recommendation_records_whether_an_immutable_bet_already_exists():
    source = inspect.getsource(find_value.main)
    assert 'rec.evidence["existing_bet_recorded"] = has_existing_bet' in source
    assert "bet_decisions" in source
    assert "new_bets" in source