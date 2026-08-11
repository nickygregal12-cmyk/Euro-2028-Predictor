/**
 * The Last Man Standing field, and what each entrant may be told about the
 * others (contract 164).
 *
 * THE REVEAL RULE IS THE SERVER'S AND IT IS ABSOLUTE. Before the round locks,
 * another entrant's `pick`, `hasPicked`, `livesRemaining` and `savesRemaining`
 * are all **null** — not zero, not "hidden", null — and the caller's own are
 * not. That is not squeamishness: the clubs are a depleting resource, so
 * knowing THAT somebody has already picked is itself information, and knowing
 * how many lives they have left is information about how boldly they can play.
 * The migration says so in as many words and this decoder carries the nulls
 * through rather than defaulting them.
 *
 * A NULL IS THEREFORE MEANINGFUL AND MUST NOT BE FILLED IN. Any surface that
 * renders `livesRemaining ?? 0` would print a confident zero for every rival
 * before the lock. The types below make the null explicit for exactly that
 * reason, and `isConcealed` exists so a surface can say "hidden until the
 * round locks" rather than inventing a value.
 *
 * AN OUTCOME COMES FROM THE SETTLEMENT AUTHORITY, NEVER FROM A SCORE. A pick's
 * `outcome` is null until the fixture is played, which is what makes an
 * in-flight round honest rather than optimistic. Nothing here reads a scoreline.
 *
 * `available: false` AND `entered: false` ARE DIFFERENT ANSWERS. The first is
 * "this season runs no Last Man Standing"; the second is "it does and you are
 * not in it". They send a player to different places.
 *
 * PURE.
 */

export type LmsPick = {
  teamId: string
  teamName: string | null
  /** Null until the fixture is played. Never derived from a score. */
  outcome: string | null
}

export type LmsEntrant = {
  userId: string
  displayName: string
  isMe: boolean
  outcome: string | null
  stillIn: boolean
  /** Null when concealed from this caller before the lock. Never zero. */
  livesRemaining: number | null
  /** Null when concealed from this caller before the lock. Never zero. */
  savesRemaining: number | null
  /** Null when concealed. `false` genuinely means "has not picked". */
  hasPicked: boolean | null
  /** Null when concealed, or when they have not picked. */
  pick: LmsPick | null
}

export type LmsRound = {
  windowId: string
  sequence: number | null
  label: string | null
  opensAt: string | null
  locksAt: string | null
  settlesAt: string | null
  /** The server's decision, resolved against the server's own clock. */
  revealed: boolean
  settled: boolean
}

export type LmsRules = {
  lives: number
  saves: number
  drawsRule: string | null
  endgameScope: string | null
}

export type LmsFieldCounts = {
  entrants: number
  remaining: number
  eliminated: number
  /** Null before the reveal: how many have picked is itself information. */
  picked: number | null
}

export type SeasonLmsField =
  | { available: false }
  | { available: true; entered: false }
  | {
      available: true
      entered: true
      myOutcome: string | null
      /** Null when the competition holds no round yet. */
      round: LmsRound | null
      /** Null when the organiser's setup has not been written. */
      rules: LmsRules | null
      field: LmsFieldCounts
      entrants: readonly LmsEntrant[]
    }

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function countOf(value: unknown): number {
  const parsed = integerOrNull(value)
  return parsed !== null && parsed >= 0 ? parsed : 0
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function mapPick(value: unknown): LmsPick | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const teamId = stringOrNull(row.team_id)
  if (!teamId) return null
  return {
    teamId,
    teamName: stringOrNull(row.team_name),
    outcome: stringOrNull(row.outcome),
  }
}

function mapEntrant(value: unknown): LmsEntrant | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  if (!userId) return null
  return {
    userId,
    displayName: stringOrNull(row.display_name) ?? 'Player',
    isMe: row.is_me === true,
    outcome: stringOrNull(row.outcome),
    stillIn: row.still_in === true,
    // `integerOrNull` and not `countOf`: a concealed value is null and a
    // concealed value defaulted to zero would be a claim about a rival.
    livesRemaining: integerOrNull(row.lives_remaining),
    savesRemaining: integerOrNull(row.saves_remaining),
    hasPicked: booleanOrNull(row.has_picked),
    pick: mapPick(row.pick),
  }
}

function mapRound(value: unknown): LmsRound | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const windowId = stringOrNull(row.window_id)
  if (!windowId) return null
  return {
    windowId,
    sequence: integerOrNull(row.sequence),
    label: stringOrNull(row.label),
    opensAt: stringOrNull(row.opens_at),
    locksAt: stringOrNull(row.locks_at),
    settlesAt: stringOrNull(row.settles_at),
    revealed: row.revealed === true,
    settled: row.settled === true,
  }
}

export function mapSeasonLmsField(payload: unknown): SeasonLmsField {
  const root = objectOf(payload)
  if (root.available !== true) return { available: false }
  if (root.entered !== true) return { available: true, entered: false }

  const field = objectOf(root.field)
  const rules = objectOf(root.rules)
  const lives = integerOrNull(rules.lives)

  return {
    available: true,
    entered: true,
    myOutcome: stringOrNull(root.my_outcome),
    round: mapRound(root.round),
    rules:
      lives === null
        ? null
        : {
            lives,
            saves: countOf(rules.saves),
            drawsRule: stringOrNull(rules.draws_rule),
            endgameScope: stringOrNull(rules.endgame_scope),
          },
    field: {
      entrants: countOf(field.entrants),
      remaining: countOf(field.remaining),
      eliminated: countOf(field.eliminated),
      // Null before the reveal, and left null.
      picked: integerOrNull(field.picked),
    },
    entrants: arrayOf(root.entrants)
      .map(mapEntrant)
      .filter((entrant): entrant is LmsEntrant => entrant !== null),
  }
}

/**
 * Whether this entrant's detail is being withheld from the caller.
 *
 * IT ASKS THE ROW, NOT THE CLOCK. `hasPicked === null` is the server saying "you
 * may not know", and a surface that instead compared a lock instant to a device
 * clock would disagree with the server for as long as the two differ — which is
 * exactly the window in which the answer matters.
 */
export function isConcealed(entrant: LmsEntrant): boolean {
  return !entrant.isMe && entrant.hasPicked === null
}

/** The caller's own row, when they are in the field. */
export function myEntrant(field: SeasonLmsField): LmsEntrant | null {
  if (!field.available || !field.entered) return null
  return field.entrants.find((entrant) => entrant.isMe) ?? null
}
