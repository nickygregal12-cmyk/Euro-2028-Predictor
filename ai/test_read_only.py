"""The research path cannot write to the database it reads.

The nine-league studies need the whole historical archive, and the only
execution plane with access to it is the hosted runner, whose database is
Production. So the guard that makes running them there acceptable is not a
convention about which flags a workflow passes — it is the session itself.

Three properties, because each fails differently:

  * `read_only` reads the environment the workflow sets;
  * `connect` turns that into `default_transaction_read_only=on`, so the
    refusal comes from PostgreSQL on the first write rather than from a caller
    having remembered something;
  * `experiments.py` refuses the contradictory REQUEST up front, so a
    twenty-minute study does not run to completion and then die on its insert.
"""
from __future__ import annotations

import sys

import pytest

import config
import db


class _FakeConn:
    def __init__(self) -> None:
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True
        return False


@pytest.fixture
def captured(monkeypatch):
    """Capture the keyword arguments db.connect hands to psycopg."""
    seen: dict = {}

    def fake_connect(url, **kwargs):
        seen["url"] = url
        seen.update(kwargs)
        return _FakeConn()

    monkeypatch.setattr(db.psycopg, "connect", fake_connect)
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/none")
    return seen


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on", " on "])
def test_read_only_recognises_the_affirmative_spellings(monkeypatch, value):
    monkeypatch.setenv("AI_READ_ONLY", value)
    assert config.read_only() is True


@pytest.mark.parametrize("value", ["", "0", "false", "no", "off"])
def test_read_only_is_off_unless_asked_for(monkeypatch, value):
    monkeypatch.setenv("AI_READ_ONLY", value)
    assert config.read_only() is False


def test_read_only_defaults_to_off_when_unset(monkeypatch):
    # Every existing job — import, training, prediction, settlement — writes,
    # and none of them sets this. Defaulting it on would break all of them.
    monkeypatch.delenv("AI_READ_ONLY", raising=False)
    assert config.read_only() is False


def test_connect_opens_the_session_read_only_when_asked(monkeypatch, captured):
    monkeypatch.setenv("AI_READ_ONLY", "1")
    with db.connect():
        pass
    assert captured.get("options") == "-c default_transaction_read_only=on"


def test_connect_is_writable_by_default(monkeypatch, captured):
    monkeypatch.delenv("AI_READ_ONLY", raising=False)
    with db.connect():
        pass
    # Not merely absent-and-harmless: an `options` string here would be sent to
    # the server for every ordinary job in the package.
    assert "options" not in captured


def test_experiments_refuses_record_under_read_only(monkeypatch):
    """The contradictory request dies before the study runs, not after."""
    import experiments

    monkeypatch.setenv("AI_READ_ONLY", "1")
    monkeypatch.setattr(
        sys, "argv",
        ["experiments.py", "--league", "EPL", "--study", "half-life", "--record"])

    # If this ever stops raising, the study would run to completion against a
    # read-only session and only then fail on the insert — having spent the
    # whole runtime and produced a report that claims to have been recorded.
    called: list = []
    monkeypatch.setattr(
        experiments, "record_experiment",
        lambda *a, **k: called.append(a))

    with pytest.raises(SystemExit) as excinfo:
        experiments.main()

    assert "AI_READ_ONLY" in str(excinfo.value)
    assert called == [], "the study recorded despite being refused"


def test_experiments_allows_record_when_writes_are_permitted(monkeypatch):
    """The refusal is conditional; it must not have broken the recorded path.

    Stops before the study itself, which needs a database. What is asserted is
    that the guard above is not reached — the run proceeds past it.
    """
    import experiments

    monkeypatch.delenv("AI_READ_ONLY", raising=False)
    monkeypatch.setattr(
        sys, "argv",
        ["experiments.py", "--league", "EPL", "--study", "half-life", "--record"])

    sentinel = RuntimeError("reached the study")

    def explode(_args):
        raise sentinel

    monkeypatch.setitem(experiments.STUDY_FUNCTIONS, "half-life", explode)

    with pytest.raises(RuntimeError) as excinfo:
        experiments.main()
    assert excinfo.value is sentinel
