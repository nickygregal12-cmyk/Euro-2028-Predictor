"""Configuration: the nine divisions, and how they group into models."""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"
MODEL_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set. Copy .env.example to .env.")
    return url


@dataclass(frozen=True)
class League:
    """One modelling unit.

    `divisions` is everything imported so the model has history; `top_division`
    is the only one it trains and predicts on. The tier below is there because
    a promoted club has no top-flight form on the day it arrives, and a model
    that reads "no data" as "average" will price a promoted side like a
    mid-table one.

    `tournament_name` links to public.season_fixtures where this platform runs
    a live competition. Where it is None the league is modelled from
    Football-Data alone: useful for finding prices, not tied to your site.
    """

    key: str
    name: str
    divisions: tuple[str, ...]
    top_division: str
    teams: int
    tournament_name: str | None = None
    has_shot_stats: bool = True
    liquidity: str = "high"          # informal: how sharp the market is here


LEAGUES: dict[str, League] = {
    "EPL": League("EPL", "Premier League", ("E0", "E1"), "E0", 20,
                  "Premier League 2026/27", True, "very high"),
    "ECH": League("ECH", "Championship", ("E1", "E0", "E2"), "E1", 24,
                  None, True, "high"),
    "EL1": League("EL1", "League One", ("E2", "E1", "E3"), "E2", 24,
                  None, True, "medium"),
    "EL2": League("EL2", "League Two", ("E3", "E2", "EC"), "E3", 24,
                  None, True, "low"),
    # National League files carry rich odds but NO shots, corners or fouls.
    # Any feature built on shot data silently stops working here, so the flag
    # is checked rather than discovered.
    "ENL": League("ENL", "National League", ("EC", "E3"), "EC", 24,
                  None, False, "low"),
    "SPL": League("SPL", "Scottish Premiership", ("SC0", "SC1"), "SC0", 12,
                  "Scottish Premiership 2026/27", True, "medium"),
    "SCH": League("SCH", "Scottish Championship", ("SC1", "SC0", "SC2"), "SC1", 10,
                  None, True, "low"),
    "SL1": League("SL1", "Scottish League One", ("SC2", "SC1", "SC3"), "SC2", 10,
                  None, True, "very low"),
    "SL2": League("SL2", "Scottish League Two", ("SC3", "SC2"), "SC3", 10,
                  None, True, "very low"),
}

ALL_DIVISIONS = ("E0", "E1", "E2", "E3", "EC", "SC0", "SC1", "SC2", "SC3")

# Seasons to import, oldest first.
#
# Two thresholds worth knowing, established by reading the actual CSV headers:
#   - Max/Avg CLOSING columns (MaxCH, AvgCH...) start at 2019/20.
#   - Pinnacle closing (PSCH/PSCD/PSCA) goes back to 2012/13.
# A closing-line backtest is therefore 7 seasons deep on market average, or
# 14 seasons deep if you accept Pinnacle as the benchmark. For the smaller
# divisions, where sample size is the binding constraint, take the Pinnacle
# series: more data beats a marginally better benchmark.
SEASONS: tuple[str, ...] = (
    "1213", "1314", "1415", "1516", "1617", "1718", "1819",
    "1920", "2021", "2122", "2223", "2324", "2425", "2526", "2627",
)
SEASONS_WITH_MAXAVG_CLOSING = (
    "1920", "2021", "2122", "2223", "2324", "2425", "2526", "2627",
)

FOOTBALL_DATA_URL = "https://www.football-data.co.uk/mmz4281/{season}/{division}.csv"
FOOTBALL_DATA_FIXTURES_URL = "https://www.football-data.co.uk/fixtures.csv"

OUTCOMES = ("H", "D", "A")


def season_date_bounds(season: str) -> tuple[date, date]:
    """Return stable July-to-June bounds for a Football-Data season code.

    Training and live prediction must use the same denominator for
    ``season_progress``.  Deriving live bounds from the next ten days made a
    September fixture look anywhere from 0% to 100% through the season.  A
    fixed competition-year calendar is deliberately used for both historical
    and future fixtures, including seasons whose final fixture is not known
    yet.
    """
    text = str(season).strip()
    if len(text) != 4 or not text.isdigit():
        raise ValueError(f"Invalid Football-Data season code: {season!r}")
    start_two = int(text[:2])
    end_two = int(text[2:])
    century = 2000 if start_two < 80 else 1900
    start_year = century + start_two
    end_year = (century + end_two
                if end_two > start_two else century + 100 + end_two)
    if end_year != start_year + 1:
        raise ValueError(f"Non-consecutive Football-Data season code: {season!r}")
    return date(start_year, 7, 1), date(end_year, 6, 30)

# Bookmaker column families in the CSVs, mapped to the codes in ai.bookmakers.
# Order matters: the first present wins.
ODDS_COLUMNS = {
    "AVG": {"pre": ("AvgH", "AvgD", "AvgA"), "close": ("AvgCH", "AvgCD", "AvgCA"),
            "fallback_pre": ("BbAvH", "BbAvD", "BbAvA")},
    "MAX": {"pre": ("MaxH", "MaxD", "MaxA"), "close": ("MaxCH", "MaxCD", "MaxCA"),
            "fallback_pre": ("BbMxH", "BbMxD", "BbMxA")},
    "PS":  {"pre": ("PSH", "PSD", "PSA"),   "close": ("PSCH", "PSCD", "PSCA"),
            "fallback_pre": ("PH", "PD", "PA")},
    "BFE": {"pre": ("BFEH", "BFED", "BFEA"), "close": ("BFECH", "BFECD", "BFECA"),
            "fallback_pre": None},
    "B365": {"pre": ("B365H", "B365D", "B365A"), "close": ("B365CH", "B365CD", "B365CA"),
             "fallback_pre": None},
}

# Free Football-Data total-goals and Asian-handicap columns. These occur in
# both the weekly fixture feed and historical season files.
OU_MARKET_COLUMNS = {
    "B365": ("B365>2.5", "B365<2.5"),
    "MAX": ("Max>2.5", "Max<2.5"),
    "AVG": ("Avg>2.5", "Avg<2.5"),
}
AH_MARKET_COLUMNS = {
    "B365": ("B365AHH", "B365AHA"),
    "MAX": ("MaxAHH", "MaxAHA"),
    "AVG": ("AvgAHH", "AvgAHA"),
}
