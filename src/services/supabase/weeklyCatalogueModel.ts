/**
 * The published weekly catalogue, with its route slug (contract 147,
 * `MIG-UI-12`).
 *
 * WHAT IT REPLACES. `fetchPublishedSeasons()` selected `public.tournaments`
 * directly and could answer everything about a season except the one thing a
 * URL is built from: `public.competitions.slug` is revoked from every browser
 * role by contract 121. So the frontend could learn a season existed and could
 * not learn where it lived, and a static array supplied the missing segment —
 * which meant publishing a league still needed a frontend edit before it could
 * be opened. Contract 147 closes exactly that field.
 *
 * BOTH HALVES OF THE ADDRESS COME BACK TOGETHER, in the order
 * `get_season_play_context(slug, season_key)` wants them, so a browser never
 * composes a competition's identity out of two reads.
 *
 * IT RETURNS LEAGUE SEASONS ONLY, and that is an `EURO-001` safety property
 * rather than a filter of convenience: the RPC discriminates on
 * `tournaments.kind = 'league_season'`, so Euro 2028 is excluded by what it IS.
 * The frontend must not re-filter, re-order or supplement this list — every
 * addition would be a second opinion about what the weekly platform publishes.
 *
 * DRAFT SEASONS ARE ABSENT BY THE SERVER'S OWN RULE. Production holds two
 * league seasons and both are draft, so an empty catalogue there is the honest
 * answer rather than a bug.
 *
 * PURE — no client, no network. The query wrapper is `weeklyCatalogue.ts`.
 *
 * PURE OF PRESENTATION. Which of these a player should see, in what order and
 * under what heading, belongs to the model in `features/hub/`.
 */

export type PublishedWeeklySeasonStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'complete'
  | 'archived'

export type PublishedWeeklySeason = {
  /**
   * The competition's own route segment, as the server stores it. NEVER
   * derived from a name — that would be a client-side invention of a
   * server-owned identifier, which is the mistake the season routes exist to
   * avoid.
   */
  competitionSlug: string
  /** "2026-27". The other half of the address. */
  seasonKey: string
  competitionId: string
  /** "Premier League" — the competition alone, not the combined season name. */
  competitionName: string
  /** The season row id every season read is addressed by. */
  seasonId: string
  /** "Premier League 2026/27", as stored. */
  seasonName: string
  /**
   * The season's lifecycle. NOT a publication decision — the weekly platform
   * has no equivalent of Euro's publication state, and this module does not
   * pretend `status` is one.
   */
  status: PublishedWeeklySeasonStatus | null
  /** The competition's calendar zone. Never a presentation input. */
  timeZone: string | null
}

const STATUSES: readonly string[] = [
  'draft',
  'scheduled',
  'active',
  'complete',
  'archived',
]

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function mapSeason(value: unknown): PublishedWeeklySeason | null {
  const row = objectOf(value)
  const competitionSlug = stringOrNull(row.competition_slug)
  const seasonKey = stringOrNull(row.season_key)
  const competitionId = stringOrNull(row.competition_id)
  const competitionName = stringOrNull(row.competition_name)
  const seasonId = stringOrNull(row.season_id)
  const seasonName = stringOrNull(row.season_name)

  // A season missing either half of its address is not routable and is not
  // guessed at. Dropping it is safer than listing a link that cannot be built.
  if (
    !competitionSlug ||
    !seasonKey ||
    !competitionId ||
    !competitionName ||
    !seasonId ||
    !seasonName
  ) {
    return null
  }

  const status = stringOrNull(row.status)
  return {
    competitionSlug,
    seasonKey,
    competitionId,
    competitionName,
    seasonId,
    seasonName,
    status: STATUSES.includes(status ?? '')
      ? (status as PublishedWeeklySeasonStatus)
      : null,
    timeZone: stringOrNull(row.time_zone),
  }
}

/** Pure decoder, exported so the model tests need no Supabase client. */
export function mapPublishedWeeklySeasons(value: unknown): PublishedWeeklySeason[] {
  const payload = objectOf(value)
  const raw = Array.isArray(payload.seasons) ? payload.seasons : []
  return raw
    .map(mapSeason)
    .filter((season): season is PublishedWeeklySeason => season !== null)
}
