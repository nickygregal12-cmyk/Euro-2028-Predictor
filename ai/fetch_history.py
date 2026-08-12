"""Import historical results from Football-Data.co.uk into ai.raw_matches.

Run once to backfill, then weekly to pick up the current season.

    python fetch_history.py --league EPL
    python fetch_history.py --league SPL --seasons 2425 2526

Two things this does that are easy to skip and expensive to skip:

1. It imports the tier below the top flight as well. A club promoted in May has
   no top-flight matches in August; without its Championship season its early
   features are empty and the model treats it as average, which it is not.

2. It de-vigs and stores the closing bookmaker probabilities. Those are not a
   feature — using them as one just teaches the model to copy the market. They
   are the benchmark. A football model that does not beat a coin flip is
   obvious; a football model that does not beat the closing line is the normal
   case, and you want to know which one you have.
"""
from __future__ import annotations

import argparse
import io
import sys
from datetime import datetime

import pandas as pd
import requests

from aliases import canonical_for
from config import (AH_MARKET_COLUMNS, ALL_DIVISIONS, FOOTBALL_DATA_URL,
                    LEAGUES, ODDS_COLUMNS, OU_MARKET_COLUMNS, SEASONS,
                    current_season)
from db import job, upsert_historical_market_prices, upsert_raw_matches

def _parse_date(value):
    """Football-Data writes dd/mm/yyyy, but older files use dd/mm/yy."""
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def _cols(df: pd.DataFrame, names) -> pd.DataFrame | None:
    if names is None or not all(c in df.columns for c in names):
        return None
    out = df[list(names)].apply(pd.to_numeric, errors="coerce")
    out.columns = ["h", "d", "a"]
    return out


def _book_odds(df: pd.DataFrame) -> dict[str, pd.DataFrame | None]:
    """Extract every book we care about, pre-match and closing, separately.

    Kept apart rather than collapsed into one "market probability" because the
    gap between the best price and the average price IS most of what an
    apparent edge turns out to be. Collapse them and you can never tell whether
    the model found something or you merely shopped well.
    """
    out: dict[str, pd.DataFrame | None] = {}
    for code, spec in ODDS_COLUMNS.items():
        pre = _cols(df, spec["pre"])
        if pre is None:
            pre = _cols(df, spec.get("fallback_pre"))
        out[f"{code}_pre"] = pre
        out[f"{code}_close"] = _cols(df, spec["close"])
    return out


def _devig_multiplicative(o: pd.DataFrame) -> pd.DataFrame:
    """Normalise 1/odds so the three sum to one.

    Only used here to populate the legacy mkt_*_prob columns. The betting layer
    re-derives fair probabilities from the stored raw odds with Shin's method,
    which handles favourite-longshot bias properly; storing a de-vigged number
    and throwing away the price would remove that option permanently.
    """
    inv = 1.0 / o
    total = inv.sum(axis=1)
    usable = total.notna() & (total > 0)
    return pd.DataFrame({
        "h": (inv["h"] / total).where(usable),
        "d": (inv["d"] / total).where(usable),
        "a": (inv["a"] / total).where(usable),
    })


def _free_market_prices(rec: pd.Series) -> list[dict]:
    """Extract every free O/U 2.5 and AH price present on one history row."""
    out = []
    for code, cols in OU_MARKET_COLUMNS.items():
        if not all(c in rec.index for c in cols):
            continue
        vals = [_safe_float(rec.get(c)) for c in cols]
        if any(v is None for v in vals):
            continue
        out.extend([
            {"market": "OU", "line": 2.5, "selection": "Over",
             "bookmaker": code, "odds": vals[0]},
            {"market": "OU", "line": 2.5, "selection": "Under",
             "bookmaker": code, "odds": vals[1]},
        ])
    line = _safe_float(rec.get("AHh"))
    if line is not None:
        for code, cols in AH_MARKET_COLUMNS.items():
            if not all(c in rec.index for c in cols):
                continue
            vals = [_safe_float(rec.get(c)) for c in cols]
            if any(v is None for v in vals):
                continue
            out.extend([
                {"market": "AH", "line": line, "selection": "Home",
                 "bookmaker": code, "odds": vals[0]},
                {"market": "AH", "line": line, "selection": "Away",
                 "bookmaker": code, "odds": vals[1]},
            ])
    return out


def fetch_one(division: str, season: str, timeout: int = 60) -> list[dict]:
    url = FOOTBALL_DATA_URL.format(season=season, division=division)
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": "ai-lab/0.1"})
    if resp.status_code == 404:
        print(f"  {division} {season}: not published, skipping")
        return []
    resp.raise_for_status()

    # These files are Latin-1 and contain trailing blank columns.
    df = pd.read_csv(io.BytesIO(resp.content), encoding="latin-1",
                     on_bad_lines="skip", low_memory=False)
    df = df.dropna(how="all", axis=1)
    required = {"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"}
    if not required.issubset(df.columns):
        print(f"  {division} {season}: unexpected columns, skipping")
        return []

    df = df.dropna(subset=["HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"])
    books = _book_odds(df)

    # The benchmark probability: closing market average where it exists
    # (2019/20 onward), otherwise Pinnacle closing (back to 2012/13).
    bench = books.get("AVG_close")
    if bench is None or bench.isna().all().all():
        bench = books.get("PS_close")
    fair = _devig_multiplicative(bench) if bench is not None else None

    rows: list[dict] = []
    for i, rec in enumerate(df.itertuples(index=False)):
        source_rec = df.iloc[i]
        match_date = _parse_date(getattr(rec, "Date"))
        if match_date is None:
            continue
        result = str(getattr(rec, "FTR")).strip().upper()
        if result not in ("H", "D", "A"):
            continue
        row = {
            "source": "football-data.co.uk",
            "division": division,
            "season": season,
            "match_date": match_date,
            "home_canonical": canonical_for(str(getattr(rec, "HomeTeam")).strip()),
            "away_canonical": canonical_for(str(getattr(rec, "AwayTeam")).strip()),
            "home_goals": int(getattr(rec, "FTHG")),
            "away_goals": int(getattr(rec, "FTAG")),
            "result": result,
            "home_shots": _safe_int(getattr(rec, "HS", None)),
            "away_shots": _safe_int(getattr(rec, "AS", None)),
            "home_shots_ot": _safe_int(getattr(rec, "HST", None)),
            "away_shots_ot": _safe_int(getattr(rec, "AST", None)),
            "home_corners": _safe_int(getattr(rec, "HC", None)),
            "away_corners": _safe_int(getattr(rec, "AC", None)),
            "ht_home_goals": _safe_int(getattr(rec, "HTHG", None)),
            "ht_away_goals": _safe_int(getattr(rec, "HTAG", None)),
            # Red cards are free in this file and they matter. A 4-0 defeat
            # that began with an eighth-minute dismissal is not evidence that
            # a team is bad at eleven-a-side football, and a form window that
            # cannot tell the difference is carrying avoidable noise.
            "home_reds": _safe_int(getattr(rec, "HR", None)),
            "away_reds": _safe_int(getattr(rec, "AR", None)),
            "home_yellows": _safe_int(getattr(rec, "HY", None)),
            "away_yellows": _safe_int(getattr(rec, "AY", None)),
            "home_fouls": _safe_int(getattr(rec, "HF", None)),
            "away_fouls": _safe_int(getattr(rec, "AF", None)),
            "referee": _safe_text(getattr(rec, "Referee", None)),
            "_market_prices": _free_market_prices(source_rec),
        }
        for code in ("avg", "max", "ps", "bfe"):
            pre = books.get(f"{code.upper()}_pre")
            close = books.get(f"{code.upper()}_close")
            for leg in ("h", "d", "a"):
                row[f"odds_{code}_{leg}"] = (
                    _safe_float(pre[leg].iloc[i]) if pre is not None else None)
                if code in ("avg", "max", "ps"):
                    row[f"close_{code}_{leg}"] = (
                        _safe_float(close[leg].iloc[i]) if close is not None else None)

        for name, frame in (("overround_avg", books.get("AVG_pre")),
                            ("overround_max", books.get("MAX_pre"))):
            if frame is None:
                row[name] = None
            else:
                inv = (1.0 / frame.iloc[i]).sum()
                row[name] = _safe_float(inv)

        if fair is not None:
            row["mkt_home_prob"] = _safe_float(fair["h"].iloc[i])
            row["mkt_draw_prob"] = _safe_float(fair["d"].iloc[i])
            row["mkt_away_prob"] = _safe_float(fair["a"].iloc[i])
        else:
            row["mkt_home_prob"] = row["mkt_draw_prob"] = row["mkt_away_prob"] = None

        rows.append(row)
    print(f"  {division} {season}: {len(rows)} matches")
    return rows


def _safe_int(v):
    try:
        if v is None or pd.isna(v):
            return None
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _safe_text(v):
    try:
        if v is None or pd.isna(v):
            return None
        text = str(v).strip()
        return text or None
    except (TypeError, ValueError):
        return None


def _safe_float(v):
    try:
        if v is None or pd.isna(v):
            return None
        return round(float(v), 5)
    except (TypeError, ValueError):
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    target = ap.add_mutually_exclusive_group(required=True)
    target.add_argument("--league", choices=sorted(LEAGUES))
    target.add_argument("--all-divisions", action="store_true",
                        help="Fetch each of the nine source divisions exactly once.")
    ap.add_argument("--seasons", nargs="*", default=list(SEASONS),
                    help="Football-Data season codes, or the word 'current' "
                         "for whichever season today falls in.")
    args = ap.parse_args()

    args.seasons = [current_season() if s == "current" else s
                    for s in args.seasons]
    divisions = ALL_DIVISIONS if args.all_divisions else LEAGUES[args.league].divisions
    with job("import_history", args.league) as state:
        total = price_total = 0
        for division in divisions:
            for season in args.seasons:
                rows = fetch_one(division, season)
                total += upsert_raw_matches(rows)
                price_total += upsert_historical_market_prices(rows)
        state["rows"] = total
        state["detail"] = {"divisions": list(divisions), "seasons": args.seasons,
                           "historical_market_prices": price_total}
    print(f"imported/updated {total} matches for "
          f"{'all divisions' if args.all_divisions else args.league}; "
          f"{price_total} free O/U or AH price rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
