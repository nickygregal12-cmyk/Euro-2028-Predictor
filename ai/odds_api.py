"""The Odds API workflows: probe, plan, backfill, live.

    python odds_api.py probe                      # ~5 credits, do this first
    python odds_api.py plan --preset btts-el2     # costs nothing, run it always
    python odds_api.py backfill --preset btts-el2 --confirm
    python odds_api.py live

`plan` prints the exact credit cost of a backfill and refuses to be skipped:
`backfill` will not run without `--confirm`, and it stops the moment the
period's soft cap is in sight.

THE ALLOWANCE IS MEASURED, NOT ASSUMED. This module was written around a
500-credit free tier with 450 reserved as a soft cap, and that number survived
into the code, into the documentation and into `ai.api_budget` long after it
stopped being true: Production's own retained response headers report `used 20,
remaining 19,980`, which is a 20,000-credit period. A cap set an order of
magnitude below the real allowance is not conservative, it silently refuses the
collection the budget was supposed to permit.

So the allowance comes from the provider, through headers already retained on
past successful calls — `ai.reconcile_api_budget` reads `reported_used +
reported_remaining` off the newest one and never makes a request to find out.
`budget_state` surfaces any disagreement between what is configured and what
the provider last said, rather than trusting either silently.

A larger allowance is not permission to spend it. `ai/oddsapi.py` decides WHEN
to call; the cadence work in contract 146 is what stops a live target polling
288 times a day at a fixture eleven days away. This module only decides whether
there is room.
"""
from __future__ import annotations

import argparse
import sys

import oddsapi as api
from aliases import canonical_from_odds_api
from db import connect, job, query_df

# ---------------------------------------------------------------------------
# Backfill presets
#
# Each is a concrete, costed hypothesis rather than "get all the data". At this
# budget you get to test roughly one idea a month, so the preset is the unit of
# decision.
# ---------------------------------------------------------------------------

PRESETS = {
    # The recommended first spend. One league, one market, one season, one
    # snapshot per event: enough to answer "does the model find anything in
    # BTTS in League Two?" for about a third of one month's quota. If the
    # answer is no, you have learned it for ten pounds of API time. If yes,
    # widen deliberately.
    "btts-el2-start": {
        "why": "START HERE. Both teams to score, League Two, one season, one "
               "snapshot per event. The softest market in the cheapest league, "
               "sized to fit comfortably inside a single month.",
        "leagues": ["EL2"],
        "markets": ["btts"],
        "per_event": True,
        "seasons": ["2526"],
        "snapshots_per_event": 1,
        "bookmakers": list(api.SHARP_BOOKMAKERS),
    },
    # A genuine closing line for one league-season. Worth it only because
    # Football-Data gives you a single post-hoc closing figure and this gives
    # the price path, which is what tells you how fast your edge decays.
    "closing-lines-el2": {
        "why": "Price path for League Two, one season: h2h and totals sampled "
               "four times per matchday. Shows how much of an early edge "
               "survives to the close.",
        "leagues": ["EL2"],
        "markets": ["h2h", "totals"],
        "per_event": False,
        "seasons": ["2526"],
        "snapshots_per_matchday": 4,
        "bookmakers": list(api.SHARP_BOOKMAKERS),
    },
    "btts-el2": {
        "why": "Both teams to score in League Two: the softest market in the "
               "cheapest league. If there is an edge anywhere, the prior says here.",
        "leagues": ["EL2"],
        "markets": ["btts"],
        "per_event": True,
        "seasons": ["2324", "2425", "2526"],
        "snapshots_per_event": 2,        # one early, one at the close
        "bookmakers": list(api.SHARP_BOOKMAKERS),
    },
    "btts-lower-england": {
        "why": "The same test across League One and League Two.",
        "leagues": ["EL1", "EL2"],
        "markets": ["btts"],
        "per_event": True,
        "seasons": ["2425", "2526"],
        "snapshots_per_event": 2,
        "bookmakers": list(api.SHARP_BOOKMAKERS),
    },
    "closing-lines": {
        "why": "A genuine closing line for h2h and totals, taken minutes before "
               "kickoff. Football-Data's closing columns are good but are a "
               "single post-hoc figure; this gives the actual price path.",
        "leagues": ["EPL", "ECH", "EL1", "EL2", "SPL"],
        "markets": ["h2h", "totals"],
        "per_event": False,              # all-events endpoint: far cheaper
        "seasons": ["2526"],
        "snapshots_per_matchday": 4,     # the usual Sat kickoff slots
        "bookmakers": list(api.SHARP_BOOKMAKERS),
    },
    "derivatives-epl": {
        "why": "Correct score and half-time/full-time in the Premier League. "
               "Expensive, and the market with the worst margin — included so "
               "the planner can show you why not to.",
        "leagues": ["EPL"],
        "markets": ["btts", "correct_score", "halftime_fulltime"],
        "per_event": True,
        "seasons": ["2425", "2526"],
        "snapshots_per_event": 1,
        "bookmakers": list(api.SHARP_BOOKMAKERS),
    },
}

# Matches per season by league, for the estimate.
MATCHES_PER_SEASON = {"EPL": 380, "ECH": 552, "EL1": 552, "EL2": 552, "SPL": 228}
MATCHDAYS_PER_SEASON = 120


# No hard-coded plan. This is the shape of an EMPTY answer — a lab with no
# budget row has no allowance at all, which is the correct fail-closed state
# and is nothing like "assume 500".
NO_BUDGET = (0, 0, 0)


def budget_state(verbose: bool = False) -> tuple[int, int, int]:
    """(allowance, soft cap, used this period), from the configured budget.

    Returns (0, 0, 0) when no budget row exists, which refuses every call. The
    previous fallback of `(500, 450, 0)` was a guess that outlived the plan it
    described and let a misconfigured lab spend against a number nobody had
    checked.
    """
    df = query_df(
        "select monthly_credits, soft_cap, "
        "       ai.credits_used_this_month(provider) as used, "
        "       observed_period_credits, observed_used, observed_remaining, "
        "       observed_at "
        "from ai.api_budget where provider = 'the-odds-api'")
    if df.empty:
        print("REFUSING ALL COLLECTION: no ai.api_budget row for the-odds-api.")
        return NO_BUDGET
    r = df.iloc[0]
    configured = int(r["monthly_credits"])
    observed = r.get("observed_period_credits")
    if observed is not None and int(observed) != configured:
        # Surfaced every time rather than only on request: this disagreement is
        # exactly what hid a 20,000-credit plan behind a 500-credit cap.
        print(f"WARNING - the provider last reported an allowance of "
              f"{int(observed):,} credits (used {r['observed_used']} + "
              f"remaining {r['observed_remaining']}, observed "
              f"{r['observed_at']}), while ai.api_budget is configured at "
              f"{configured:,}. Run `python odds_api.py budget --apply` to "
              f"reconcile; it makes no provider request.")
    if verbose:
        print(f"budget: {int(r['used']):,}/{int(r['soft_cap']):,} used this "
              f"period, allowance {configured:,}")
    return configured, int(r["soft_cap"]), int(r["used"])


def reconcile_budget(apply: bool = False) -> dict:
    """Reconcile the configured allowance against the provider's own headers.

    Costs nothing. Every number it reads is already retained in `ai.api_usage`
    from calls that were already paid for, which is the point: rediscovering a
    quota by making a request would spend a credit to learn how many credits
    there are.
    """
    df = query_df("select ai.reconcile_api_budget(%s, %s) as report",
                  ("the-odds-api", apply))
    return {} if df.empty else df.iloc[0]["report"]


# ---------------------------------------------------------------------------
# plan
# ---------------------------------------------------------------------------

def plan(preset_name: str) -> dict:
    p = PRESETS[preset_name]
    units = api.region_units(bookmakers=p.get("bookmakers"))
    n_markets = len(p["markets"])
    per_call = 10 * n_markets * units

    total = 0
    lines = []
    for lg in p["leagues"]:
        n_seasons = len(p["seasons"])
        if p["per_event"]:
            events = MATCHES_PER_SEASON[lg] * n_seasons
            calls = events * p["snapshots_per_event"]
            # Each snapshot date also needs the historical events list, 1 credit.
            list_calls = MATCHDAYS_PER_SEASON * n_seasons
            cost = calls * per_call + list_calls
            lines.append(f"  {lg:4} {events:>5} events x {p['snapshots_per_event']} "
                         f"snapshots x {per_call} = {calls * per_call:>7,} "
                         f"(+{list_calls:,} for event lists)")
        else:
            calls = MATCHDAYS_PER_SEASON * n_seasons * p.get("snapshots_per_matchday", 1)
            cost = calls * per_call
            lines.append(f"  {lg:4} {calls:>5} whole-sport snapshots x {per_call} "
                         f"= {cost:>7,}")
        total += cost

    monthly, soft_cap, used = budget_state()
    return {"preset": preset_name, "why": p["why"], "total": total, "lines": lines,
            "per_call": per_call, "units": units, "monthly": monthly,
            "soft_cap": soft_cap, "used": used,
            "months": total / max(soft_cap, 1)}


def print_plan(pl: dict) -> None:
    print(f"\n{pl['preset']}")
    print(f"  {pl['why']}\n")
    for line in pl["lines"]:
        print(line)
    print(f"\n  billed as {pl['units']} region-unit(s); {pl['per_call']} credits per "
          f"historical call")
    print(f"  TOTAL {pl['total']:,} credits")
    print(f"  budget: {pl['used']:,} used this month, soft cap {pl['soft_cap']:,}, "
          f"allowance {pl['monthly']:,} per period")
    if pl["months"] <= 1:
        print(f"  -> FITS: {pl['total'] / pl['soft_cap']:.0%} of this month's cap")
    else:
        print(f"  -> DOES NOT FIT: {pl['months']:.1f} months of your entire quota. "
              "Narrow it — fewer seasons, one league, or one market.")


# ---------------------------------------------------------------------------
# probe — what does each league ACTUALLY have?
# ---------------------------------------------------------------------------

def probe(client: api.OddsApiClient) -> list[dict]:
    """One free event listing plus one 1-credit market probe per league.

    The provider publishes no coverage matrix, and its own note says additional
    markets are "currently limited to US sports and selected bookmakers". Five
    credits answers definitively whether btts and correct_score exist for League
    Two before a backfill spends sixteen thousand finding out.
    """
    found = []
    for league_key, sport in api.SPORT_KEYS.items():
        events = client.list_events(sport)          # free
        if not events:
            print(f"  {league_key:4} {sport:28} no events listed right now")
            continue
        ev = events[0]
        payload = client.event_markets(sport, ev["id"])
        books = (payload or {}).get("bookmakers", [])
        for bk in books:
            for mk in bk.get("markets", []):
                found.append({"sport_key": sport, "bookmaker": bk["key"],
                              "market_key": mk["key"], "probe_event": ev["id"]})
        markets = sorted({m["key"] for bk in books for m in bk.get("markets", [])})
        print(f"  {league_key:4} {sport:28} {len(books):>2} books, "
              f"{len(markets)} markets: {', '.join(markets) or '(none)'}")
    return found


def store_probe(rows: list[dict]) -> int:
    if not rows:
        return 0
    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "insert into ai.odds_api_coverage "
                "(sport_key, bookmaker, market_key, probe_event) values (%s,%s,%s,%s) "
                "on conflict (sport_key, bookmaker, market_key) "
                "do update set last_seen_at = now()",
                [(r["sport_key"], r["bookmaker"], r["market_key"], r["probe_event"])
                 for r in rows])
        conn.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# live
# ---------------------------------------------------------------------------

def live(client: api.OddsApiClient, markets, bookmakers) -> int:
    written = 0
    for league_key, sport in api.SPORT_KEYS.items():
        payload = client.odds(sport, markets=markets, bookmakers=bookmakers)
        rows = api.flatten_odds(payload)
        written += store_prices(rows, league_key)
        print(f"  {league_key:4} {len(rows):>4} price rows")
    return written


def store_prices(rows: list[dict], league_key: str) -> int:
    """Records the events, resolves them to ai.fixtures, then stores prices.

    An event that cannot be resolved to a fixture is recorded with
    matched_by='unmatched' and its prices are NOT stored. A price attached to
    the wrong match is worse than a missing price, and the admin status RPC
    surfaces the unmatched names so the alias table can be extended.
    """
    if not rows:
        return 0
    events = {}
    for r in rows:
        events[r["event_id"]] = r
    with connect() as conn:
        with conn.cursor() as cur:
            for eid, r in events.items():
                h, how_h = canonical_from_odds_api(r["home_team"])
                a, how_a = canonical_from_odds_api(r["away_team"])
                matched = "alias" if (h and a) else "unmatched"
                cur.execute(
                    """
                    insert into ai.odds_api_events
                      (event_id, sport_key, commence_time, home_team, away_team,
                       home_canonical, away_canonical, matched_by, fixture_id)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,
                            (select f.id from ai.fixtures f
                              where f.home_canonical = %s and f.away_canonical = %s
                                and f.match_date between (%s::timestamptz - interval '2 days')::date
                                                     and (%s::timestamptz + interval '2 days')::date
                              order by abs(extract(epoch from
                                     (coalesce(f.kickoff_at, f.match_date::timestamptz)
                                      - %s::timestamptz)))
                              limit 1))
                    on conflict (event_id) do update set
                      -- Identity is REFRESHED, not preserved. This clause used
                      -- to set only `fixture_id` and `matched_by`, so an event
                      -- first retained under a wrong canonical name stayed
                      -- wrong for ever, no matter how correct the alias table
                      -- later became. That is exactly what happened to
                      -- fifty-two Production events: `aliases.py` mapped
                      -- Leicester City correctly the whole time and nothing
                      -- ever re-derived the stored value.
                      sport_key      = excluded.sport_key,
                      commence_time  = excluded.commence_time,
                      home_team      = excluded.home_team,
                      away_team      = excluded.away_team,
                      home_canonical = excluded.home_canonical,
                      away_canonical = excluded.away_canonical,
                      -- A corrected identity RELINKS to the corrected fixture.
                      -- `coalesce(old, new)` pinned the event to whatever it
                      -- first resolved to and made the correction invisible to
                      -- every price, prediction and bet downstream.
                      fixture_id = case
                        when ai.odds_api_events.home_canonical
                               is distinct from excluded.home_canonical
                          or ai.odds_api_events.away_canonical
                               is distinct from excluded.away_canonical
                        then excluded.fixture_id
                        else coalesce(ai.odds_api_events.fixture_id,
                                      excluded.fixture_id)
                      end,
                      matched_by = excluded.matched_by
                    """,
                    (eid, r["sport_key"], r["commence_time"], r["home_team"],
                     r["away_team"], h, a, matched,
                     h, a, r["commence_time"], r["commence_time"], r["commence_time"]))
        conn.commit()

    written = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(
                    """
                    insert into ai.market_prices
                      (fixture_id, market, line, selection, bookmaker, odds,
                       captured_at, source)
                    select e.fixture_id, %s, %s, %s, %s, %s,
                           coalesce(%s::timestamptz, now()), 'the-odds-api'
                      from ai.odds_api_events e
                     where e.event_id = %s and e.fixture_id is not null
                    on conflict do nothing
                    """,
                    (_market_code(r["market"]), r.get("point"), r["outcome"],
                     _bookmaker_code(r["bookmaker"]), r["price"],
                     r.get("snapshot_timestamp") or r.get("last_update"), r["event_id"]))
                written += cur.rowcount
        conn.commit()
    return written


_MARKET_MAP = {"h2h": "1X2", "totals": "OU", "spreads": "AH", "btts": "BTTS",
               "correct_score": "CS", "double_chance": "DC", "draw_no_bet": "DNB",
               "team_totals": "TT", "halftime_fulltime": "HTFT",
               "alternate_totals_corners": "CORN", "alternate_totals_cards": "CARDS"}


def _market_code(key: str) -> str:
    return _MARKET_MAP.get(key, key.upper()[:12])


def _bookmaker_code(key: str) -> str:
    return {"pinnacle": "PS", "betfair_ex_uk": "BFE", "smarkets": "SMK",
            "matchbook": "MTB"}.get(key, key.upper()[:16])


# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe")
    pl = sub.add_parser("plan")
    pl.add_argument("--preset", choices=sorted(PRESETS))
    bf = sub.add_parser("backfill")
    bf.add_argument("--preset", choices=sorted(PRESETS), required=True)
    bf.add_argument("--confirm", action="store_true")
    bg = sub.add_parser("budget")
    bg.add_argument("--apply", action="store_true",
                    help="Write the measured allowance and its soft cap back "
                         "to ai.api_budget. Without it, the disagreement is "
                         "reported and nothing changes.")
    lv = sub.add_parser("live")
    lv.add_argument("--markets", nargs="*", default=["h2h", "totals"])
    args = ap.parse_args()

    monthly, soft_cap, used = budget_state()

    if args.cmd == "plan":
        names = [args.preset] if args.preset else sorted(PRESETS)
        plans = [plan(n) for n in names]
        for pl_ in sorted(plans, key=lambda x: x["total"]):
            print_plan(pl_)
        fits = [p for p in plans if p["months"] <= 1]
        print(f"\n{len(fits)} of {len(plans)} presets fit inside one month at "
              f"{plans[0]['soft_cap']:,} credits.")
        print("Nothing above has been spent. `plan` costs no credits.")
        return 0

    if args.cmd == "budget":
        report = reconcile_budget(args.apply)
        for key in sorted(report or {}):
            print(f"  {key}: {report[key]}")
        if not report:
            print("  no budget row for the-odds-api")
        print("\nNo provider request was made.")
        return 0

    if args.cmd == "backfill":
        if monthly < 20000:
            print("REFUSING: historical odds are not included in The Odds API "
                  "free tier. Live collection remains enabled; upgrade and "
                  "raise ai.api_budget deliberately before backfilling.")
            return 1
        pl_ = plan(args.preset)
        print_plan(pl_)
        if pl_["total"] > (soft_cap - used):
            print(f"\nREFUSING: this preset needs {pl_['total']:,} credits and only "
                  f"{soft_cap - used:,} remain under the soft cap this month.")
            return 1
        if not args.confirm:
            print("\nRe-run with --confirm to spend these credits.")
            return 0
        print("\nBackfill execution is intentionally not wired up in this scaffold; "
              "run `probe` first and confirm the markets exist for your leagues, "
              "then implement the loop against ai.odds_api_snapshots for resumability.")
        return 0

    client = api.OddsApiClient(soft_cap=soft_cap, already_used_this_month=used)

    if args.cmd == "probe":
        with job("odds_api_probe") as state:
            print(f"budget: {used:,}/{soft_cap:,} used this period\n")
            rows = probe(client)
            n = store_probe(rows)
            record_usage(client)
            state["rows"] = n
            print(f"\nrecorded {n} (league, bookmaker, market) combinations; "
                  f"spent {client.spent_this_run} credits")
        return 0

    if args.cmd == "live":
        with job("odds_api_live") as state:
            written = live(client, args.markets, list(api.SHARP_BOOKMAKERS))
            record_usage(client)
            state["rows"] = written
            print(f"\nstored {written} prices; spent {client.spent_this_run} credits "
                  f"({client.remaining:,} left under the cap)")
            # Free: the response we just paid for carries the authoritative
            # allowance in its headers, so read it rather than assume it.
            reconcile_budget(apply=False)
        return 0
    return 0


def record_usage(client: api.OddsApiClient) -> None:
    if not client.calls:
        return
    cols = ["endpoint", "sport_key", "event_id", "markets", "regions", "bookmakers",
            "snapshot_date", "is_historical", "estimated_cost", "reported_cost",
            "reported_remaining", "reported_used", "http_status", "rows_returned"]
    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                f"insert into ai.api_usage ({','.join(cols)}) "
                f"values ({','.join(['%s'] * len(cols))})",
                [tuple(getattr(c, k) for k in cols) for c in client.calls])
        conn.commit()


if __name__ == "__main__":
    sys.exit(main())
