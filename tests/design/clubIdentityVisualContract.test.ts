import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/design-system/ClubIdentity.module.css', 'utf8')
const matchCard = readFileSync('src/design-system/ClubMatchCard.tsx', 'utf8')
const leagueTable = readFileSync('src/design-system/LeagueTable.tsx', 'utf8')
const seasonLms = readFileSync('src/features/season/SeasonLmsPage.tsx', 'utf8')
const seasonMatches = readFileSync('src/features/season/SeasonMatchesPage.tsx', 'utf8')
// The Matches surface resolves its identity in the DECODER rather than in the
// component. That is an improvement rather than a loosening: contract 139
// returns each club's stored short code and colours, so the tokens come from
// reference data instead of being derived from a name at render time — which
// is what `resolveClubIdentity` falls back to when it is given neither.
const seasonMatchesDecoder = readFileSync(
  'src/services/supabase/seasonFixtureListModel.ts',
  'utf8',
)
const gallery = readFileSync('src/dev/ComponentsPreview.tsx', 'utf8')

describe('DFA-003 club identity visual contract', () => {
  it('draws one shirt-shaped primitive without extra React markup', () => {
    expect(css).toMatch(/\.club::before\s*\{/)
    expect(css).toMatch(/clip-path:\s*polygon\(/)
  })

  it('keeps the existing layout footprints stable across dense surfaces', () => {
    expect(css).toMatch(/\.card\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/s)
    expect(css).toMatch(/\.table\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px;/s)
    expect(css).toMatch(/\.venue\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s)
    expect(css).toMatch(/\.champion\s*\{[^}]*width:\s*38px;[^}]*height:\s*38px;/s)
  })

  it('retains the bounded generic kit-pattern vocabulary', () => {
    for (const pattern of ['solid', 'stripes', 'hoops', 'halves', 'sash']) {
      expect(css, pattern).toContain(`.${pattern}`)
    }
  })

  it('stays adopted across the high-value repeated domestic football surfaces', () => {
    expect((matchCard.match(/<ClubIdentity/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(leagueTable).toContain('<ClubIdentity')
    expect(seasonLms).toContain('<ClubIdentity')
    expect(seasonMatches).toContain('<ClubIdentity')
    expect(seasonLms).toContain('resolveClubIdentity')
    // Resolved once, where the payload is decoded, and passed down as tokens.
    expect(seasonMatchesDecoder).toContain('resolveClubIdentity')
    expect(seasonMatchesDecoder).toContain('short_code')
    expect(seasonMatchesDecoder).toContain('club_colours')
  })

  it('remains visible in the design-system gallery with Premier and Scottish examples', () => {
    expect(gallery).toContain('ClubIdentity')
    expect(gallery).toContain("CEL: { monogram: 'CEL'")
    expect(gallery).toContain("ARS: { monogram: 'ARS'")
  })
})
