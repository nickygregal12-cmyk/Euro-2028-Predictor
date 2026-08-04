from pathlib import Path
import json


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(before, after)


seed_path = Path("e2e/seed-contract.ts")
seed = seed_path.read_text()
seed = replace_once(
    seed,
    """ * Contract 103 makes a competition instance repeatable: `bonus_competitions`
 * gains lineage columns and a `completion_reason`, all defaulted or nullable so
 * every existing row keeps its meaning, and `unique (tournament_id, game_key)`
 * becomes a partial unique index over LIVE instances only. With no competition
 * completed in development or production — verified read-only — the partial
 * index permits nothing the constraint forbade, so it is equivalent today.
 * One live function was redefined WITH the contract rather than after it:
 * `ensure_original_predictor_availability` upserts on that pair from the
 * tournaments trigger, and a bare ON CONFLICT target cannot infer a partial
 * index — the exact failure that stopped seeding in CI on the first draft. Its
 * conflict target now names the index predicate, so seeding a tournament works
 * identically before and after. Nothing in it can create a second instance:
 * the restart lifecycle is a later contract.
""",
    """ * Contract 103 makes a competition instance repeatable: `bonus_competitions`
 * gains explicit public/private scope, series lineage and a bounded completion
 * reason. Every existing row backfills as public and as sequence 1 of its own
 * series. The old total key becomes one live PUBLIC row per season game plus one
 * live row per series, so independent private competitions may coexist without
 * making the public catalogue ambiguous. No competition is completed in either
 * hosted project and no lifecycle driver exists yet, so every seeded read still
 * resolves the same public row. The tournament trigger and catalogue writer now
 * name the exact public/live conflict predicate; bare recreation starts a new
 * series through an internal-only trigger helper. Contract 104 migrates the
 * measured readers, and contract 105 supplies the restart driver.
""",
    "seed contract 103 explanation",
)
seed_path.write_text(seed)


contract_path = Path("config/deployment-contract.json")
contract = json.loads(contract_path.read_text())
contract["notes"] = (
    "Tagged repository baseline euro-2028-baseline remains contract 63. "
    "Contracts 64–100 establish the multi-competition season foundations, domestic game engines, "
    "Cup-neutral sources, provider custody and the two tournament-path corrections. Contract 101 "
    "removes obsolete shared-league gating from Euro post-lock reveal without widening pre-lock "
    "access. Contract 102 persists the Predictor Championship split as a distinct phase. Contract "
    "103 reconciles game availability with repeatable competition instances: one live public row "
    "per season game, one live row per independent series, public/private coexistence, scoped "
    "predecessor lineage and bounded completion reasons. Hosted deployment remains separately "
    "guarded and is not claimed by this repository contract."
)
contract_path.write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n")


guard_path = Path("tests/database-parity/liveCompetitionConflictTargets.test.ts")
guard = guard_path.read_text()
guard = replace_once(
    guard,
    """ * THE DEFECT CLASS THIS FILE EXISTS FOR. Contract 103 replaced
 * `unique (tournament_id, game_key)` with a PARTIAL unique index over live
 * instances (`where completed_at is null`). A bare
 * `on conflict (tournament_id, game_key)` cannot infer a partial index, so
""",
    """ * THE DEFECT CLASS THIS FILE EXISTS FOR. Contract 103 replaced
 * `unique (tournament_id, game_key)` with a PARTIAL unique index over the live
 * public instance (`where visibility_kind = 'public' and completed_at is null`).
 * A bare or incomplete `on conflict (tournament_id, game_key)` cannot infer it, so
""",
    "conflict guard authority comment",
)
guard_path.write_text(guard)
