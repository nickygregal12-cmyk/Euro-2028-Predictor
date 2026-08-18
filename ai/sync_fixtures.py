"""Populate ai.fixtures for all nine divisions, and settle the ones that finished.

    python sync_fixtures.py

This is the table that makes the nine-division architecture real. Predictions,
odds and bets all hang off ai.fixtures, so a Scottish League Two match needs
nothing from public.season_fixtures — which is just as well, because it isn't
there and never will be.

Where a fixture DOES correspond to a competition this platform runs (Premier
League, Scottish Premiership), the link is recorded as a convenience: it lets
the admin pages join through, and it lets settlement prefer an operator-
confirmed result over a provider's.
"""
from __future__ import annotations

import argparse
import io
import sys
from datetime import date, datetime, timezone

import pandas as pd
import requests

from aliases import LIVE_CLUBS, canonical_for
from config import (ALL_DIVISIONS, FOOTBALL_DATA_FIXTURES_URL, LEAGUES,
                    strip_bom)
from db import job, query_df, settle_fixtures_from_history, upsert_fixtures

DIVISION_TO_LEAGUE = {lg.top_division: key for key, lg in LEAGUES.items()}
PLATFORM_TO_CANONICAL = {platform: canon for platform, canon, _, _ in LIVE_CLUBS}


def season_code(when: date) -> str:
    start = when.year if when.month >= 7 else when.year - 1
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def _parse_date(value):
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def _parse_kickoff(when: date, time_value) -> datetime | None:
    if time_value is None or (isinstance(time_value, float) and pd.isna(time_value)):
        return None
    try:
        hh, mm = str(time_value).strip().split(":")[:2]
        # Football-Data publishes UK local time. During BST that is UTC+1, and
        # treating it as UTC would put a 15:00 kick-off an hour early -- enough
        # to make a pre-kickoff bet look late, or a late one look valid.
        naive = datetime(when.year, when.month, when.day, int(hh), int(mm))
        try:
            from zoneinfo import ZoneInfo
            return naive.replace(tzinfo=ZoneInfo("Europe/London")).astimezone(timezone.utc)
        except Exception:
            return naive.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def platform_fixture_links() -> dict[tuple[str, str, date], str]:
    """(canonical home, canonical away, date) -> public.season_fixtures.id."""
    df = query_df(
        """
        select sf.id, ht.name as home_name, at.name as away_name,
               (sf.kickoff_at at time zone 'Europe/London')::date as match_date
          from public.season_fixtures sf
          join public.teams ht on ht.id = sf.home_team_id
          join public.teams at on at.id = sf.away_team_id
         where sf.kickoff_at > now() - interval '2 days'
        """
    )
    out = {}
    if df.empty:
        return out
    for rec in df.itertuples(index=False):
        h = PLATFORM_TO_CANONICAL.get(rec.home_name)
        a = PLATFORM_TO_CANONICAL.get(rec.away_name)
        if h and a:
            out[(h, a, rec.match_date)] = str(rec.id)
    return out


def fetch(divisions=ALL_DIVISIONS, timeout: int = 60) -> list[dict]:
    resp = requests.get(FOOTBALL_DATA_FIXTURES_URL, timeout=timeout,
                        headers={"User-Agent": "ai-lab/0.1"})
    resp.raise_for_status()
    df = pd.read_csv(io.BytesIO(strip_bom(resp.content)), encoding="latin-1",
                     on_bad_lines="skip", low_memory=False)
    if df.empty:
        # A fixtures.csv with a header and no rows is Football-Data's ordinary
        # state between rounds and before a season starts — it is not an
        # error, and it must not be one, or the Tuesday and Friday jobs go red
        # on quiet weeks until nobody reads them.
        #
        # Without this guard it crashes rather than reporting: `dropna(how=
        # 'all', axis=1)` below drops EVERY column of a row-less frame, since
        # each one is vacuously all-NaN, and the `Div` lookup then fails. That
        # is a latent bug rather than the one observed — the hosted failure of
        # 13 August 2026 was the UTF-8 BOM `strip_bom` now removes, on a file
        # that had rows all along.
        print("  fixtures.csv has no rows yet; nothing to sync")
        return []
    df = df.dropna(how="all", axis=1)
    missing = {"Div", "Date", "HomeTeam", "AwayTeam"} - set(df.columns)
    if missing:
        raise SystemExit(
            f"fixtures.csv is missing {sorted(missing)}; "
            f"columns present: {list(df.columns)[:20]}")
    df = df[df["Div"].isin(divisions)]

    links = platform_fixture_links()
    rows = []
    for rec in df.itertuples(index=False):
        when = _parse_date(getattr(rec, "Date"))
        if when is None:
            continue
        division = str(getattr(rec, "Div")).strip()
        league_key = DIVISION_TO_LEAGUE.get(division)
        if league_key is None:
            continue
        home = canonical_for(str(getattr(rec, "HomeTeam")).strip())
        away = canonical_for(str(getattr(rec, "AwayTeam")).strip())
        rows.append({
            "division": division,
            "season": season_code(when),
            "league_key": league_key,
            "match_date": when,
            "kickoff_at": _parse_kickoff(when, getattr(rec, "Time", None)),
            "home_canonical": home,
            "away_canonical": away,
            "season_fixture_id": links.get((home, away, when)),
        })
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--divisions", nargs="*", default=list(ALL_DIVISIONS))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with job("sync_fixtures") as state:
        rows = fetch(args.divisions)
        by_div: dict[str, int] = {}
        linked = 0
        for r in rows:
            by_div[r["division"]] = by_div.get(r["division"], 0) + 1
            linked += r["season_fixture_id"] is not None
        for div, n in sorted(by_div.items()):
            print(f"  {div:4} {n:>4} upcoming")
        print(f"  {linked} of {len(rows)} linked to public.season_fixtures "
              f"(the rest need no such link)")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            return 0

        written = upsert_fixtures(rows)
        settled = settle_fixtures_from_history()
        state["rows"] = written
        state["detail"] = {"divisions": by_div, "linked": linked, "settled": settled}
        print(f"\nupserted {written} fixtures; settled {settled} from results already held")
    return 0


if __name__ == "__main__":
    sys.exit(main())
