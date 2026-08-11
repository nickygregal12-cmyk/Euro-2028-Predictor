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
 * TWO MECHANISMS, DELIBERATELY SEPARATE, BECAUSE THEY KNOW DIFFERENT THINGS.
 *
 * The first is a NOISE FILTER: it removes an organisational token that carries
 * no information for a reader who already knows they are looking at football.
 * It is derivable, so it is a rule.
 *
 * The second is a CURATED SHORT NAME. That Wolverhampton Wanderers is called
 * 'Wolves', that Brighton & Hove Albion is 'Brighton' and that Tottenham
 * Hotspur is 'Spurs' are editorial facts about how a football audience speaks.
 * No regular expression can derive them — 'Wolves' is not a substring
 * operation on 'Wolverhampton Wanderers' — so they are a list, and a list is
 * honest about being one. The owner confirmed this presentation on 11 August
 * 2026.
 *
 * A CLUB WITHOUT AN ENTRY IS NOT A DEFECT. It falls through to the filtered
 * name, which is correct for most clubs: Arsenal, Everton and Celtic need no
 * shortening, and a promoted club renders properly on the day it appears rather
 * than after somebody notices. This is exactly how `clubOverlay` in
 * `clubIdentityTokens.ts` already treats patterns and monograms — the same
 * curated-overlay-on-a-derived-default shape, for the same reason.
 *
 * WHERE THIS BELONGS IN THE END. `predictor_internal.club_identity_reference`
 * already curates a short code and colours per club, and a display name is the
 * same kind of fact about the same row. Moving it there would mean a new club
 * needs no frontend change at all, which is the standard contract 136 set.
 * That is a migration and a contract number, so this is the frontend interim
 * and is deliberately keyed the same way the server's table is — see below —
 * so the move is a lookup swap rather than a rewrite.
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

/**
 * The key `predictor_internal.club_identity_reference` uses, reproduced exactly.
 *
 * It is `normalised_club_name` from `20260809070000_club_name_normaliser_fix.sql`:
 * lowercase, remove `fc`/`afc` as whole WORDS, then reduce to letters. The
 * order is the whole of contract 137 — reducing to letters first destroys the
 * word boundary the removal needs, which is how 'Chelsea FC' became 'chelse'.
 *
 * Keying on this rather than on the three-letter code is deliberate and is the
 * difference between the map working everywhere and working on three surfaces
 * out of four. The season Last Man Standing round read supplies a team id and a
 * name and no code at all, so a code-keyed lookup would silently do nothing on
 * the pick list — which is a column of club names on a phone and the surface
 * that needs shortening most.
 */
export function normalisedClubName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(afc|fc)\b/g, '')
    .replace(/[^a-z]/g, '')
}

/**
 * What a football audience calls each club.
 *
 * Keyed by normalised name, and covering the Premier League and Scottish
 * Premiership fields that `club_identity_reference` already curates. A club is
 * listed ONLY where the common name genuinely differs from the filtered one —
 * listing 'Arsenal' as 'Arsenal' would be a row that can rot without ever being
 * wrong enough to notice.
 *
 * The bar is what a broadcaster puts on a scoreboard, not what is shortest.
 * 'Man City' and 'Man Utd' are how those clubs are captioned; 'Newcastle' and
 * 'Leeds' drop a suffix that no one says; 'Wolves' and 'Spurs' are names in
 * their own right.
 */
export const clubShortNames: Record<string, string> = {
  // Premier League and recent members.
  brightonhovealbion: 'Brighton',
  coventrycity: 'Coventry',
  huddersfieldtown: 'Huddersfield',
  ipswichtown: 'Ipswich',
  leedsunited: 'Leeds',
  leicestercity: 'Leicester',
  lutontown: 'Luton',
  manchestercity: 'Man City',
  manchesterunited: 'Man Utd',
  newcastleunited: 'Newcastle',
  norwichcity: 'Norwich',
  nottinghamforest: "Nott'm Forest",
  sheffieldunited: 'Sheffield Utd',
  sheffieldwednesday: 'Sheffield Wed',
  tottenhamhotspur: 'Spurs',
  westbromwichalbion: 'West Brom',
  westhamunited: 'West Ham',
  wolverhamptonwanderers: 'Wolves',

  // Scottish Premiership and recent members.
  dundeeunited: 'Dundee Utd',
  heartofmidlothian: 'Hearts',
  partickthistle: 'Partick',
}

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
 * What a club or national team is called on screen.
 *
 * ```
 * clubDisplayName('Wolverhampton Wanderers FC')  // 'Wolves'         (curated)
 * clubDisplayName('Tottenham Hotspur FC')        // 'Spurs'          (curated)
 * clubDisplayName('Brighton & Hove Albion FC')   // 'Brighton'       (curated)
 * clubDisplayName('Nottingham Forest FC')        // "Nott'm Forest"  (curated)
 * clubDisplayName('Arsenal FC')                  // 'Arsenal'        (filtered)
 * clubDisplayName('AFC Bournemouth')             // 'Bournemouth'    (filtered)
 * clubDisplayName('England FA')                  // 'England'        (filtered)
 * clubDisplayName('AFC Wimbledon')               // 'AFC Wimbledon'  (kept)
 * clubDisplayName('1. FC Köln')                  // '1. FC Köln'     (mid-name)
 * ```
 *
 * The curated name is consulted first and the filter is the fallback, so a club
 * nobody has listed still loses its legal suffix. The filter repeats until
 * stable, so a doubled token ('FC Chelsea FC') resolves in one call, and stops
 * the moment a pass changes nothing.
 */
export function clubDisplayName(name: string | null | undefined): string {
  if (!name) return ''
  const collapsed = collapseWhitespace(name)
  if (!collapsed) return ''
  if (KEEP_VERBATIM.has(collapsed.toLowerCase())) return collapsed

  const curated = clubShortNames[normalisedClubName(collapsed)]
  if (curated) return curated

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
