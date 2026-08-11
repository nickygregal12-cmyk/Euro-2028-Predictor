import { db } from './client'
import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'
import { fetchSeasonFixtureList } from './seasonFixtureList'

/**
 * The clubs that play in one competition season, with an id a preference can
 * name and an identity a shirt can be drawn from.
 *
 * WHY IT IS TWO READS AND NOT ONE, MEASURED RATHER THAN ASSUMED. Contract 157's
 * `set_competition_follow` takes a canonical `teams.id`, and nothing in the
 * repository returns a season's clubs with both that id AND contract 136's
 * identity facts:
 *
 *   - `public.teams` is directly readable by an authenticated browser role
 *     under its own row-level security (it is on the reviewed exposure
 *     allowlist), and holds `id` and `name` — the authoritative answer to
 *     "which clubs are in this season" — and nothing else. No short code, no
 *     colours.
 *   - `get_season_fixtures` (contract 139) carries the short code and colours,
 *     because contract 136's reference is joined server-side, but names clubs
 *     rather than identifying them: a fixture entry has no team id.
 *
 * So the id comes from the first and the identity from the second, joined on
 * the club NAME — which is exact rather than fuzzy, because the fixture read
 * takes its names from `public.teams` by foreign key, so both sides are
 * literally the same string.
 *
 * WHAT HAPPENS TO A CLUB THE FIXTURE WINDOW DOES NOT COVER. It appears, with
 * the identity the domain resolver derives from its name alone — the same
 * neutral mark an unmatched club already renders as everywhere else. It is
 * never dropped: the club list is `teams`, and a picker that hid a club because
 * it had no fixture in the next few months would be missing a club from the
 * league.
 *
 * THE GAP IS RECORDED, NOT PAPERED OVER. `MIG-UI-16` in the accepted
 * requirements asks for one bounded read returning a season's clubs with id,
 * name and identity together. This is the interim, and it is honest: every fact
 * it returns comes from an authoritative read, and nothing is invented.
 */

export type SeasonClub = {
  /** `teams.id` — what `set_competition_follow` names. */
  teamId: string
  name: string
  tokens: ClubIdentityTokens
  /**
   * True when the identity came from contract 136's server-side reference,
   * false when it was derived from the name alone. Surfaces do not currently
   * branch on it; it exists so this file's compromise is measurable rather
   * than invisible.
   */
  identityResolved: boolean
}

type TeamRow = { id: string; name: string }

/**
 * How wide a fixture window to harvest identities from.
 *
 * The server caps the window at 120 days and 500 fixtures and refuses more, so
 * this asks for what it will give rather than for a season. A 20-club league
 * plays every club many times over in four months; a club still missed keeps
 * its derived identity.
 */
const IDENTITY_WINDOW_DAYS = 110

export async function fetchSeasonClubs(tournamentId: string): Promise<SeasonClub[]> {
  const { data, error } = await db
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name')
  if (error) throw error

  const teams = (data ?? []) as TeamRow[]
  if (teams.length === 0) return []

  const identities = await harvestIdentities(tournamentId)

  return teams.map((team) => {
    const resolved = identities.get(team.name)
    return {
      teamId: team.id,
      name: team.name,
      tokens: resolved ?? resolveClubIdentity({ externalId: team.id, name: team.name }),
      identityResolved: resolved !== undefined,
    }
  })
}

/**
 * Club identities from the fixture list, keyed by the exact club name.
 *
 * A FAILURE HERE IS NOT A FAILURE OF THE CLUB LIST. Identity is decoration; the
 * ids and names are the answer. If the fixture read fails, every club falls
 * back to its derived mark and the picker still works — which is why this
 * swallows rather than rethrows, the one place in these services that does, and
 * says why.
 */
async function harvestIdentities(
  tournamentId: string,
): Promise<Map<string, ClubIdentityTokens>> {
  const identities = new Map<string, ClubIdentityTokens>()
  try {
    const list = await fetchSeasonFixtureList(tournamentId, {
      from: shiftDays(list0(), -IDENTITY_WINDOW_DAYS / 2),
      to: shiftDays(list0(), IDENTITY_WINDOW_DAYS / 2),
    })
    for (const fixture of list.fixtures) {
      identities.set(fixture.home.name, fixture.home.tokens)
      identities.set(fixture.away.name, fixture.away.tokens)
    }
  } catch {
    // Deliberately empty: see above.
  }
  return identities
}

/**
 * The window's midpoint.
 *
 * A DEVICE CLOCK IS ACCEPTABLE HERE AND NOWHERE NEAR A LOCK. It selects which
 * fixtures to read colours from; it decides nothing about time. A device a week
 * out reads a window a week out and harvests the same clubs.
 */
function list0(): Date {
  return new Date()
}

function shiftDays(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}
