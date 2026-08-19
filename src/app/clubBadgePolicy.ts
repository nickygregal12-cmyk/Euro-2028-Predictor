import {
  defaultBadgePolicy,
  type ClubBadgePolicy,
  type ClubBadgeSource,
} from '../domain/clubIdentity/officialBadge'

/**
 * The official-badge kill switch, read from the build's own configuration.
 *
 * ============================ WHY IT LIVES BESIDE `routeFlags` ===========
 *
 * Same conventions and the same reasoning. `VITE_*` values are build-time in
 * Vite, so a flag cannot be flipped on a live bundle by accident; an unset,
 * misspelled or non-`'true'` value FAILS CLOSED; and it is a function rather
 * than a frozen constant so a test can prove both branches, which is the whole
 * point of a switch that exists to be turned off.
 *
 * `src/vite-env.d.ts` and `.env.example` must both name any variable read here
 * — `tests/scripts/environmentVariableContract.test.ts` enforces it.
 *
 * ============================ WHAT "OFF" MEANS TODAY =====================
 *
 * Off, and off for reasons that are recorded rather than temporary. ADR 0017
 * decided the product launches badge-free; the provider capability audit found
 * that all four configured providers disclaim the rights to the images they
 * serve. Nothing in this repository decodes a provider badge field to feed this
 * policy, and `netlify.toml`'s `img-src 'self' data:` would block a remote badge
 * even if something did.
 *
 * So turning this on is three deliberate changes, not one: a recorded rights
 * decision, a provider adapter that carries the field, and a CSP that admits
 * the host. This flag is the last of the three and the easiest to reverse.
 */

const SOURCES: readonly ClubBadgeSource[] = ['football-data', 'sportmonks', 'api-sports']

function enabled(value: string | undefined): boolean {
  return value?.trim() === 'true'
}

/**
 * A comma-separated list, ignoring anything it does not recognise.
 *
 * IGNORING RATHER THAN THROWING is the right failure here: a typo in one entry
 * must not enable the others by accident and must not take the application
 * down. An unrecognised source is simply not approved, which is the same answer
 * as not naming it.
 */
function sourcesFrom(value: string | undefined): readonly ClubBadgeSource[] {
  if (!value) return []
  const named = value.split(',').map((entry) => entry.trim())
  return SOURCES.filter((source) => named.includes(source))
}

/** A comma-separated allowlist, or `null` for "every competition". */
function competitionsFrom(value: string | undefined): readonly string[] | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const named = trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  // An option set to nothing but separators is a mistake, and the safe reading
  // of a mistake here is the narrower one: allow nothing rather than everything.
  return named
}

export function clubBadgePolicy(): ClubBadgePolicy {
  if (!enabled(import.meta.env.VITE_UI_OFFICIAL_BADGES)) return defaultBadgePolicy()

  return {
    enabled: true,
    sources: sourcesFrom(import.meta.env.VITE_UI_OFFICIAL_BADGE_SOURCES),
    competitions: competitionsFrom(import.meta.env.VITE_UI_OFFICIAL_BADGE_COMPETITIONS),
  }
}
