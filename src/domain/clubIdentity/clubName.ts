/**
 * What a club or a national team is CALLED on screen.
 *
 * Pure. No storage, no network, no clock — the same rules as every other module
 * under `src/domain/`.
 *
 * WHY THIS EXISTS. `teams.name` is written verbatim from the provider: the
 * initial-publication path in `20260807210812_provider_initial_fixture_approval.sql`
 * inserts `home_team_name` into `public.teams` exactly as the feed spelled it.
 * A feed spells it legally — 'Wolverhampton Wanderers FC', 'Brighton & Hove
 * Albion FC', 'AFC Bournemouth' — and that string reaches the card, the fixture
 * list, the Hub row and the league table unchanged. `.teamName` in
 * `ClubMatchCard.module.css` is `nowrap` + `ellipsis`, so on a phone the legal
 * suffix is not merely noise: it is the reason the name is truncated.
 *
 * IT IS A NOISE FILTER, NOT A SHORT-NAME AUTHORITY. It removes an
 * organisational token that carries no information for a reader who already
 * knows they are looking at football. It does NOT decide that Wolverhampton
 * Wanderers is called 'Wolves' or that Brighton & Hove Albion is called
 * 'Brighton'. Those are editorial facts a regular expression cannot derive, and
 * guessing one would produce a name that is wrong rather than merely long. The
 * curated short name belongs in `predictor_internal.club_identity_reference`
 * beside the short code and colours it already holds; until it is there, this
 * module's job is to stop the provider's paperwork reaching a player, and no
 * more.
 *
 * THE ORDER IS THE LESSON CONTRACT 137 PAID FOR. That contract's defect was a
 * normaliser that removed whitespace and then stripped `(afc|fc)$`, so
 * 'Chelsea FC' became 'chelse' and 'Aston Villa FC' became 'astonvill'. Tokens
 * are removed as whole WORDS here, anchored to word boundaries, and the string
 * is never collapsed first.
 *
 * ONLY AT THE EDGES. A token is removed only where it leads or trails the name.
 * '1. FC Köln' keeps its FC, because a token in the middle of a name is part of
 * the name — and a rule that cannot tell the difference would rewrite it to
 * '1. Köln', which is worse than leaving it alone.
 *
 * IT NEVER RETURNS NOTHING. If stripping would leave an empty string, the
 * original is returned. A blank where a club should be is the one outcome worse
 * than a verbose club.
 */

/**
 * Organisational tokens that carry no meaning for a reader.
 *
 * Deliberately short, and deliberately biased to the leagues this product
 * actually runs — the Premier League and the Scottish Premiership — plus the
 * national-team forms a tournament feed uses. An unrecognised token is left
 * alone, which is the same conservative posture `parseClubColours` takes with
 * an unrecognised colour word: a name we did not shorten is readable, and a
 * name we shortened wrongly is a defect.
 */
const NOISE_TOKENS = [
  // Club type.
  'fc',
  'afc',
  'cf',
  'sc',
  'ac',
  'fk',
  'sk',
  // Spelled out, as some feeds do.
  'football club',
  'association football club',
  // National-team association suffixes.
  'fa',
  'national team',
  'nt',
]

/**
 * Names where the leading token IS the identity and removing it names a
 * different club.
 *
 * AFC Wimbledon is the club the supporters founded in 2002; Wimbledon is the
 * club that left for Milton Keynes. AFC Fylde and AFC Telford United carry the
 * same distinction. This list is the proof that the general rule needs curation
 * rather than a longer regular expression — and the reason the curated short
 * name belongs on the server, next to the short code, rather than here.
 *
 * Matched on the whitespace-collapsed, case-folded name.
 */
const KEEP_VERBATIM = new Set([
  'afc wimbledon',
  'afc fylde',
  'afc telford united',
  'afc totton',
  'afc rushden & diamonds',
])

/** Longest first, so 'association football club' wins over 'football club'. */
const TOKENS_BY_LENGTH = [...NOISE_TOKENS].sort((a, b) => b.length - a.length)

function escapeForRegExp(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `\b` around a token, anchored to one end of the string, with the separating
 * whitespace and any trailing punctuation the feed left behind.
 */
function edgePatterns(token: string): [RegExp, RegExp] {
  const t = escapeForRegExp(token)
  return [
    new RegExp(`^${t}\\b[\\s.,-]*`, 'i'),
    new RegExp(`[\\s.,-]*\\b${t}\\.?$`, 'i'),
  ]
}

function collapseWhitespace(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * Strips leading and trailing organisational tokens from a club or national
 * team name.
 *
 * ```
 * clubDisplayName('Wolverhampton Wanderers FC')  // 'Wolverhampton Wanderers'
 * clubDisplayName('AFC Bournemouth')             // 'Bournemouth'
 * clubDisplayName('AFC Wimbledon')               // 'AFC Wimbledon'  (curated)
 * clubDisplayName('England FA')                  // 'England'
 * clubDisplayName('1. FC Köln')                  // '1. FC Köln'     (mid-name)
 * ```
 *
 * Repeats until stable, so a doubled token ('FC Chelsea FC') resolves in one
 * call, and stops the moment a pass changes nothing.
 */
export function clubDisplayName(name: string | null | undefined): string {
  if (!name) return ''
  const collapsed = collapseWhitespace(name)
  if (!collapsed) return ''
  if (KEEP_VERBATIM.has(collapsed.toLowerCase())) return collapsed

  let current = collapsed
  for (;;) {
    let next = current
    for (const token of TOKENS_BY_LENGTH) {
      for (const pattern of edgePatterns(token)) {
        const stripped = collapseWhitespace(next.replace(pattern, ''))
        // A token that IS the whole name is not noise — it is all we have.
        if (stripped.length > 0) next = stripped
      }
    }
    if (next === current) break
    current = next
  }

  return current.length > 0 ? current : collapsed
}
