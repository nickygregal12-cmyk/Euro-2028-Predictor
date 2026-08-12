"""The Odds API client, free-first with explicit quota accounting.

At that budget the accounting is the feature. Three things from the provider's
own documentation shape everything here:

  * `/v4/sports/{sport}/events` costs NOTHING. Event discovery and fixture
    matching are free, so nothing in this module ever guesses at an event id.
  * `/events/{id}/markets` costs 1 credit and reports exactly which markets each
    bookmaker offers for that event. The API publishes no coverage matrix for
    the lower English divisions or the SPL, and its own note says additional
    markets are "currently limited to US sports and selected bookmakers". Five
    credits of probing therefore replaces an assumption that could otherwise
    waste a month's quota.
  * Historical calls cost 10x, and event-level historical calls are billed per
    event. A naive loop over three seasons of League Two is a five-figure spend.

Hence: a cost estimate before every call, a hard monthly cap checked against the
database, a snapshot ledger so a killed run resumes rather than re-buying, and
reconciliation of our arithmetic against the provider's x-requests-last header.
"""
from __future__ import annotations

import math
import os
import time
from dataclasses import dataclass, field

import requests

BASE = "https://api.the-odds-api.com/v4"

# Only these four are accepted by the all-events /odds endpoint.
FEATURED_MARKETS = ("h2h", "spreads", "totals", "outrights")

# Everything else must be fetched one event at a time, which is what makes
# derivative-market history expensive.
SOCCER_ADDITIONAL_MARKETS = (
    "btts", "btts_h1", "correct_score", "correct_score_h1", "double_chance",
    "double_chance_h1", "draw_no_bet", "halftime_fulltime", "team_totals",
    "alternate_totals", "alternate_team_totals", "corners_1x2",
    "alternate_totals_corners", "alternate_spreads_corners",
    "alternate_totals_cards", "alternate_spreads_cards",
)

# The five competitions The Odds API carries that overlap this project.
# Deliberately not nine: there is no National League, Scottish Championship,
# Scottish League One or Scottish League Two key. Those four divisions stay on
# Football-Data and the free Betfair delayed key.
SPORT_KEYS = {
    "EPL": "soccer_epl",
    "ECH": "soccer_efl_champ",
    "EL1": "soccer_england_league1",
    "EL2": "soccer_england_league2",
    "SPL": "soccer_spl",
}
UNCOVERED_LEAGUES = ("ENL", "SCH", "SL1", "SL2")

# Pinnacle is an `eu` bookmaker and is the sharpest closing benchmark available
# here. Bet365 is not offered in `uk` or `eu` at all. Naming bookmakers rather
# than regions is usually cheaper: every group of ten counts as one region.
SHARP_BOOKMAKERS = ("pinnacle", "betfair_ex_uk", "smarkets", "matchbook")
SOFT_UK_BOOKMAKERS = ("williamhill", "paddypower", "skybet", "betvictor",
                      "boylesports", "unibet_uk", "betfred_uk", "coral",
                      "ladbrokes_uk", "betway")

HISTORICAL_FEATURED_FROM = "2020-06-06T00:00:00Z"
HISTORICAL_ADDITIONAL_FROM = "2023-05-03T05:30:00Z"


class BudgetExceeded(RuntimeError):
    pass


def region_units(regions=None, bookmakers=None) -> int:
    """How many 'regions' the provider will bill this call as.

    Naming bookmakers is billed in groups of ten, so a targeted request for
    Pinnacle plus two exchanges costs the same as one whole region while
    returning far more useful prices.
    """
    if bookmakers:
        return max(1, math.ceil(len(bookmakers) / 10))
    return max(1, len(regions or ["uk"]))


def estimate_cost(endpoint: str, markets=None, regions=None, bookmakers=None,
                  historical: bool = False) -> int:
    """Pre-flight credit estimate. Deliberately pessimistic for event-odds.

    The provider bills event-odds on markets RETURNED, not requested, and does
    not charge for an empty response — so a request for five markets that yields
    two costs two. This estimate assumes all requested markets come back, which
    means the budget guard errs toward stopping early rather than overspending.
    """
    if endpoint == "events":
        return 0
    if endpoint in ("historical_events", "event_markets", "participants"):
        return 1
    units = region_units(regions, bookmakers)
    n_markets = max(1, len(markets or ["h2h"]))
    cost = n_markets * units
    return cost * 10 if historical else cost


@dataclass
class CallRecord:
    endpoint: str
    estimated_cost: int
    reported_cost: int | None = None
    reported_remaining: int | None = None
    reported_used: int | None = None
    http_status: int | None = None
    rows_returned: int = 0
    sport_key: str | None = None
    event_id: str | None = None
    markets: list[str] | None = None
    regions: list[str] | None = None
    bookmakers: list[str] | None = None
    snapshot_date: str | None = None
    is_historical: bool = False


@dataclass
class OddsApiClient:
    api_key: str = field(
        default_factory=lambda: os.environ.get("ODDS_API", "")
        or os.environ.get("ODDS_API_KEY", "")
    )
    soft_cap: int = 450
    spent_this_run: int = 0
    already_used_this_month: int = 0
    calls: list[CallRecord] = field(default_factory=list)
    sleep_between: float = 1.0          # the docs give no numeric rate limit,
                                        # only "space requests over seconds"
    timeout: int = 45
    dry_run: bool = False

    def __post_init__(self) -> None:
        if not self.api_key and not self.dry_run:
            raise SystemExit("ODDS_API (or ODDS_API_KEY) is not set.")

    # -- budget ------------------------------------------------------------

    @property
    def used(self) -> int:
        return self.already_used_this_month + self.spent_this_run

    @property
    def remaining(self) -> int:
        return max(self.soft_cap - self.used, 0)

    def _check_budget(self, cost: int) -> None:
        if self.used + cost > self.soft_cap:
            raise BudgetExceeded(
                f"This call would cost {cost} credits, taking the month to "
                f"{self.used + cost} against a soft cap of {self.soft_cap}. "
                "Stopping. Raise ai.api_budget.soft_cap deliberately if you mean it."
            )

    # -- transport ---------------------------------------------------------

    def _get(self, path: str, params: dict, record: CallRecord):
        self._check_budget(record.estimated_cost)
        if self.dry_run:
            record.http_status = 0
            self.spent_this_run += record.estimated_cost
            self.calls.append(record)
            return None

        params = {**params, "apiKey": self.api_key}
        for attempt in range(5):
            resp = requests.get(f"{BASE}{path}", params=params, timeout=self.timeout)
            if resp.status_code == 429:
                # Burst protection, distinct from the credit quota. The docs
                # give no numeric limit, only "try spacing out requests over
                # several seconds", so back off and retry rather than fail.
                time.sleep(2 ** attempt)
                continue
            break

        record.http_status = resp.status_code
        record.reported_cost = _int_header(resp, "x-requests-last")
        record.reported_remaining = _int_header(resp, "x-requests-remaining")
        record.reported_used = _int_header(resp, "x-requests-used")
        # Charge what the provider says, falling back to our estimate.
        self.spent_this_run += (record.reported_cost
                                if record.reported_cost is not None
                                else record.estimated_cost)
        self.calls.append(record)

        if resp.status_code == 401:
            raise SystemExit("The Odds API rejected the key (401).")
        if resp.status_code == 422:
            raise SystemExit(f"Invalid request (422): {resp.text[:300]}")
        resp.raise_for_status()

        time.sleep(self.sleep_between)
        payload = resp.json()
        record.rows_returned = len(payload if isinstance(payload, list)
                                   else payload.get("data", []))
        return payload

    # -- endpoints ---------------------------------------------------------

    def list_events(self, sport_key: str):
        """Free. Use it liberally: this is how fixtures get their event ids."""
        rec = CallRecord("events", 0, sport_key=sport_key)
        return self._get(f"/sports/{sport_key}/events", {}, rec) or []

    def event_markets(self, sport_key: str, event_id: str, regions=("uk",)):
        """1 credit. The only reliable way to learn what a league actually has."""
        rec = CallRecord("event_markets", 1, sport_key=sport_key, event_id=event_id,
                         regions=list(regions))
        return self._get(f"/sports/{sport_key}/events/{event_id}/markets",
                         {"regions": ",".join(regions)}, rec)

    def odds(self, sport_key: str, markets=("h2h",), regions=None, bookmakers=None,
             odds_format: str = "decimal"):
        cost = estimate_cost("odds", markets, regions, bookmakers)
        rec = CallRecord("odds", cost, sport_key=sport_key, markets=list(markets),
                         regions=list(regions) if regions else None,
                         bookmakers=list(bookmakers) if bookmakers else None)
        params = {"markets": ",".join(markets), "oddsFormat": odds_format}
        params.update({"bookmakers": ",".join(bookmakers)} if bookmakers
                      else {"regions": ",".join(regions or ["uk"])})
        return self._get(f"/sports/{sport_key}/odds", params, rec) or []

    def historical_odds(self, sport_key: str, date: str, markets=("h2h",),
                        regions=None, bookmakers=None, odds_format: str = "decimal"):
        cost = estimate_cost("odds", markets, regions, bookmakers, historical=True)
        rec = CallRecord("historical_odds", cost, sport_key=sport_key,
                         markets=list(markets),
                         regions=list(regions) if regions else None,
                         bookmakers=list(bookmakers) if bookmakers else None,
                         snapshot_date=date, is_historical=True)
        params = {"date": date, "markets": ",".join(markets), "oddsFormat": odds_format}
        params.update({"bookmakers": ",".join(bookmakers)} if bookmakers
                      else {"regions": ",".join(regions or ["uk"])})
        return self._get(f"/historical/sports/{sport_key}/odds", params, rec)

    def historical_events(self, sport_key: str, date: str):
        rec = CallRecord("historical_events", 1, sport_key=sport_key,
                         snapshot_date=date, is_historical=True)
        return self._get(f"/historical/sports/{sport_key}/events",
                         {"date": date}, rec)

    def historical_event_odds(self, sport_key: str, event_id: str, date: str,
                              markets=("btts",), regions=None, bookmakers=None,
                              odds_format: str = "decimal"):
        cost = estimate_cost("odds", markets, regions, bookmakers, historical=True)
        rec = CallRecord("historical_event_odds", cost, sport_key=sport_key,
                         event_id=event_id, markets=list(markets),
                         regions=list(regions) if regions else None,
                         bookmakers=list(bookmakers) if bookmakers else None,
                         snapshot_date=date, is_historical=True)
        params = {"date": date, "markets": ",".join(markets), "oddsFormat": odds_format}
        params.update({"bookmakers": ",".join(bookmakers)} if bookmakers
                      else {"regions": ",".join(regions or ["uk"])})
        return self._get(
            f"/historical/sports/{sport_key}/events/{event_id}/odds", params, rec)


def _int_header(resp, name: str) -> int | None:
    try:
        return int(resp.headers[name])
    except (KeyError, TypeError, ValueError):
        return None


def flatten_odds(payload) -> list[dict]:
    """API response -> one row per (event, bookmaker, market, outcome)."""
    events = payload.get("data", payload) if isinstance(payload, dict) else payload
    snapshot = payload.get("timestamp") if isinstance(payload, dict) else None
    rows = []
    for ev in events or []:
        for bk in ev.get("bookmakers") or []:
            for mk in bk.get("markets") or []:
                for oc in mk.get("outcomes") or []:
                    rows.append({
                        "event_id": ev["id"],
                        "sport_key": ev.get("sport_key"),
                        "commence_time": ev.get("commence_time"),
                        "home_team": ev.get("home_team"),
                        "away_team": ev.get("away_team"),
                        "bookmaker": bk["key"],
                        "bookmaker_title": bk.get("title"),
                        "last_update": mk.get("last_update") or bk.get("last_update"),
                        "market": mk["key"],
                        "outcome": oc["name"],
                        "price": oc["price"],
                        "point": oc.get("point"),
                        "description": oc.get("description"),
                        "snapshot_timestamp": snapshot,
                    })
    return rows
