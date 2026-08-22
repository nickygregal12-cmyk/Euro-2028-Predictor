"""Contract 214 regressions for fixture-level forecast currency in the value loop.

A fixture deliberately owns several immutable forecast horizons. The raw
candidate reader keeps them inspectable, but value advice must be calculated
only from the canonical newest forecast; otherwise an older horizon can win the
first immutable paper-bet insert while the Lab is showing a newer probability.
"""
from __future__ import annotations

import inspect

import find_value


def test_value_candidates_mark_the_same_canonical_forecast_as_fixture_reads():
    source = inspect.getsource(find_value.load_candidates)
    assert "from ai.valid_predictions p" in source
    assert "join ai.canonical_fixture_predictions cp on cp.fixture_id = p.fixture_id" in source
    assert "(p.id = cp.id) as is_canonical" in source


def test_value_loop_assesses_only_the_canonical_marked_rows():
    source = inspect.getsource(find_value.main)
    assert 'df.loc[df["is_canonical"].fillna(False)].copy()' in source
    assert 'current.groupby("prediction_id"' in source


def test_value_loop_still_keys_existing_advice_on_the_fixture():
    source = inspect.getsource(find_value.load_candidates)
    assert "where x.fixture_id = p.fixture_id and x.market = '1X2'" in source