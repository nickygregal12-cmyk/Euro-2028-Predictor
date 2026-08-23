// NAMED HOSTILE SCENARIOS FOR THE DEVELOPMENT SEED.
//
// `docs/design-system.md` binds every page to be reviewed against worst-case
// realistic data, and NAMES the cases: 20+ members, longest plausible names,
// tied scores, the user mid-table, non-submitters. The seed already met the
// first, second and fourth. It could not express the other two at all, nor the
// 1-entry and 2-entry pools the same document requires of the "Only you" surface.
//
// So these scenarios exist to GUARANTEE a state, not to make one likely. A seed
// that ties by luck cannot be used to review a tie-break, because the next run
// may not tie.
//
// Pure and dependency-free, like the generator it decorates — data in, data out,
// no clock and no database. Choosing a scenario decides WHAT is seeded; it can
// never affect WHERE, which stays `seedPolicy.ts`'s fail-closed decision alone.
//
// Nothing here re-implements scoring. The tie is created by CONSTRUCTION — two
// entries holding identical predictions must score identically, whatever the
// rules say — and the test then verifies it through the real pipeline.

import type { Fixture } from './fixture'
import type { GeneratedEntry, SeedData } from './generate'
import { scoreEntries } from './scoreEntries'

export type ScenarioName = 'standard' | 'contested' | 'sparse'

export type Scenario = {
  readonly name: ScenarioName
  /** One line, printed by the dry run so the operator knows what they asked for. */
  readonly summary: string
  /**
   * Pools to create BESIDE the populated league, by member count. A one-member
   * and a two-member pool are the sizes at which a leaderboard stops meaning
   * anything, which is exactly why the design rule asks for them.
   */
  readonly extraPoolSizes: readonly number[]
}

export const SCENARIOS: Record<ScenarioName, Scenario> = {
  standard: {
    name: 'standard',
    summary: 'The populated mid-tournament. Every entry submitted, one league.',
    extraPoolSizes: [],
  },
  contested: {
    name: 'contested',
    summary: 'Two players level at the top, so a tie-break has something to resolve.',
    extraPoolSizes: [],
  },
  sparse: {
    name: 'sparse',
    summary: 'Non-submitters, and pools of one and two members.',
    extraPoolSizes: [1, 2],
  },
}

export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[]

export function isScenarioName(value: string): value is ScenarioName {
  return Object.prototype.hasOwnProperty.call(SCENARIOS, value)
}

/** Every seventh entry never submits: enough to review the state, never so many
 *  that the tournament reads as empty rather than as partly entered. */
const UNSUBMITTED_EVERY = 7

function copyPredictions(from: GeneratedEntry, onto: GeneratedEntry): GeneratedEntry {
  // Deep copies, so the two entries stay independent objects that merely happen
  // to agree — a later mutation of one must not silently move the other.
  return {
    ...onto,
    groupMatches: from.groupMatches.map((match) => ({ ...match })),
    groupOrders: from.groupOrders.map((group) => ({ ...group, order: [...group.order] })),
    progression: from.progression.map((step) => ({ ...step })),
    totalGoals: from.totalGoals,
  }
}

/**
 * Give the leader a twin. The best-scoring entry's predictions are copied onto
 * the worst-scoring one, which necessarily lifts it to exactly the leader's
 * total — the tie is arithmetic, not a tuned number that a scoring change could
 * silently break.
 *
 * The WORST entry is chosen deliberately: it is the one whose own points nobody
 * is relying on, so the scenario costs the rest of the table nothing.
 */
function contested(fixture: Fixture, data: SeedData): SeedData {
  const scored = scoreEntries(fixture, data)
  if (scored.length < 2) return data

  let leader = 0
  let challenger = 0
  for (let index = 1; index < scored.length; index++) {
    // Strict comparisons keep the FIRST extreme, so the choice is stable.
    const total = scored[index]?.total ?? 0
    if (total > (scored[leader]?.total ?? 0)) leader = index
    if (total < (scored[challenger]?.total ?? 0)) challenger = index
  }
  if (leader === challenger) return data

  const from = data.entries[leader]
  const onto = data.entries[challenger]
  if (from === undefined || onto === undefined) return data

  const entries = data.entries.slice()
  entries[challenger] = copyPredictions(from, onto)
  return { ...data, entries }
}

/** Leave some entries drafted but never submitted. They keep their full 36
 *  predictions: a non-submitter is a real player who did not press the button,
 *  not an empty row. */
function sparse(data: SeedData): SeedData {
  return {
    ...data,
    entries: data.entries.map((entry, index) =>
      index % UNSUBMITTED_EVERY === UNSUBMITTED_EVERY - 1 ? { ...entry, submitted: false } : entry,
    ),
  }
}

/** Apply a named scenario's guarantees to freshly generated seed data. */
export function applyScenario(
  fixture: Fixture,
  data: SeedData,
  scenario: ScenarioName,
): SeedData {
  switch (scenario) {
    case 'contested':
      return contested(fixture, data)
    case 'sparse':
      return sparse(data)
    case 'standard':
      return data
  }
}

const SCENARIO_FLAG = '--scenario='

/**
 * Read the scenario from a command line. Absent means `standard`, so every
 * existing invocation keeps its current behaviour. An unrecognised name REFUSES
 * rather than falling back — a typo that silently seeded the ordinary world
 * would be discovered only by a reviewer wondering why the state they asked for
 * is not there.
 */
export function readScenario(argv: readonly string[]): ScenarioName {
  const flag = argv.find((argument) => argument.startsWith(SCENARIO_FLAG))
  if (flag === undefined) return 'standard'

  const value = flag.slice(SCENARIO_FLAG.length)
  if (!isScenarioName(value)) {
    throw new Error(
      `Unknown seed scenario "${value}". Available: ${SCENARIO_NAMES.join(', ')}.`,
    )
  }
  return value
}

/**
 * The entries a leaderboard will actually show.
 *
 * The database ranks from `entries` where `submitted_at is not null` — in
 * `get_leaderboard`, in scoring, in rank history and in the match centre. So a
 * dry run that ranked EVERY generated entry would promise the operator a table
 * the seeded app then refuses to render, which defeats the point of a dry run
 * that exists to prove the seed consistent before anything is written.
 */
export function submittedOnly(data: SeedData): SeedData {
  return { ...data, entries: data.entries.filter((entry) => entry.submitted) }
}
