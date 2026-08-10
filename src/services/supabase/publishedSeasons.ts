import { supabase } from './client'

/**
 * Which competition seasons the server actually holds, discovered rather than
 * hard-coded (`MIG-UI-12`).
 *
 * WHAT THIS REPLACES. Every catalogue read in the product began from
 * `HUB_COMPETITIONS`, a hand-written array of two, and asked the server only
 * about the names in it. Publishing a third competition therefore required a
 * frontend code change to make it exist at all — which is the opposite of the
 * scalability contract, and the one part of it the previous session left
 * standing.
 *
 * WHAT THE AUDIT FOUND, and why this is a table read rather than an RPC:
 *
 * - `public.tournaments` is browser-readable to `authenticated` (`tournaments
 *   readable`, select `true`, from the initial migration) and carries `id`,
 *   `name`, `season_key`, `kind`, `status` and `display_timezone`. Those are
 *   canonical season identity, a display name, a season label, a lifecycle
 *   state and the calendar zone.
 * - `kind` is the eligibility discriminator and it is canonical: `league_season`
 *   is the weekly platform, `tournament` is the Euro shape. Filtering on it is
 *   how Euro stays out of this catalogue **by its own stored kind** rather than
 *   by an allowlist — and Euro's separate publication boundary
 *   (`euro_publication_state`) is untouched and still governs its own site.
 * - `get_competition_games(uuid)` answers which games a season runs, but takes a
 *   season id, so it can describe a season and cannot enumerate one.
 *
 * WHAT THE AUDIT FOUND MISSING, exactly:
 *
 * - **The route slug.** `public.competitions.slug` is the canonical route
 *   identity and the table is `revoke all … from public, anon, authenticated`.
 *   A browser cannot read it, and deriving one from `tournaments.name` would be
 *   a client-side guess at a server-owned identifier — the precise mistake the
 *   season routes were built to avoid.
 * - **A publication decision.** `status` is a lifecycle (`draft`, `scheduled`,
 *   `active`, `complete`, `archived`), not a decision to show a competition to
 *   players. They are not the same question and this module does not pretend
 *   they are; it reports the lifecycle and lets the model decide what to list.
 *
 * So this read makes the frontend DISCOVER seasons from the server, and
 * `HUB_COMPETITIONS` degrades to what it can still honestly supply — a route
 * slug and presentation copy for the seasons it happens to know. A season the
 * server holds and the static catalogue does not is surfaced as itself and
 * marked unroutable, rather than vanishing. Closing that last gap is the narrow
 * backend read `MIG-UI-12` records.
 *
 * IT ORDERS NOTHING AND FILTERS ONLY BY KIND. Which seasons a player should see
 * is a presentation decision and belongs to the model.
 */

export type PublishedSeason = {
  /** The season row id every season read is addressed by. */
  id: string
  /** "Premier League 2026/27" — competition and season together, as stored. */
  name: string
  /** "2026-27". The season's own key, not a formatted label. */
  seasonKey: string
  /** The season's lifecycle. NOT a publication decision. */
  status: 'draft' | 'scheduled' | 'active' | 'complete' | 'archived' | null
  /** The competition's calendar zone. Never a presentation input. */
  timeZone: string | null
}

const STATUSES: readonly string[] = ['draft', 'scheduled', 'active', 'complete', 'archived']

type Row = {
  id: string
  name: string
  season_key: string | null
  status: string | null
  display_timezone: string | null
}

/**
 * Every weekly-platform season the server holds.
 *
 * `kind = 'league_season'` is the whole filter. It is a stored, canonical fact
 * about what a season IS, so a tournament cannot appear here by omission and a
 * new league cannot fail to appear because nobody added it to a list.
 */
export async function fetchPublishedSeasons(): Promise<PublishedSeason[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, season_key, status, display_timezone')
    .eq('kind', 'league_season')
  if (error) throw error

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    seasonKey: row.season_key ?? '',
    status: STATUSES.includes(row.status ?? '')
      ? (row.status as PublishedSeason['status'])
      : null,
    timeZone: row.display_timezone,
  }))
}
