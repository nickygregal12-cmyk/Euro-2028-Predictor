// Reading the operator's service message. PURE, and deliberately suspicious of
// its input.
//
// This is the one string on the page written outside the codebase: an operator
// types it into a workflow dispatch and a job commits it. So everything here is
// a refusal rather than a repair. A record that is missing, half-written,
// expired, over-long or at an unknown level renders NOTHING -- silence is a
// correct outcome for a banner, and a half-rendered maintenance notice is not.
//
// Rendering as text rather than markup is the component's job (React does it by
// default); bounding the message so a mistake cannot fill the viewport is this
// module's.

/**
 * How loudly the message is drawn. Anything else is refused.
 *
 * Not exported on its own -- callers reach it through `ActiveAnnouncement`,
 * which is the only shape they should be holding.
 */
type AnnouncementLevel = 'info' | 'warning'

const LEVELS: readonly AnnouncementLevel[] = ['info', 'warning']

/**
 * Long enough for "Results for matchweek 3 are delayed while we check a
 * provider correction -- standings will catch up this evening", short enough
 * that a paste accident cannot become the page. An over-long message is refused
 * whole rather than truncated: half a sentence can say something the operator
 * did not write.
 */
export const MAX_MESSAGE_LENGTH = 280

/**
 * The shape stored in `config/operator-announcement.json`. Not exported: the
 * parser takes `unknown` on purpose, because the file is written by a workflow
 * and nothing should be able to claim it already matches this.
 */
type AnnouncementRecord = {
  message: string | null
  level: string | null
  publishedAt: string | null
  expiresAt: string | null
}

export type ActiveAnnouncement = {
  message: string
  level: AnnouncementLevel
}

function isLevel(value: unknown): value is AnnouncementLevel {
  return typeof value === 'string' && LEVELS.includes(value as AnnouncementLevel)
}

/** Milliseconds, or null when the value is absent or not a real date. */
function instant(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * The announcement to show right now, or null.
 *
 * `now` is passed in rather than read, so expiry is testable without waiting
 * and without a clock stub.
 */
export function activeAnnouncement(
  record: unknown,
  now: number,
): ActiveAnnouncement | null {
  if (typeof record !== 'object' || record === null) return null
  const { message, level, expiresAt } = record as Partial<AnnouncementRecord>

  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  if (trimmed === '') return null
  if (trimmed.length > MAX_MESSAGE_LENGTH) return null

  if (!isLevel(level)) return null

  // EVERY announcement expires. A record with no expiry is treated as broken
  // rather than as permanent, because "forever" is never what an operator means
  // by a service message, and a banner nobody remembers to withdraw is how a
  // maintenance notice greets players a week later.
  const expiry = instant(expiresAt)
  // Explicit, and the compiler is what keeps it that way: without this line
  // `expiry` is `number | null` at the comparison below and tsc refuses it.
  // Deleting it would still behave correctly by accident -- `null <= now`
  // coerces to `0 <= now` -- which is precisely why it should not be deleted.
  if (expiry === null) return null
  if (expiry <= now) return null

  return { message: trimmed, level }
}
