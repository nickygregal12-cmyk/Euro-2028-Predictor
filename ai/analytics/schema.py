"""The analytical snapshot schema.

DuckDB is the *offline* analytical layer. It is not, and must never become,
the application database: Supabase/Postgres remains the production authority
for fixtures, results, scoring, standings and every player-facing fact. What
lands here is a read-only export taken from controlled snapshots.

    provider/archive data
            v
    Supabase / controlled exports
            v
    CSV / Parquet analytical snapshots
            v
    DuckDB          <- you are here
            v
    AI Lab research / backtesting / analysis

Column types are stated rather than inferred. CSV type inference is a moving
answer that depends on which rows happen to be sampled: a column of integers
with one null becomes a float on one export and an integer on the next, and a
probability column that arrives as VARCHAR fails silently in arithmetic. Every
table below therefore declares its own columns, and a snapshot whose header
disagrees is rejected at load rather than at conclusion time.

NULL means *not available* and is preserved as NULL throughout. Nothing here
may coalesce an absent figure to zero: "no closing price was captured" and
"the closing line value was 0.0" are different claims, and only one of them is
evidence.
"""
from __future__ import annotations

# DuckDB column types, keyed by snapshot table. The order is the CSV column
# order; `read_csv` is given this map so a reordered or renamed export fails
# loudly instead of loading into the wrong columns.
SNAPSHOT_TABLES: dict[str, dict[str, str]] = {
    # One row per fixture the lab knows about. `home_goals`/`away_goals` are
    # NULL until a result exists — they are never 0-0 placeholders.
    "fixtures": {
        "fixture_id": "VARCHAR",
        "league": "VARCHAR",
        "season": "VARCHAR",
        "kickoff_utc": "TIMESTAMP",
        "home_team": "VARCHAR",
        "away_team": "VARCHAR",
        "home_goals": "INTEGER",
        "away_goals": "INTEGER",
        "status": "VARCHAR",
    },
    # One row per trained model version.
    "models": {
        "model_id": "VARCHAR",
        "league": "VARCHAR",
        "family": "VARCHAR",
        "version": "VARCHAR",
        "status": "VARCHAR",
    },
    # One row per model forecast of one fixture.
    "forecasts": {
        "forecast_id": "VARCHAR",
        "fixture_id": "VARCHAR",
        "model_id": "VARCHAR",
        "prob_home": "DOUBLE",
        "prob_draw": "DOUBLE",
        "prob_away": "DOUBLE",
        "created_at": "TIMESTAMP",
    },
    # Bookmaker prices. `phase` is 'prematch' or 'closing'; a fixture may have
    # neither, and that absence is itself a finding rather than a gap to fill.
    "market_prices": {
        "fixture_id": "VARCHAR",
        "bookmaker": "VARCHAR",
        "selection": "VARCHAR",
        "price": "DOUBLE",
        "captured_at": "TIMESTAMP",
        "phase": "VARCHAR",
    },
    # The value engine's decision for a forecast: BET, or a PASS reason.
    "recommendations": {
        "recommendation_id": "VARCHAR",
        "forecast_id": "VARCHAR",
        "decision": "VARCHAR",
        "reason_code": "VARCHAR",
        "selection": "VARCHAR",
        "edge": "DOUBLE",
        "price": "DOUBLE",
        "stake_units": "DOUBLE",
    },
    # Settlement of an advised bet. Every column after the key is NULL while
    # the bet is unsettled, and `clv` stays NULL when no valid closing
    # benchmark was ever captured.
    "bet_settlements": {
        "recommendation_id": "VARCHAR",
        "outcome": "VARCHAR",
        "profit_units": "DOUBLE",
        "closing_price": "DOUBLE",
        "clv": "DOUBLE",
    },
}

# Selections the 1X2 market uses, in the order the forecast columns follow.
SELECTIONS = ("home", "draw", "away")


def columns_clause(table: str) -> str:
    """The `columns=` struct `read_csv` is given for one snapshot table.

    Built from `SNAPSHOT_TABLES`, which is a constant in this file, so the
    interpolation carries no external input.
    """
    columns = SNAPSHOT_TABLES[table]
    entries = ", ".join(f"'{name}': '{type_}'" for name, type_ in columns.items())
    return "{" + entries + "}"
