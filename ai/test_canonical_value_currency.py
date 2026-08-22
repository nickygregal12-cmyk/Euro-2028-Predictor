"""Regressions for fixture-level forecast currency in the value loop.

A fixture deliberately owns several immutable forecast horizons.  Value advice
must be calculated only from the canonical newest forecast; otherwise an older
horizon can win the first immutable paper-bet insert while the Lab is showing a
newer probability for the same match.
"""
from __future__ import annotations

import inspect

import find_value


def test_value_candidates_use_the_same_canonical_forecast_as_fixture_reads():
    source = inspect.getsource(find_value.load_candidates)
    assert "from ai.canonical_fixture_predictions p" in source
    assert "from ai.valid_predictions p" not in source


def test_value_loop_still_keys_existing_advice_on_the_fixture():
    source = inspect.getsource(find_value.load_candidates)
    assert "where x.fixture_id = p.fixture_id and x.market = '1X2'" in source
