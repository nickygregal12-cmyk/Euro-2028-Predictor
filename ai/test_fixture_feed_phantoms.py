"""The fixtures-file doorway, tested on the shape Production actually held.

Production on 19 August 2026 carried `Sheffield Weds v Bradford` from 16 August
-- four forecasts, a decision, two paper bets, 169 price rows -- and a second
scheduled row for the same match, `Sheffield Wed v Bradford City`, minted by the
fixtures feed on 18 August with no forecast, no bet and 24 price rows.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from repair_identity import retire_fixture_feed_phantoms

KICKOFF = datetime(2026, 8, 20, 19, 0, tzinfo=timezone.utc)
MATCH_DAY = date(2026, 8, 20)

REAL = {
    "id": "2c00bcea", "division": "E2", "match_date": MATCH_DAY,
    "kickoff_at": KICKOFF, "home_canonical": "Sheffield Weds",
    "away_canonical": "Bradford",
}
PHANTOM = {
    "id": "b3e86c9b", "division": "E2", "match_date": MATCH_DAY,
    "kickoff_at": KICKOFF, "home_canonical": "Sheffield Wed",
    "away_canonical": "Bradford City",
}


class FakeConn:
    """Enough of the connection to record what the repair would do."""

    def __init__(self, fixtures, evidence=None, rowcounts=None):
        self.fixtures = fixtures
        self.evidence = evidence or {}
        self.rowcounts = rowcounts or {}
        self.writes: list[tuple[str, tuple]] = []
        self.committed = False
        self._result = None
        self.rowcount = 0

    def execute(self, sql, params=()):
        squashed = " ".join(sql.split())
        if squashed.startswith("select id, division"):
            self._result = list(self.fixtures)
        elif "from ai.predictions p where p.fixture_id" in squashed:
            held = self.evidence.get(params[0], {"forecasts": 0, "bets": 0})
            self._result = [held]
        elif squashed.startswith("select count(*) as n from ai.market_prices"):
            self._result = [{"n": 24}]
        else:
            self.writes.append((squashed, params))
            self._result = []
            self.rowcount = next(
                (n for prefix, n in self.rowcounts.items() if squashed.startswith(prefix)), 0)
        return self

    def fetchall(self):
        return self._result

    def fetchone(self):
        return self._result[0] if self._result else None

    def commit(self):
        self.committed = True


def test_a_dry_run_finds_the_phantom_and_writes_nothing():
    conn = FakeConn([REAL, PHANTOM])
    report = retire_fixture_feed_phantoms(conn, apply=False)

    assert [row["fixture_id"] for row in report["retired"]] == ["b3e86c9b"]
    assert report["retired"][0]["twin_id"] == "2c00bcea"
    assert report["retired"][0]["resolves_to"] == "Sheffield Weds v Bradford"
    assert report["applied"] is False
    assert conn.writes == [], "a dry run must not write"
    assert conn.committed is False


def test_applying_repoints_evidence_voids_the_row_and_never_deletes_it():
    conn = FakeConn([REAL, PHANTOM])
    retire_fixture_feed_phantoms(conn, apply=True)
    written = " | ".join(sql for sql, _ in conn.writes)

    # Evidence follows the match, not the row.
    assert "update ai.market_prices set fixture_id" in written
    # The derived projection is rebuilt from prices, so it goes.
    assert "delete from ai.fixture_odds where fixture_id" in written
    # The row is retired, not destroyed: predictions and bets reference fixtures.
    assert "update ai.fixtures set status = 'void'" in written
    assert "delete from ai.fixtures" not in written
    assert conn.committed is True


def test_the_surviving_fixture_is_never_voided_or_stripped():
    """It is named, but only ever as the destination.

    Repointing prices onto the twin has to name the twin -- that is the point --
    so the assertion worth making is narrower: the destructive statements must
    only ever carry the phantom.
    """
    conn = FakeConn([REAL, PHANTOM])
    retire_fixture_feed_phantoms(conn, apply=True)

    for sql, params in conn.writes:
        if sql.startswith(("delete from ai.fixture_odds", "update ai.fixtures set status")):
            assert params == ("b3e86c9b",), (
                f"{sql!r} touched {params}, which is not the phantom")

    repoint = [p for sql, p in conn.writes if sql.startswith("update ai.market_prices")]
    assert repoint == [("2c00bcea", "b3e86c9b")], "prices move FROM the phantom TO the twin"


def test_a_phantom_holding_evidence_is_reported_rather_than_voided():
    """Voiding this would silently move betting evidence.

    That is the quarantine mechanism's job, with its own audit trail, and not
    something a tidy-up should do on its way past.
    """
    conn = FakeConn([REAL, PHANTOM], evidence={"b3e86c9b": {"forecasts": 1, "bets": 2}})
    report = retire_fixture_feed_phantoms(conn, apply=True)

    assert report["retired"] == []
    assert report["skipped"][0]["reason"] == "carries evidence"
    assert report["skipped"][0]["bets"] == 2
    assert conn.writes == []


def test_a_renamed_fixture_with_no_twin_is_reported_rather_than_guessed_at():
    """Renaming in place is a different, riskier operation than folding a
    duplicate away, so this reports and stops."""
    conn = FakeConn([PHANTOM])
    report = retire_fixture_feed_phantoms(conn, apply=True)

    assert report["retired"] == []
    assert report["skipped"][0]["reason"] == "no canonical twin"
    assert report["skipped"][0]["resolves_to"] == "Sheffield Weds v Bradford"
    assert conn.writes == []


@pytest.mark.parametrize("fixtures", [[REAL], []])
def test_an_already_canonical_board_is_a_no_op(fixtures):
    conn = FakeConn(fixtures)
    report = retire_fixture_feed_phantoms(conn, apply=True)
    assert report["retired"] == []
    assert report["skipped"] == []
    assert conn.writes == []


def test_the_audit_counts_what_moved_not_what_the_twin_ends_up_holding():
    """The first version reported the destination's TOTAL as "repointed".

    It logged 570 market prices moved when 24 rows had actually moved, and
    counted fixtures rather than rows for the derived odds. An audit trail that
    overstates is worse than one that stays silent, because the number looks
    like evidence.
    """
    conn = FakeConn(
        [REAL, PHANTOM],
        rowcounts={
            'update ai.market_prices': 24,
            'delete from ai.fixture_odds': 24,
        },
    )
    report = retire_fixture_feed_phantoms(conn, apply=True)

    assert report["market_price_rows_moved"] == 24
    assert report["fixture_odds_rows_deleted"] == 24
    assert report["retired"][0]["market_prices_moved"] == 24
    assert report["retired"][0]["fixture_odds_deleted"] == 24


def test_a_dry_run_reports_no_counts_it_did_not_earn():
    conn = FakeConn([REAL, PHANTOM], rowcounts={'update ai.market_prices': 24})
    report = retire_fixture_feed_phantoms(conn, apply=False)
    assert report["market_price_rows_moved"] == 0
    assert report["fixture_odds_rows_deleted"] == 0
    assert "market_prices_moved" not in report["retired"][0]
