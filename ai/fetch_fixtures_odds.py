"""Pull prices for upcoming fixtures from Football-Data's free fixtures feed.

    python fetch_fixtures_odds.py

One HTTP GET, no key, no rate limit, and it covers all nine divisions you care
about — including the four that no cheap odds API reaches (National League,
Scottish Championship, League One and League Two).

Know what this feed is before you build on it. From football-data.co.uk's own
notes: weekend odds are collected on **Friday afternoons, not later than 17:00
UK**, and midweek odds on **Tuesdays not later than 13:00 UK**. So it is a
twice-weekly snapshot, not a live feed and emphatically not a closing line.

That is a feature, not a limitation. Value, if you have any, lives in the gap
between an early price and the closing price. A Friday-afternoon snapshot is
roughly when a disciplined bettor would be acting anyway, and it gives you a
genuine "price I could have taken" to record against the closing line later.
What it cannot do is tell you the price ten minutes before kickoff — for that
you need the free Betfair delayed application key.
"""
from __future__ import annotations

import argparse
import io
import sys
from datetime import datetime, timezone

import pandas as pd
import requests

from aliases import canonical_for_fixture
from config import (AH_MARKET_COLUMNS, ALL_DIVISIONS,
                    FOOTBALL_DATA_FIXTURES_URL, ODDS_COLUMNS,
                    OU_MARKET_COLUMNS, strip_bom)
from db import connect, job

WANTED_BOOKS = ("AVG", "MAX", "BFE", "B365")


def _parse_date(value: str):
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def fetch(divisions=ALL_DIVISIONS, timeout: int = 60,
          include_markets: bool = False):
    resp = requests.get(FOOTBALL_DATA_FIXTURES_URL, timeout=timeout,
                        headers={"User-Agent": "ai-lab/0.1"})
    resp.raise_for_status()
    df = pd.read_csv(io.BytesIO(strip_bom(resp.content)), encoding="latin-1",
                     on_bad_lines="skip", low_memory=False)
    if df.empty:
        # No rows published yet. Not a shape change, and not a failure: see
        # the note in sync_fixtures.fetch. Reporting it as a changed shape
        # would send somebody looking for a schema break that never happened.
        print("  fixtures.csv has no rows yet; no prices to collect")
        return ([], []) if include_markets else []
    df = df.dropna(how="all", axis=1)
    if not {"Div", "Date", "HomeTeam", "AwayTeam"}.issubset(df.columns):
        raise SystemExit(f"fixtures.csv shape changed; columns: {list(df.columns)[:20]}")

    df = df[df["Div"].isin(divisions)]
    captured = datetime.now(timezone.utc)
    rows: list[dict] = []
    market_rows: list[dict] = []

    for i, rec in enumerate(df.itertuples(index=False)):
        source_rec = df.iloc[i]
        when = _parse_date(getattr(rec, "Date"))
        if when is None:
            continue
        base = {
            "division": str(getattr(rec, "Div")).strip(),
            "match_date": when,
            "home_canonical": canonical_for_fixture(str(getattr(rec, "HomeTeam")).strip()),
            "away_canonical": canonical_for_fixture(str(getattr(rec, "AwayTeam")).strip()),
            "captured_at": captured,
        }
        for code in WANTED_BOOKS:
            cols = ODDS_COLUMNS[code]["pre"]
            if not all(c in df.columns for c in cols):
                continue
            vals = [pd.to_numeric(source_rec.get(c), errors="coerce") for c in cols]
            if any(pd.isna(v) or v is None for v in vals):
                continue
            rows.append({**base, "bookmaker": code,
                         "odds_h": round(float(vals[0]), 3),
                         "odds_d": round(float(vals[1]), 3),
                         "odds_a": round(float(vals[2]), 3)})

        # The same free feed also carries O/U 2.5 and Asian-handicap prices.
        # Capture them now: unlike code, historical price data cannot be
        # reconstructed after the provider overwrites the weekly fixture file.
        for code, cols in OU_MARKET_COLUMNS.items():
            if not all(c in df.columns for c in cols):
                continue
            vals = [pd.to_numeric(source_rec.get(c), errors="coerce") for c in cols]
            if any(pd.isna(v) or v is None for v in vals):
                continue
            market_rows.extend([
                {**base, "market": "OU", "line": 2.5, "selection": "Over",
                 "bookmaker": code, "odds": round(float(vals[0]), 3)},
                {**base, "market": "OU", "line": 2.5, "selection": "Under",
                 "bookmaker": code, "odds": round(float(vals[1]), 3)},
            ])

        ah_line = pd.to_numeric(source_rec.get("AHh"), errors="coerce")
        if not pd.isna(ah_line):
            for code, cols in AH_MARKET_COLUMNS.items():
                if not all(c in df.columns for c in cols):
                    continue
                vals = [pd.to_numeric(source_rec.get(c), errors="coerce")
                        for c in cols]
                if any(pd.isna(v) or v is None for v in vals):
                    continue
                market_rows.extend([
                    {**base, "market": "AH", "line": round(float(ah_line), 2),
                     "selection": "Home", "bookmaker": code,
                     "odds": round(float(vals[0]), 3)},
                    {**base, "market": "AH", "line": round(float(ah_line), 2),
                     "selection": "Away", "bookmaker": code,
                     "odds": round(float(vals[1]), 3)},
                ])
    return (rows, market_rows) if include_markets else rows


def store(rows: list[dict]) -> int:
    if not rows:
        return 0
    cols = ["division", "match_date", "home_canonical", "away_canonical",
            "bookmaker", "odds_h", "odds_d", "odds_a", "captured_at"]
    # Resolve against the canonical fixture inside the INSERT.  Storing an
    # unlinked price is worse than failing: find_value intentionally works by
    # fixture_id, so an orphan row looks like a successful collection while it
    # is permanently invisible to the value job.
    sql = (
        f"insert into ai.fixture_odds (fixture_id,{','.join(cols)}) "
        "select f.id," + ",".join(["%s"] * len(cols)) + " "
        "from ai.fixtures f "
        "where f.division=%s and f.match_date=%s "
        "and f.home_canonical=%s and f.away_canonical=%s "
        "on conflict do nothing"
    )
    missing = []
    written = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                params = tuple(r[c] for c in cols) + (
                    r["division"], r["match_date"],
                    r["home_canonical"], r["away_canonical"],
                )
                cur.execute(sql, params)
                written += cur.rowcount
                if cur.rowcount == 0:
                    # A duplicate is safe; an unresolved fixture is not. Check
                    # which case this was before deciding whether to abort.
                    exists = cur.execute(
                        "select 1 from ai.fixtures where division=%s and match_date=%s "
                        "and home_canonical=%s and away_canonical=%s",
                        (r["division"], r["match_date"],
                         r["home_canonical"], r["away_canonical"]),
                    ).fetchone()
                    if exists is None:
                        missing.append(
                            f"{r['division']} {r['match_date']} "
                            f"{r['home_canonical']} v {r['away_canonical']}"
                        )
            if missing:
                raise RuntimeError(
                    "Odds feed contained fixtures not present in ai.fixtures; "
                    "run sync_fixtures.py and fix aliases before retrying: "
                    + "; ".join(sorted(set(missing))[:10])
                )
        conn.commit()
    return written


def store_market_prices(rows: list[dict]) -> int:
    """Store the free O/U and AH snapshots against canonical fixture ids."""
    if not rows:
        return 0
    sql = """
        insert into ai.market_prices
          (fixture_id,market,line,selection,bookmaker,odds,captured_at,source)
        select f.id,%s,%s,%s,%s,%s,%s,'football-data.co.uk/fixtures.csv'
          from ai.fixtures f
         where f.division=%s and f.match_date=%s
           and f.home_canonical=%s and f.away_canonical=%s
        on conflict do nothing
    """
    written = 0
    missing = []
    with connect() as conn:
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(sql, (
                    r["market"], r["line"], r["selection"], r["bookmaker"],
                    r["odds"], r["captured_at"], r["division"], r["match_date"],
                    r["home_canonical"], r["away_canonical"],
                ))
                written += cur.rowcount
                if cur.rowcount == 0:
                    exists = cur.execute(
                        "select 1 from ai.fixtures where division=%s and match_date=%s "
                        "and home_canonical=%s and away_canonical=%s",
                        (r["division"], r["match_date"],
                         r["home_canonical"], r["away_canonical"]),
                    ).fetchone()
                    if exists is None:
                        missing.append(
                            f"{r['division']} {r['match_date']} "
                            f"{r['home_canonical']} v {r['away_canonical']}"
                        )
            if missing:
                raise RuntimeError(
                    "Market prices could not resolve to ai.fixtures: "
                    + "; ".join(sorted(set(missing))[:10])
                )
        conn.commit()
    return written


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--divisions", nargs="*", default=list(ALL_DIVISIONS))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with job("fetch_fixture_odds") as state:
        rows, market_rows = fetch(args.divisions, include_markets=True)
        by_div: dict[str, int] = {}
        for r in rows:
            by_div[r["division"]] = by_div.get(r["division"], 0) + 1
        for div, n in sorted(by_div.items()):
            print(f"  {div:4} {n // len(WANTED_BOOKS):>4} fixtures priced")

        if args.dry_run:
            print(f"\n--dry-run: {len(rows)} price rows, nothing written")
            return 0

        written = store(rows)
        market_written = store_market_prices(market_rows)
        state["rows"] = written + market_written
        state["detail"] = {"divisions": by_div, "books": list(WANTED_BOOKS),
                           "market_prices": market_written}
        print(f"\nstored {written} 1X2 rows and {market_written} O/U or AH rows "
              f"across {len(by_div)} divisions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
