"""Walk the whole provider identity chain back into agreement. No API calls.

    python repair_identity.py                 # report only
    python repair_identity.py --apply         # repair, and quarantine
    python repair_identity.py --apply --quarantine-only

WHY THIS EXISTS, measured rather than argued. On 13 August 2026 Production held
fifty-one live predictions. Thirty-seven carried at least one club with zero
matched history; sixteen carried two; eleven exceeded 90% headline probability
and six exceeded 99%. The worst of them read:

    Notts County 99.659% / draw 0.327% / Leicester City 0.014%
    expected goals 6.00 - 0.05, predicted score 6-0

Leicester's complete 2025/26 Championship season was in `ai.raw_matches` the
whole time, under the canonical name `Leicester`. `ai/aliases.py` has mapped
`Leicester City -> Leicester` since the alias table was written. Neither was
ever consulted on the hosted path: the `provider-poll` Edge Function
canonicalises through its own twelve-entry literal, complete for the Premier
League and empty below it, and `record_ai_odds_snapshot` trusted whatever the
decoder sent. This was therefore an integration and custody defect rather than
missing alias knowledge, and patching Leicester by hand would have left Norwich
City, West Bromwich Albion, Swansea City, Blackburn Rovers, Sheffield
Wednesday, Queens Park Rangers and the rest exactly as broken.

WHAT IT REPAIRS, in order, each step idempotent:

    raw provider event name
      -> ai.canonical_from_odds_api  (the single authority, contract 188)
      -> ai.odds_api_events canonical identity
      -> canonical ai.fixtures
      -> event fixture_id
      -> ai.market_prices fixture_id      (repointed: this is EVIDENCE)
      -> ai.fixture_odds                  (rebuilt: this is DERIVED)
      -> ai.predictions                   (quarantined, never edited)

ZERO PROVIDER REQUESTS. Every input is a row already retained. The raw team
names in `ai.odds_api_events.home_team` / `away_team` have always been correct;
only the canonical column derived from them was wrong.
"""
from __future__ import annotations

import argparse
import sys

from aliases import canonical_for_fixture
from db import connect, job


def _one(conn, sql: str, params=()):
    row = conn.execute(sql, params).fetchone()
    return None if row is None else list(row.values())[0]


def retire_fixture_feed_phantoms(conn, apply: bool) -> dict:
    """Retire a scheduled fixture the FIXTURES FEED minted beside a real one.

    A different doorway from the one `ai.repair_provider_identity` walks, and it
    has to be a different function because the knowledge lives in a different
    place. That repair reads `ai.odds_api_events` and resolves through
    `ai.canonical_from_odds_api`, which is mirrored in SQL. The fixtures file is
    a fourth vocabulary with no SQL counterpart -- `ai.canonical_from_odds_api`
    answers `unmatched` for `Sheffield Wed` -- so the resolution has to happen
    here, in Python, where `canonical_for_fixture` knows it.

    MEASURED, so the shape is not hypothetical. Production on 19 August 2026 held
    `Sheffield Weds v Bradford` from 16 August with four forecasts, a decision,
    two paper bets and 169 price rows -- and, from 18 August, a second scheduled
    row for the same match called `Sheffield Wed v Bradford City` with no
    forecast, no bet and 24 price rows. The match was covered the whole time. The
    feed had simply minted a twin, which inflated the fixture inventory and put
    two dozen real prices on a row nothing reads.

    The rules match the repair this sits beside, for the same reasons:

      market_prices are REPOINTED, never rewritten -- they are the retained
      provider observation and belong to the match, not to the row.

      fixture_odds are DELETED where they carry the phantom's club names, being
      a derived projection that `reconcile_paid_fixture_evidence` rebuilds.

      the phantom is VOIDED, never deleted, because `void` is already the state
      every value path filters out and deleting would break a reference.

    A phantom carrying forecasts or bets is REPORTED AND LEFT ALONE. Voiding one
    would silently move betting evidence, which is the quarantine mechanism's job
    and not something a tidy-up should do on its way past.
    """
    candidates = conn.execute(
        """
        select id, division, match_date, kickoff_at,
               home_canonical, away_canonical
          from ai.fixtures
         where status = 'scheduled'
        """).fetchall()

    by_key: dict[tuple, str] = {}
    for row in candidates:
        by_key[(row["division"], row["match_date"],
                row["home_canonical"], row["away_canonical"])] = row["id"]

    retired, skipped, prices, derived = [], [], 0, 0
    for row in candidates:
        home = canonical_for_fixture(row["home_canonical"])
        away = canonical_for_fixture(row["away_canonical"])
        if home == row["home_canonical"] and away == row["away_canonical"]:
            continue                      # already canonical; the common case
        twin = by_key.get((row["division"], row["match_date"], home, away))
        if twin is None or twin == row["id"]:
            # No real fixture to fold into. Renaming this one in place is a
            # different and riskier operation than retiring a duplicate, so it
            # is reported rather than guessed at.
            skipped.append({"fixture_id": row["id"], "reason": "no canonical twin",
                            "stored": f"{row['home_canonical']} v {row['away_canonical']}",
                            "resolves_to": f"{home} v {away}"})
            continue

        held = conn.execute(
            """
            select (select count(*) from ai.predictions p where p.fixture_id = %s) as forecasts,
                   (select count(*) from ai.bets b where b.fixture_id = %s) as bets
            """, (row["id"], row["id"])).fetchone()
        if held["forecasts"] or held["bets"]:
            skipped.append({"fixture_id": row["id"], "reason": "carries evidence",
                            "forecasts": held["forecasts"], "bets": held["bets"]})
            continue

        entry = {"fixture_id": row["id"], "twin_id": twin,
                 "stored": f"{row['home_canonical']} v {row['away_canonical']}",
                 "resolves_to": f"{home} v {away}",
                 "kickoff_at": str(row["kickoff_at"])}
        if apply:
            conn.execute("update ai.market_prices set fixture_id = %s where fixture_id = %s",
                         (twin, row["id"]))
            prices += conn.execute(
                "select count(*) as n from ai.market_prices where fixture_id = %s",
                (twin,)).fetchone()["n"]
            conn.execute("delete from ai.fixture_odds where fixture_id = %s", (row["id"],))
            derived += 1
            conn.execute(
                "update ai.fixtures set status = 'void', updated_at = now() where id = %s",
                (row["id"],))
        retired.append(entry)

    if apply and retired:
        conn.commit()
    return {"retired": retired, "skipped": skipped,
            "market_prices_repointed_onto_twin": prices,
            "fixture_odds_cleared": derived, "applied": bool(apply)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Write the repair. Without it nothing changes and the "
                         "quarantine candidates are listed.")
    ap.add_argument("--quarantine-only", action="store_true",
                    help="Skip the identity repair and only quarantine "
                         "predictions already built on a broken one.")
    ap.add_argument("--horizon-days", type=int, default=400)
    ap.add_argument("--reason", default="INVALID_TEAM_IDENTITY",
                    choices=["INVALID_TEAM_IDENTITY", "HISTORY_ALIAS_MISMATCH",
                             "IDENTITY_REPAIR_SUPERSEDED"])
    args = ap.parse_args()

    with job("repair_provider_identity") as state:
        detail: dict = {"provider_requests_made": 0}

        with connect() as conn:
            before = conn.execute(
                """
                select count(*) as events,
                       count(*) filter (where e.home_canonical is distinct from
                         (select c.canonical from ai.canonical_from_odds_api(e.home_team) c)
                         or e.away_canonical is distinct from
                         (select c.canonical from ai.canonical_from_odds_api(e.away_team) c))
                         as disagreeing
                  from ai.odds_api_events e
                """).fetchone()
            detail["events_before"] = int(before["events"])
            detail["events_disagreeing_with_authority"] = int(before["disagreeing"])
            print(f"{before['events']} retained events; "
                  f"{before['disagreeing']} disagree with the alias authority")

            if not args.quarantine_only:
                if args.apply:
                    report = _one(
                        conn,
                        "select ai.repair_provider_identity("
                        "  make_interval(days => %s)) as report",
                        (args.horizon_days,))
                    conn.commit()
                    detail["repair"] = report
                    print("\nrepair:")
                    for key in sorted(report):
                        print(f"  {key}: {report[key]}")
                else:
                    print("\n--apply not given: no identity was rewritten.")

            # Quarantine runs against the CURRENT state, so with --apply it
            # sees the repaired identity and quarantines exactly the
            # predictions that were built before it.
            quarantine = _one(
                conn,
                "select ai.quarantine_identity_defective_predictions(%s, %s) as report",
                (args.reason, not args.apply))
            if args.apply:
                conn.commit()
            detail["quarantine"] = {k: v for k, v in quarantine.items()
                                    if k != "predictions"}
            matched = quarantine["matched"]
            print(f"\nquarantine ({'applied' if args.apply else 'dry run'}): "
                  f"{matched} prediction(s)")
            for row in quarantine["predictions"][:40]:
                print(f"  {row['league']:4} {row['home_canonical']} v "
                      f"{row['away_canonical']}  "
                      f"(known {row['home_known']}/{row['away_known']}; "
                      f"resolves to {row['home_resolves_to']} / "
                      f"{row['away_resolves_to']})")

            # The fixtures-file doorway. Runs after the quarantine so it sees
            # the settled state, and independently of --quarantine-only because
            # retiring a duplicate is not a quarantine.
            phantoms = retire_fixture_feed_phantoms(conn, args.apply)
            detail["fixture_feed_phantoms"] = phantoms
            print(f"\nfixture-feed phantoms "
                  f"({'applied' if args.apply else 'dry run'}): "
                  f"{len(phantoms['retired'])} retired, "
                  f"{len(phantoms['skipped'])} left alone")
            for row in phantoms["retired"][:20]:
                print(f"  {row['stored']}  ->  folded into {row['resolves_to']}")
            for row in phantoms["skipped"][:20]:
                print(f"  LEFT: {row.get('stored', row['fixture_id'])} "
                      f"({row['reason']})")

            after = conn.execute(
                """
                select count(*) filter (where e.home_canonical is distinct from
                         (select c.canonical from ai.canonical_from_odds_api(e.home_team) c)
                         or e.away_canonical is distinct from
                         (select c.canonical from ai.canonical_from_odds_api(e.away_team) c))
                         as disagreeing,
                       count(*) filter (where e.fixture_id is null) as unlinked
                  from ai.odds_api_events e
                """).fetchone()
            detail["events_disagreeing_after"] = int(after["disagreeing"])
            detail["events_unlinked_after"] = int(after["unlinked"])

        state["rows"] = int(matched)
        state["detail"] = detail
        print(f"\nidentity disagreements: "
              f"{detail['events_disagreeing_with_authority']} -> "
              f"{detail['events_disagreeing_after']}")
        print("provider requests made: 0")
        if not args.apply:
            print("\nNothing was written. Re-run with --apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
