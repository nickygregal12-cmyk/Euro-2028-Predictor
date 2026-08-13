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


def read_only() -> bool:
    """Whether this process may write to the database at all.

    Set by the research execution path, which runs the paired studies against a
    hosted database to READ forty-six thousand historical matches and must
    leave every row exactly as it found it.

    It is enforced in `db.connect` by opening the session with
    `default_transaction_read_only=on`, so an insert raises
    `read_only_sql_transaction` from PostgreSQL rather than depending on every
    caller having remembered to withhold a `--record` flag. That is a guard
    against a mistake, not against a determined caller: the GUC is settable by
    any role, so code that deliberately turned it off could still write. The
    mistake is the thing that actually happens, and this catches it.
    """
    return os.environ.get("AI_READ_ONLY", "").strip().lower() in {"1", "true", "yes", "on"}


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

FIRST_SEASON = "1213"
FIRST_SEASON_WITH_MAXAVG_CLOSING = "1920"


def current_season(today: date | None = None) -> str:
    """Return the Football-Data code for the season `today` falls in.

    Football-Data's competition year runs July to June, the same boundary
    `season_date_bounds` uses, so 1 July is the changeover both ways.

    This is derived rather than listed because the daily import is the only
    thing that ever brings a NEW result into the lab, and a hard-coded code
    fails silently rather than loudly: the finished season's file still
    returns HTTP 200, the import still reports a healthy row count and
    `ai.job_runs` still records success, while no fixture is ever graded and
    no bet is ever settled again.
    """
    day = today or date.today()
    start_year = day.year if day.month >= 7 else day.year - 1
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def seasons_from(first: str, today: date | None = None) -> tuple[str, ...]:
    """Every Football-Data season code from `first` to the current one."""
    start = season_date_bounds(first)[0].year
    end = season_date_bounds(current_season(today))[0].year
    return tuple(f"{y % 100:02d}{(y + 1) % 100:02d}"
                 for y in range(start, end + 1))


# Seasons to import, oldest first.
#
# Two thresholds worth knowing, established by reading the actual CSV headers:
#   - Max/Avg CLOSING columns (MaxCH, AvgCH...) start at 2019/20.
#   - Pinnacle closing (PSCH/PSCD/PSCA) goes back to 2012/13.
# A closing-line backtest is therefore 7 seasons deep on market average, or
# 14 seasons deep if you accept Pinnacle as the benchmark. For the smaller
# divisions, where sample size is the binding constraint, take the Pinnacle
# series: more data beats a marginally better benchmark.
#
# A season not yet published is not an error: `fetch_history` treats the 404
# as "not published, skipping", so extending to the current season on 1 July
# costs nothing until the first file appears.
#
# Assigned below `season_date_bounds`, which both helpers read for the century
# rule rather than repeating it.

FOOTBALL_DATA_URL = "https://www.football-data.co.uk/mmz4281/{season}/{division}.csv"
FOOTBALL_DATA_FIXTURES_URL = "https://www.football-data.co.uk/fixtures.csv"

UTF8_BOM = b"\xef\xbb\xbf"


def strip_bom(content: bytes) -> bytes:
    """Remove a UTF-8 byte-order mark before the CSV is decoded as Latin-1.

    Football-Data's files are Latin-1, and `fixtures.csv` is served with a
    UTF-8 BOM in front of it. Decoding those three bytes as Latin-1 turns them
    into the characters `ï»¿`, which become part of the FIRST column's name —
    so `Div` arrives as `ï»¿Div` and every lookup of `Div` fails.

    Measured on hosted Development on 13 August 2026: the bootstrap imported
    46,215 matches and then died on the fixture sync, and the columns it
    reported were `['ï»¿Div', 'Date', 'Time', ...]`. Only the first column is
    affected, which is why the season files were unharmed — nothing reads
    their first column, because the division is passed in rather than read.

    Stripped from the bytes rather than patched in the column names, so the
    frame never carries a name that depends on which encoding was guessed.
    """
    return content[len(UTF8_BOM):] if content.startswith(UTF8_BOM) else content

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


SEASONS: tuple[str, ...] = seasons_from(FIRST_SEASON)
SEASONS_WITH_MAXAVG_CLOSING: tuple[str, ...] = seasons_from(
    FIRST_SEASON_WITH_MAXAVG_CLOSING)

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
