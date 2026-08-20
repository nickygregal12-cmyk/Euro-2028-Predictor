/**
 * WHETHER AN OFFICIAL CLUB BADGE MAY BE DRAWN — ONE DECISION, IN ONE PLACE.
 *
 * ============================ THE POSITION THIS SERVES ===================
 *
 * ADR 0017's club identity half is **in force and not superseded**: the product
 * launches badge-free, `ClubIdentity` is the only path by which a club is
 * visually represented, and it renders from colour, a generic kit pattern and a
 * monogram. It also records the reason a crest is different from a colour: a
 * crest is simultaneously a registered trade mark AND an original artistic
 * work, UK fair dealing is narrow, and there is no descriptive-use defence in
 * copyright.
 *
 * The 8 August 2026 provider capability audit measured what the CONFIGURED
 * providers actually say, and all four say the same thing:
 *
 *   * SportMonks serves `image_path` for a participant and states that logos
 *     remain copyrighted by their owners, that the customer must arrange proof
 *     of intellectual property, and — notably — recommends creating a VARIATION
 *     where permission cannot be obtained;
 *   * football-data.org serves a `crest` and states the same;
 *   * API-SPORTS serves a `logo`, states it does not own those assets and that
 *     additional authorisation may be required from rights holders;
 *   * SportDB's terms prohibit use that violates third-party IP and establish
 *     no club-logo licence.
 *
 * Its conclusion is the rule this module implements: an enrichment schema may
 * retain a provider image reference "for later rights resolution", but **public
 * UI must not assume it may render or re-host those assets**. A URL in a
 * payload is not a licence.
 *
 * ============================ WHY THE CAPABILITY EXISTS ANYWAY ===========
 *
 * ADR 0017's own consequence: *"Because `ClubIdentity` is the sole rendering
 * path, adding licensed crests later is a single component change rather than a
 * redesign. The option is preserved rather than foreclosed."* This is that
 * option, made concrete and switchable — so the day a rights holder or a
 * provider licence changes the answer, one policy changes and no page does.
 *
 * **IT IS OFF.** `defaultBadgePolicy()` denies, `src/app/clubBadgePolicy.ts`
 * fails closed on an unset flag, and nothing in the repository decodes a
 * provider badge field to feed it — by decision, not by omission. Two
 * independent things would have to change before a badge could appear: a rights
 * decision recorded in an authority, and the `img-src` line of the
 * Content-Security-Policy in `netlify.toml`, which today is `'self' data:` and
 * would block every remote badge regardless of this policy.
 *
 * ============================ AND IT IS NOT A COMPONENT'S DECISION =======
 *
 * Presentation receives a resolved badge or nothing. It never sees a provider
 * name, a flag or a URL it has to judge, because a condition like
 * `if (provider === …)` in Home is the same condition in Matches a month later
 * and a different one in Match Centre a month after that.
 */

/**
 * The providers this platform is already configured to talk to, and which field
 * each one would supply. **Being listed is not being approved** — approval is
 * the policy's `sources`, which is empty by default.
 */
export type ClubBadgeSource = 'football-data' | 'sportmonks' | 'api-sports'

/** What a provider adapter would hand over, if one ever decoded a badge field. */
export type ClubBadgeCandidate = {
  readonly url: string
  readonly source: ClubBadgeSource
}

/** A badge the policy has allowed. Presentation sees only this. */
export type OfficialClubBadge = {
  readonly url: string
  readonly source: ClubBadgeSource
}

export type ClubBadgePolicy = {
  /** The kill switch. `false` denies everything, whatever else is set. */
  readonly enabled: boolean
  /** Which providers are approved. Empty denies everything. */
  readonly sources: readonly ClubBadgeSource[]
  /**
   * Which competitions may show badges, by season/tournament id.
   *
   * `null` means "every competition, once the switches above allow it" and is
   * the ordinary shape. A list exists because rights and data quality are not
   * uniform: a licence obtained for one competition is a licence for that
   * competition, and a provider that serves good art for the Premier League may
   * serve nothing usable for a lower division.
   */
  readonly competitions: readonly string[] | null
}

/**
 * DENY. The default is the answer, not a placeholder for one: a policy that
 * defaulted to permitting would mean a missing configuration became a rights
 * claim.
 */
export function defaultBadgePolicy(): ClubBadgePolicy {
  return { enabled: false, sources: [], competitions: null }
}

/**
 * The hosts each provider actually serves its assets from.
 *
 * WHY AN ALLOWLIST AND NOT A `https:` CHECK. A badge URL arrives inside a
 * provider payload, and a payload is data rather than trusted code. Rendering
 * an arbitrary remote URL as an image leaks the reader's IP address and
 * `Referer` to whoever owns that host and lets a compromised or spoofed
 * response point the product's own pages at somebody else's server. The
 * allowlist means a badge can only ever come from the host the approved
 * provider is approved FOR.
 */
const SOURCE_HOSTS: Readonly<Record<ClubBadgeSource, readonly string[]>> = {
  'football-data': ['crests.football-data.org'],
  sportmonks: ['cdn.sportmonks.com'],
  'api-sports': ['media.api-sports.io'],
}

/**
 * Is this a URL we would be willing to point an `<img>` at?
 *
 * `https` ONLY — a mixed-content image is blocked by the browser anyway and an
 * `http` badge would be a downgrade the page cannot see. No credentials, no
 * port, no `data:`/`blob:`/`javascript:`, and the host must be the approved
 * provider's own.
 */
export function isPermittedBadgeUrl(url: string, source: ClubBadgeSource): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.username !== '' || parsed.password !== '') return false
  if (parsed.port !== '') return false
  return SOURCE_HOSTS[source].includes(parsed.hostname)
}

export type ResolveBadgeOptions = {
  readonly policy: ClubBadgePolicy
  /**
   * The season/tournament id the club is being drawn inside, where the caller
   * knows it. `null` is answered by the policy's own competition rule: with no
   * list every competition is allowed, and with a list an unnamed competition
   * is not — an unknown competition must not inherit another one's licence.
   */
  readonly competitionId: string | null
}

/**
 * The whole decision, and the only place it is made.
 *
 * Every gate has to pass: badges on, this provider approved, this competition
 * allowed, and a URL that is actually usable. Any one of them failing returns
 * `null`, which is the club's own kit identity — a first-class supported mode
 * and not a fallback waiting to be deleted.
 */
export function resolveOfficialBadge(
  candidate: ClubBadgeCandidate | null | undefined,
  options: ResolveBadgeOptions,
): OfficialClubBadge | null {
  const { policy, competitionId } = options
  if (!policy.enabled) return null
  if (!candidate) return null
  if (!policy.sources.includes(candidate.source)) return null
  if (policy.competitions !== null) {
    if (competitionId === null) return null
    if (!policy.competitions.includes(competitionId)) return null
  }
  if (!isPermittedBadgeUrl(candidate.url, candidate.source)) return null
  return { url: candidate.url, source: candidate.source }
}

/**
 * Whether a page needs to make ANY remote image request at all.
 *
 * A page that asks this first can skip the whole badge path — no `<img>`, no
 * request, no decode — rather than rendering elements that resolve to nothing.
 * It is the cheap half of the kill switch.
 */
export function badgesPossible(policy: ClubBadgePolicy): boolean {
  return policy.enabled && policy.sources.length > 0
}
