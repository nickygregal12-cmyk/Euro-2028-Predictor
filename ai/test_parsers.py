"""Parse tests against the REAL Football-Data column layouts.

The build guide had to admit that fetch_history.py and fetch_fixtures_odds.py
had never been run against a live file, because football-data.co.uk was
returning 429s and 502s. That admission is the kind of gap where the missing
integration paths hide.

This closes most of it without the network: the headers below are the actual
headers from football-data.co.uk (fixtures.csv read 12 Aug 2026, and the
2025/26 season file layout), with synthetic rows underneath. If the parsers
handle these, the only thing left untested is the HTTP call itself.

Run:  python test_parsers.py
"""
from __future__ import annotations

from unittest import mock


# --- real fixtures.csv header (football-data.co.uk, 12 Aug 2026) ------------
FIXTURES_HEADER = (
    "Div,Date,Time,HomeTeam,AwayTeam,Referee,"
    "B365H,B365D,B365A,BFDH,BFDD,BFDA,BVH,BVD,BVA,BWH,BWD,BWA,"
    "PPH,PPD,PPA,SKBH,SKBD,SKBA,MaxH,MaxD,MaxA,AvgH,AvgD,AvgA,BFEH,BFED,BFEA,"
    "B365>2.5,B365<2.5,Max>2.5,Max<2.5,Avg>2.5,Avg<2.5,"
    "AHh,B365AHH,B365AHA,MaxAHH,MaxAHA,AvgAHH,AvgAHA,"
    "B365CH,B365CD,B365CA,BFDCH,BFDCD,BFDCA,BMGMCH,BMGMCD,BMGMCA,"
    "MaxCH,MaxCD,MaxCA,AvgCH,AvgCD,AvgCA,BFECH,BFECD,BFECA"
)
FIXTURES_ROWS = [
    # Div,Date,Time,Home,Away,Ref, then 1X2 books...
    "SC3,05/09/2026,15:00,Elgin,Peterhead,J Smith,"
    "2.30,3.30,3.10,2.28,3.35,3.05,2.25,3.40,3.15,2.32,3.30,3.00,"
    "2.30,3.25,3.10,2.35,3.30,3.05,2.40,3.45,3.25,2.30,3.32,3.08,2.44,3.55,3.30,"
    "1.90,1.90,1.95,1.95,1.88,1.92,"
    "-0.25,1.95,1.95,2.00,1.98,1.93,1.94,"
    ",,,,,,,,,,,,,,,,,",
    "E3,05/09/2026,12:30,Barrow,Crewe,A Jones,"
    "2.05,3.40,3.60,2.10,3.35,3.55,2.08,3.38,3.62,2.06,3.42,3.58,"
    "2.07,3.36,3.59,2.04,3.44,3.61,2.15,3.50,3.75,2.07,3.39,3.59,2.19,3.60,3.80,"
    "1.83,2.00,1.88,2.06,1.85,2.02,"
    "-0.25,1.92,1.98,1.96,2.02,1.91,1.97,"
    ",,,,,,,,,,,,,,,,,",
    # A row with a missing Betfair price, which must not sink the whole file
    "SC0,06/09/2026,15:00,Celtic,Hearts,W Collum,"
    "1.25,6.00,12.00,1.26,5.80,11.50,1.24,6.10,12.50,1.25,5.90,11.00,"
    "1.27,5.75,11.75,1.24,6.00,12.00,1.30,6.20,13.00,1.26,5.95,11.90,,,,"
    "1.55,2.45,1.60,2.50,1.57,2.42,"
    "-2.00,1.90,1.95,1.94,1.99,1.89,1.93,"
    ",,,,,,,,,,,,,,,,,",
]

# --- real season-file header (E0 2025/26 layout) ----------------------------
SEASON_HEADER = (
    "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,"
    "HS,AS,HST,AST,HF,AF,HC,AC,HY,AY,HR,AR,"
    "B365H,B365D,B365A,BWH,BWD,BWA,PSH,PSD,PSA,WHH,WHD,WHA,"
    "MaxH,MaxD,MaxA,AvgH,AvgD,AvgA,BFEH,BFED,BFEA,"
    "B365>2.5,B365<2.5,Max>2.5,Max<2.5,Avg>2.5,Avg<2.5,"
    "AHh,B365AHH,B365AHA,"
    "B365CH,B365CD,B365CA,PSCH,PSCD,PSCA,"
    "MaxCH,MaxCD,MaxCA,AvgCH,AvgCD,AvgCA,BFECH,BFECD,BFECA"
)
SEASON_ROWS = [
    "E0,16/08/2025,15:00,Arsenal,Chelsea,2,1,H,1,0,H,M Oliver,"
    "14,9,6,3,11,13,7,4,2,3,0,1,"
    "2.10,3.50,3.60,2.12,3.45,3.55,2.15,3.55,3.65,2.08,3.48,3.62,"
    "2.20,3.60,3.75,2.11,3.50,3.60,2.24,3.65,3.80,"
    "1.85,1.98,1.90,2.02,1.86,1.99,"
    "-0.25,1.95,1.95,"
    "2.05,3.55,3.70,2.08,3.60,3.72,"
    "2.12,3.66,3.80,2.06,3.57,3.68,2.15,3.70,3.85",
    # Older-style row: no closing columns at all, and a red card
    "E0,23/08/2025,17:30,Everton,Leeds,0,4,A,0,2,A,C Pawson,"
    "8,17,2,9,15,10,3,8,4,1,1,0,"
    "2.60,3.30,2.80,2.62,3.28,2.78,2.65,3.35,2.82,2.58,3.31,2.79,"
    "2.70,3.40,2.90,2.61,3.32,2.80,2.74,3.45,2.95,"
    "1.95,1.88,2.00,1.92,1.96,1.89,"
    "0.00,1.92,1.98,"
    ",,,,,,"
    ",,,,,,,,",
]


def _fake_response(text: str):
    r = mock.Mock()
    r.status_code = 200
    r.content = text.encode("latin-1")
    r.raise_for_status = lambda: None
    return r


def test_fixtures_parser() -> None:
    import fetch_fixtures_odds as F
    csv = FIXTURES_HEADER + "\n" + "\n".join(FIXTURES_ROWS) + "\n"
    with mock.patch.object(F.requests, "get", return_value=_fake_response(csv)):
        rows, market_rows = F.fetch(include_markets=True)

    by_book: dict[str, int] = {}
    for r in rows:
        by_book[r["bookmaker"]] = by_book.get(r["bookmaker"], 0) + 1
    print(f"  parsed {len(rows)} price rows: {by_book}")

    assert by_book.get("B365") == 3, "Bet365 prices not extracted for every fixture"
    assert by_book.get("MAX") == 3 and by_book.get("AVG") == 3
    # Celtic's Betfair price is blank; that row must be skipped for BFE only.
    assert by_book.get("BFE") == 2, "a blank exchange price should skip one row, not all"
    divisions = {r["division"] for r in rows}
    assert divisions == {"SC3", "E3", "SC0"}, f"divisions lost: {divisions}"
    elgin = [r for r in rows if r["home_canonical"] == "Elgin" and r["bookmaker"] == "MAX"][0]
    assert (elgin["odds_h"], elgin["odds_d"], elgin["odds_a"]) == (2.40, 3.45, 3.25)
    sc3_markets = [r for r in market_rows if r["division"] == "SC3"]
    assert len(sc3_markets) == 12, "free O/U and AH prices were not captured"
    assert any(r["market"] == "OU" and r["selection"] == "Over" and
               r["bookmaker"] == "B365" and r["odds"] == 1.90
               for r in sc3_markets)
    assert any(r["market"] == "AH" and r["selection"] == "Home" and
               r["line"] == -0.25 for r in sc3_markets)
    print("  [pass] fixtures.csv parsed; lower divisions and a missing price handled")


def test_fixture_sync_parser() -> None:
    import sync_fixtures as S
    csv = FIXTURES_HEADER + "\n" + "\n".join(FIXTURES_ROWS) + "\n"
    with mock.patch.object(S.requests, "get", return_value=_fake_response(csv)), \
         mock.patch.object(S, "platform_fixture_links", return_value={}):
        rows = S.fetch()

    keys = {(r["division"], r["league_key"]) for r in rows}
    print(f"  {len(rows)} fixtures -> {sorted(keys)}")
    assert ("SC3", "SL2") in keys and ("E3", "EL2") in keys and ("SC0", "SPL") in keys, \
        "division -> league mapping is wrong for the lower divisions"
    assert all(r["season"] == "2627" for r in rows), "season code wrong"

    # Kick-off must be UK local converted to UTC. 5 Sept is BST, so 15:00 -> 14:00Z.
    elgin = [r for r in rows if r["home_canonical"] == "Elgin"][0]
    assert elgin["kickoff_at"].hour == 14, (
        f"BST not applied: 15:00 UK became {elgin['kickoff_at']}. A one-hour error "
        "here makes a pre-kickoff bet look late.")
    print(f"  [pass] 15:00 UK on 5 Sep -> {elgin['kickoff_at']:%H:%MZ} (BST handled)")


def test_history_parser() -> None:
    import fetch_history as H
    csv = SEASON_HEADER + "\n" + "\n".join(SEASON_ROWS) + "\n"
    with mock.patch.object(H.requests, "get", return_value=_fake_response(csv)):
        rows = H.fetch_one("E0", "2526")

    assert len(rows) == 2, f"expected 2 matches, got {len(rows)}"
    a, e = rows[0], rows[1]
    assert (a["home_canonical"], a["away_canonical"]) == ("Arsenal", "Chelsea")
    assert (a["home_goals"], a["away_goals"], a["result"]) == (2, 1, "H")
    assert (a["ht_home_goals"], a["ht_away_goals"]) == (1, 0)
    assert (a["home_shots"], a["away_shots_ot"], a["home_corners"]) == (14, 3, 7)
    assert (a["home_yellows"], a["away_reds"]) == (2, 1)
    assert a["referee"] == "M Oliver"
    print("  results, stats, cards and referee all parsed")

    # Odds, per book, pre-match and closing, kept apart
    assert (a["odds_avg_h"], a["odds_avg_d"], a["odds_avg_a"]) == (2.11, 3.50, 3.60)
    assert (a["odds_max_h"], a["odds_ps_h"], a["odds_bfe_h"]) == (2.20, 2.15, 2.24)
    assert (a["close_avg_h"], a["close_ps_h"], a["close_max_h"]) == (2.06, 2.08, 2.12)
    print("  Avg/Max/Pinnacle/Betfair extracted separately, pre-match and closing")

    free_markets = a["_market_prices"]
    assert len(free_markets) == 8
    assert any(p["market"] == "OU" and p["bookmaker"] == "AVG" and
               p["selection"] == "Under" and p["odds"] == 1.99
               for p in free_markets)
    assert any(p["market"] == "AH" and p["line"] == -0.25
               for p in free_markets)

    # Overround of the average book should sit a few percent above 1;
    # the best-price book should be much tighter.
    print(f"  overround  Avg {a['overround_avg']:.4f}   Max {a['overround_max']:.4f}")
    assert 1.0 < a["overround_avg"] < 1.15
    assert a["overround_max"] < a["overround_avg"], \
        "best-price book should have a smaller overround than the average book"

    # Benchmark probability comes from CLOSING average, and must be a distribution
    tot = a["mkt_home_prob"] + a["mkt_draw_prob"] + a["mkt_away_prob"]
    assert abs(tot - 1.0) < 1e-6, f"benchmark probabilities sum to {tot}"

    # The second row has no closing columns at all — must not crash, must be null
    assert e["close_avg_h"] is None and e["home_reds"] == 1
    print("  [pass] a row with no closing odds parses cleanly rather than crashing")


def test_header_only_fixtures_file_is_not_an_error() -> None:
    """Football-Data publishes a header and no rows between rounds.

    This is what actually happened on hosted Development on 12 August 2026,
    nine days before the season's first fixture: the bootstrap imported 46,215
    matches and then died on `KeyError: 'Div'`. `dropna(how='all', axis=1)`
    drops EVERY column of a row-less frame, because each one is vacuously
    all-NaN, and the next line asked for a column that had just been removed.

    A quiet week is not a failure. If it were, the Tuesday and Friday jobs
    would go red on every international break until nobody read them.
    """
    import fetch_fixtures_odds as F
    import sync_fixtures as S

    empty = FIXTURES_HEADER + "\n"

    with mock.patch.object(S.requests, "get", return_value=_fake_response(empty)):
        assert S.fetch() == []

    with mock.patch.object(F.requests, "get", return_value=_fake_response(empty)):
        assert F.fetch(include_markets=True) == ([], [])
        assert F.fetch() == []

    print("  [pass] a header-only fixtures.csv syncs nothing instead of crashing")


def test_header_only_season_file_is_not_an_error() -> None:
    """The same shape in a season results file, before its first match."""
    import fetch_history as H
    empty = SEASON_HEADER + "\n"
    with mock.patch.object(H.requests, "get", return_value=_fake_response(empty)):
        assert H.fetch_one("E0", "2627") == []
    print("  [pass] a header-only season file skips instead of crashing")


def test_a_genuine_shape_change_still_fails_loudly() -> None:
    """Empty is tolerated; wrong is not, and it names what it received."""
    import sync_fixtures as S
    wrong = "Division,Kickoff,Home,Away\nE0,05/09/2026,Arsenal,Chelsea\n"
    with mock.patch.object(S.requests, "get", return_value=_fake_response(wrong)):
        try:
            S.fetch()
        except SystemExit as exit_error:
            assert "Div" in str(exit_error) and "Division" in str(exit_error)
        else:
            raise AssertionError("a changed fixtures.csv shape must not pass")
    print("  [pass] a changed shape still fails, naming the columns it got")


def _bom_response(text: str):
    """The real thing: a UTF-8 BOM in front of a Latin-1 body."""
    r = mock.Mock()
    r.status_code = 200
    r.content = b"\xef\xbb\xbf" + text.encode("latin-1")
    r.raise_for_status = lambda: None
    return r


def test_utf8_bom_does_not_rename_the_first_column() -> None:
    """What actually broke the first hosted bootstrap.

    Football-Data serves fixtures.csv with a UTF-8 BOM, and the body is
    Latin-1. Decoding those three bytes as Latin-1 turns them into `ï»¿` and
    welds them onto the first column's name, so `Div` arrives as `ï»¿Div`.

    Measured on hosted Development on 13 August 2026: the bootstrap imported
    46,215 matches and then died on the fixture sync, reporting
    `['ï»¿Div', 'Date', 'Time', ...]`. Only the FIRST column is affected,
    which is why the season files were unharmed — nothing reads their first
    column, because the division is passed in rather than parsed out.
    """
    import fetch_fixtures_odds as F
    import sync_fixtures as S
    csv = FIXTURES_HEADER + "\n" + "\n".join(FIXTURES_ROWS) + "\n"

    with mock.patch.object(S.requests, "get", return_value=_bom_response(csv)), \
         mock.patch.object(S, "platform_fixture_links", return_value={}):
        rows = S.fetch()
    assert {r["division"] for r in rows} == {"SC3", "E3", "SC0"}, \
        "a BOM on the first column must not lose every fixture"

    with mock.patch.object(F.requests, "get", return_value=_bom_response(csv)):
        priced = F.fetch()
    assert {r["division"] for r in priced} == {"SC3", "E3", "SC0"}

    print("  [pass] a UTF-8 BOM is stripped; Div survives as Div")


def test_bom_on_a_season_file_is_also_stripped() -> None:
    """The season files are the same family; do not wait to be surprised."""
    import fetch_history as H
    csv = SEASON_HEADER + "\n" + "\n".join(SEASON_ROWS) + "\n"
    with mock.patch.object(H.requests, "get", return_value=_bom_response(csv)):
        rows = H.fetch_one("E0", "2526")
    assert len(rows) == 2 and rows[0]["home_canonical"] == "Arsenal"
    print("  [pass] a BOM on a season file parses cleanly too")


def main() -> None:
    print("1. fixtures.csv (live price feed)")
    test_fixtures_parser()
    print("\n2. fixtures.csv -> ai.fixtures")
    test_fixture_sync_parser()
    print("\n3. season results file")
    test_history_parser()
    print("\n4. the BOM, quiet weeks and genuine shape changes")
    test_utf8_bom_does_not_rename_the_first_column()
    test_bom_on_a_season_file_is_also_stripped()
    test_header_only_fixtures_file_is_not_an_error()
    test_header_only_season_file_is_not_an_error()
    test_a_genuine_shape_change_still_fails_loudly()
    print("\nALL PARSER CHECKS PASSED (against real column layouts)")


if __name__ == "__main__":
    main()
