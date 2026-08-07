import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/design-system/ClubIdentity.module.css', 'utf8')
const matchCard = readFileSync('src/design-system/ClubMatchCard.tsx', 'utf8')
const leagueTable = readFileSync('src/design-system/LeagueTable.tsx', 'utf8')
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

  it('stays adopted on the first high-value domestic football surfaces', () => {
    expect((matchCard.match(/<ClubIdentity/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(leagueTable).toContain('<ClubIdentity')
  })

  it('remains visible in the design-system gallery with Premier and Scottish examples', () => {
    expect(gallery).toContain('ClubIdentity')
    expect(gallery).toContain("CEL: { monogram: 'CEL'")
    expect(gallery).toContain("ARS: { monogram: 'ARS'")
  })
})
