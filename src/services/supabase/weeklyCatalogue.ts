import { db } from './client'
import {
  mapPublishedWeeklySeasons,
  type PublishedWeeklySeason,
} from './weeklyCatalogueModel'

/**
 * The published weekly catalogue query wrapper (contract 147's
 * `get_published_weekly_seasons`, closing `MIG-UI-12`).
 *
 * IT IS AN RPC RATHER THAN A TABLE READ, and that is the whole change. The
 * previous module selected `public.tournaments` directly and could answer
 * everything about a season except the one field a URL is built from:
 * `public.competitions.slug` is revoked from every browser role by contract
 * 121. So the frontend could learn a season existed and not learn where it
 * lived, and a static array supplied the missing segment.
 *
 * IT RETURNS LEAGUE SEASONS ONLY, by the RPC's own `kind = 'league_season'`
 * filter — an `EURO-001` safety property, not a filter of convenience. This
 * module must never re-filter, re-order or supplement the list: every addition
 * would be a second opinion about what the weekly platform publishes.
 *
 * The decoder lives in `weeklyCatalogueModel.ts` so the catalogue's shape can be
 * tested without a Supabase client.
 */

export type {
  PublishedWeeklySeason,
  PublishedWeeklySeasonStatus,
} from './weeklyCatalogueModel'

/** Every weekly-platform season the server publishes, in the server's order. */
export async function fetchPublishedWeeklySeasons(): Promise<PublishedWeeklySeason[]> {
  const { data, error } = await db.rpc('get_published_weekly_seasons')
  if (error) throw error
  return mapPublishedWeeklySeasons(data)
}
