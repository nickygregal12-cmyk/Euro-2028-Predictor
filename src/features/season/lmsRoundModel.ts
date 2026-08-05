/**
 * Presentation model for the season Last Man Standing round.
 *
 * THE ONE RULE THIS FILE MUST NOT BREAK: it never decides who survived.
 *
 * The read returns two different facts and it is tempting to collapse them.
 * `pickOutcome` is what the picked club DID — won, lost, drew, or its fixture
 * did not produce a standing result. `entryOutcome` is what the competition
 * says the PLAYER now is — active, survived, eliminated, champion. Only the
 * second is a survival verdict, and only the settlement job writes it.
 *
 * The gap between them is not pedantry. Whether a draw eliminates is a rule
 * with a stored parameter (the settlement replay folds a draws rule together
 * with lives and saves), so a browser that rendered "drew" as "eliminated"
 * would be inventing a rule it cannot see — and would be wrong in exactly the
 * seasons that configure it differently. So a drawn pick is reported as a draw
 * and nothing more, and elimination is shown only when the server has said so.
 *
 * WHAT IS PICKABLE IS ALSO NOT DECIDED HERE. A club is offered when it plays in
 * the round and the caller has not consumed it in their current cycle — both
 * facts the server supplies. The write refuses anything else regardless, and
 * ADR 0013's used-list reset means the cycle, not the full history, is the
 * list that matters.
 */

export type PickOutcome = 'won' | 'lost' | 'drew' | 'postponed'
export type EntryOutcome = 'active' | 'qualified' | 'survived' | 'eliminated' | 'champion'

export type LmsClub = {
  teamId: string
  name: string
  /** Consumed in the caller's current cycle, so not offered again until it resets. */
  used: boolean
}

export type LmsFixture = {
  fixtureId: string
  kickoffAt: string | null
  status: string
  home: LmsClub
  away: LmsClub
  score: { home: number; away: number } | null
}

export type LmsRoundPage = {
  available: boolean
  entered: boolean
  entryOutcome: EntryOutcome | null
  round: {
    windowId: string
    sequence: number
    label: string
    opensAt: string | null
    locksAt: string | null
  } | null
  fixtures: readonly LmsFixture[]
  /** The caller's pick in this round, or null if they have not picked. */
  pick: { teamId: string } | null
  pickOutcome: PickOutcome | null
}

export type LmsRoundPresentation = {
  /** Why the player cannot pick, or null when they can. */
  refusal: string | null
  canPick: boolean
  /** The clubs offered, in fixture order, home before away. */
  choices: readonly LmsClub[]
  /** One sentence naming where the player stands. Never inferred from pickOutcome. */
  statusLine: string
  /** What the pick did, as fact. Null before a result, or before a pick. */
  outcomeLine: string | null
}

const ENTRY_COPY: Record<EntryOutcome, string> = {
  active: 'You are still in.',
  qualified: 'You are still in.',
  survived: 'You survived the last round.',
  eliminated: 'You have been eliminated.',
  champion: 'You are the last one standing.',
}

const OUTCOME_COPY: Record<PickOutcome, string> = {
  won: 'Your pick won.',
  lost: 'Your pick lost.',
  // Deliberately does not say what happens next: whether a draw eliminates is
  // a stored rule this surface cannot see.
  drew: 'Your pick drew.',
  postponed: 'Your pick has no result yet — a round without one never eliminates.',
}

export function presentLmsRound(page: LmsRoundPage, now: Date): LmsRoundPresentation {
  const locked = page.round?.locksAt ? new Date(page.round.locksAt) <= now : false
  const notOpen = page.round?.opensAt ? new Date(page.round.opensAt) > now : false

  const refusal = !page.available
    ? 'Last Man Standing has not started for this season yet.'
    : !page.round
      ? 'There is no round to play.'
      : !page.entered
        ? 'Join Last Man Standing to make a pick.'
        : page.entryOutcome === 'eliminated'
          ? 'You have been eliminated, so this round is read-only.'
          : notOpen
            ? 'This round has not opened yet.'
            : locked
              ? 'This round is locked.'
              : null

  const choices = page.fixtures.flatMap((fixture) => [fixture.home, fixture.away])

  return {
    refusal,
    canPick: refusal === null,
    choices,
    statusLine: page.entered
      ? (page.entryOutcome ? ENTRY_COPY[page.entryOutcome] : 'You are entered.')
      : 'You are not entered in this competition.',
    outcomeLine: page.pickOutcome ? OUTCOME_COPY[page.pickOutcome] : null,
  }
}

/** Everything the page may ask of the world. Injected, so the page stays pure. */
export type SeasonLmsGateway = {
  load(): Promise<LmsRoundPage>
  /** Save a pick. The gateway owns the version echo; a pick is not a version. */
  pick(teamId: string): Promise<void>
}
