"""Offline checks for The Odds API layer.

No network and no key. The response fixtures below use the exact field names
from the provider's v4 documentation, so the parsing and cost arithmetic are
exercised even though the HTTP call is not.

The budget guard gets the most attention here. At 20,000 credits a month, a
loop that miscounts is not a bug you notice on a dashboard — it is a quota you
discover is gone, and historical calls cost ten times list price.

Run:  python test_oddsapi.py
"""
from __future__ import annotations

from unittest import mock

import oddsapi as api
from aliases import canonical_from_odds_api

# Documented v4 shape, decimal odds, soccer.
LIVE_PAYLOAD = [
    {
        "id": "e1a2b3c4",
        "sport_key": "soccer_england_league2",
        "sport_title": "League Two",
        "commence_time": "2026-09-05T14:00:00Z",
        "home_team": "Barrow",
        "away_team": "Crewe Alexandra",
        "bookmakers": [
            {"key": "pinnacle", "title": "Pinnacle", "last_update": "2026-09-05T13:55:02Z",
             "markets": [{"key": "h2h", "last_update": "2026-09-05T13:55:02Z", "outcomes": [
                 {"name": "Barrow", "price": 2.10, "point": None},
                 {"name": "Crewe Alexandra", "price": 3.55, "point": None},
                 {"name": "Draw", "price": 3.40, "point": None}]}]},
            {"key": "betfair_ex_uk", "title": "Betfair", "last_update": "2026-09-05T13:54:40Z",
             "markets": [
                 {"key": "h2h", "outcomes": [
                     {"name": "Barrow", "price": 2.16},
                     {"name": "Crewe Alexandra", "price": 3.65},
                     {"name": "Draw", "price": 3.50}]},
                 {"key": "totals", "outcomes": [
                     {"name": "Over", "price": 1.95, "point": 2.5},
                     {"name": "Under", "price": 1.92, "point": 2.5}]}]},
        ],
    },
    {
        "id": "f9e8d7c6",
        "sport_key": "soccer_england_league2",
        "commence_time": "2026-09-05T14:00:00Z",
        "home_team": "Nottingham Forest",       # third-vocabulary spelling
        "away_team": "Some Unknown Club",       # deliberately unmatchable
        "bookmakers": [],                       # empty: must not crash, costs nothing
    },
]


def test_hosted_odds_secret_name_is_preferred() -> None:
    with mock.patch.dict(
        api.os.environ,
        {"ODDS_API": "hosted", "ODDS_API_KEY": "legacy"},
        clear=True,
    ):
        assert api.OddsApiClient(dry_run=True).api_key == "hosted"


def test_legacy_odds_secret_name_remains_compatible() -> None:
    with mock.patch.dict(api.os.environ, {"ODDS_API_KEY": "legacy"}, clear=True):
        assert api.OddsApiClient(dry_run=True).api_key == "legacy"


HISTORICAL_PAYLOAD = {
    "timestamp": "2026-05-02T14:55:00Z",
    "previous_timestamp": "2026-05-02T14:50:00Z",
    "next_timestamp": "2026-05-02T15:00:00Z",
    "data": [
        {"id": "h1", "sport_key": "soccer_england_league2",
         "commence_time": "2026-05-02T15:00:00Z",
         "home_team": "Barrow", "away_team": "Grimsby Town",
         "bookmakers": [{"key": "pinnacle", "title": "Pinnacle",
                         "last_update": "2026-05-02T14:54:00Z",
                         "markets": [{"key": "btts", "outcomes": [
                             {"name": "Yes", "price": 1.85},
                             {"name": "No", "price": 1.95}]}]}]},
    ],
}


class _Resp:
    def __init__(self, payload, headers=None, status=200):
        self._payload = payload
        self.headers = headers or {}
        self.status_code = status
        self.text = ""

    def json(self):
        return self._payload

    def raise_for_status(self):
        pass


def test_cost_model() -> None:
    cases = [
        ("free event discovery", dict(endpoint="events"), 0),
        ("market probe", dict(endpoint="event_markets"), 1),
        ("live h2h, uk region", dict(endpoint="odds", markets=["h2h"], regions=["uk"]), 1),
        ("live h2h+totals, uk", dict(endpoint="odds", markets=["h2h", "totals"],
                                     regions=["uk"]), 2),
        ("live h2h+totals, uk+eu", dict(endpoint="odds", markets=["h2h", "totals"],
                                        regions=["uk", "eu"]), 4),
        # Naming <=10 bookmakers is one region-unit, so a targeted sharp-book
        # request costs the same as a whole region and returns better prices.
        ("live h2h+totals, 4 named books",
         dict(endpoint="odds", markets=["h2h", "totals"],
              bookmakers=list(api.SHARP_BOOKMAKERS)), 2),
        ("11 named books becomes 2 units",
         dict(endpoint="odds", markets=["h2h"],
              bookmakers=[f"b{i}" for i in range(11)]), 2),
        ("HISTORICAL is 10x", dict(endpoint="odds", markets=["h2h", "totals"],
                                   regions=["uk"], historical=True), 20),
    ]
    for label, kw, expected in cases:
        got = api.estimate_cost(**kw)
        assert got == expected, f"{label}: expected {expected}, got {got}"
        print(f"  {label:36} {got:>3} credits  [ok]")


def test_budget_guard_blocks_overspend() -> None:
    """The guard must refuse BEFORE the request, not after."""
    client = api.OddsApiClient(api_key="x", soft_cap=1000,
                               already_used_this_month=995)
    calls = {"n": 0}

    def _fake_get(*a, **k):
        calls["n"] += 1
        return _Resp(LIVE_PAYLOAD, {"x-requests-last": "20"})

    with mock.patch.object(api.requests, "get", _fake_get):
        # 20 credits would take it to 1015, past the cap.
        try:
            client.historical_odds("soccer_epl", "2026-05-02T14:55:00Z",
                                   markets=["h2h", "totals"], regions=["uk"])
            raise AssertionError("budget guard did not fire")
        except api.BudgetExceeded as exc:
            assert "soft cap" in str(exc)
    assert calls["n"] == 0, "an HTTP request was made despite the budget guard"
    print("  [pass] the guard refuses before spending, not after")


def test_reported_cost_overrides_estimate() -> None:
    """Charge what the provider says. Event-odds bills markets RETURNED, so a
    request for five markets that yields two costs two, and our pessimistic
    estimate would otherwise stop the run early for no reason."""
    client = api.OddsApiClient(api_key="x", soft_cap=10000)
    with mock.patch.object(api.requests, "get",
                           lambda *a, **k: _Resp(LIVE_PAYLOAD, {
                               "x-requests-last": "2",
                               "x-requests-remaining": "17998",
                               "x-requests-used": "2"})):
        client.odds("soccer_epl", markets=["h2h", "totals", "btts", "correct_score",
                                           "halftime_fulltime"], regions=["uk"])
    rec = client.calls[-1]
    assert rec.estimated_cost == 5, "estimate should be pessimistic (markets requested)"
    assert rec.reported_cost == 2, "reported cost not captured"
    assert client.spent_this_run == 2, "spent should follow the provider, not the estimate"
    print(f"  [pass] estimated {rec.estimated_cost}, provider charged "
          f"{rec.reported_cost}, ledger recorded {client.spent_this_run}")


def test_flatten_live_and_historical() -> None:
    rows = api.flatten_odds(LIVE_PAYLOAD)
    assert len(rows) == 8, f"expected 8 outcome rows, got {len(rows)}"
    pin = [r for r in rows if r["bookmaker"] == "pinnacle"]
    assert len(pin) == 3 and abs(pin[0]["price"] - 2.10) < 1e-9
    tot = [r for r in rows if r["market"] == "totals"]
    assert all(r["point"] == 2.5 for r in tot), "the totals line was lost"
    assert rows[0]["snapshot_timestamp"] is None, "live payload has no snapshot"
    print(f"  [pass] live payload -> {len(rows)} rows; totals line preserved")

    hrows = api.flatten_odds(HISTORICAL_PAYLOAD)
    assert len(hrows) == 2
    assert all(r["snapshot_timestamp"] == "2026-05-02T14:55:00Z" for r in hrows), \
        "the historical envelope timestamp was not carried onto the prices"
    print("  [pass] historical envelope unwrapped and its timestamp carried through")


def test_third_vocabulary() -> None:
    """The Odds API is a third spelling of every club, alongside Football-Data
    and this platform. An unmatched name must be reported, never guessed."""
    for api_name, expected in [("Nottingham Forest", "Nott'm Forest"),
                               ("Crewe Alexandra", "Crewe"),
                               ("Heart of Midlothian", "Hearts"),
                               ("Wolverhampton Wanderers", "Wolves")]:
        canon, how = canonical_from_odds_api(api_name)
        assert canon == expected, f"{api_name} -> {canon}, expected {expected}"
        assert how == "alias"
    canon, how = canonical_from_odds_api("Some Unknown Club")
    assert canon is None and how == "unmatched", \
        "an unknown club was silently matched to something"
    # The failure mode this protects against: two real clubs two characters apart.
    a, _ = canonical_from_odds_api("Bristol City")
    b, _ = canonical_from_odds_api("Bristol Rovers")
    assert a != b, "Bristol City and Bristol Rovers collapsed to the same club"
    print("  [pass] known names map, unknown names are reported, near-misses stay apart")


def test_uncovered_leagues_are_declared() -> None:
    assert set(api.SPORT_KEYS) == {"EPL", "ECH", "EL1", "EL2", "SPL"}
    assert set(api.UNCOVERED_LEAGUES) == {"ENL", "SCH", "SL1", "SL2"}
    print(f"  [pass] 5 leagues covered, 4 declared uncovered "
          f"({', '.join(api.UNCOVERED_LEAGUES)}) — those stay on Football-Data")


def main() -> None:
    print("1. cost model")
    test_cost_model()
    print("\n2. budget guard")
    test_budget_guard_blocks_overspend()
    test_reported_cost_overrides_estimate()
    print("\n3. response parsing")
    test_flatten_live_and_historical()
    print("\n4. club name reconciliation")
    test_third_vocabulary()
    print("\n5. coverage honesty")
    test_uncovered_leagues_are_declared()
    print("\nALL ODDS API CHECKS PASSED")


if __name__ == "__main__":
    main()
