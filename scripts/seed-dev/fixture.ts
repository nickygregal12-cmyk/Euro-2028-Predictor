// A self-contained model of the tournament's shape — six groups of four, the 36
// group matches — keyed by STABLE references (group letter + slot, and the
// GA-1..GF-6 match_ref). The dry-run resolves generated predictions against this
// model; the committing run resolves the same references against the real rows
// in the dev database, so one generator drives both paths.
//
// Team names here are only for readable dry-run output. The committing seed
// never writes these names — it maps by group letter + slot onto whatever teams
// the dev DB already holds (placeholders or real).

export type FixtureTeam = { slot: number; name: string; countryCode: string }
export type FixtureGroup = { letter: string; teams: FixtureTeam[] }
export type FixtureMatch = {
  matchRef: string // 'GA-1'..'GF-6'
  groupLetter: string
  matchday: number
  homeSlot: number
  awaySlot: number
}

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

// 24 nations, four per group. Codes are flag-icons codes (subdivisions for the
// home nations) so the dry-run's short codes read naturally.
const GROUP_TEAMS: Record<string, FixtureTeam[]> = {
  A: [
    { slot: 1, name: 'England', countryCode: 'gb-eng' },
    { slot: 2, name: 'Scotland', countryCode: 'gb-sct' },
    { slot: 3, name: 'Turkey', countryCode: 'tr' },
    { slot: 4, name: 'Serbia', countryCode: 'rs' },
  ],
  B: [
    { slot: 1, name: 'Spain', countryCode: 'es' },
    { slot: 2, name: 'Italy', countryCode: 'it' },
    { slot: 3, name: 'Croatia', countryCode: 'hr' },
    { slot: 4, name: 'Albania', countryCode: 'al' },
  ],
  C: [
    { slot: 1, name: 'France', countryCode: 'fr' },
    { slot: 2, name: 'Netherlands', countryCode: 'nl' },
    { slot: 3, name: 'Austria', countryCode: 'at' },
    { slot: 4, name: 'Poland', countryCode: 'pl' },
  ],
  D: [
    { slot: 1, name: 'Germany', countryCode: 'de' },
    { slot: 2, name: 'Portugal', countryCode: 'pt' },
    { slot: 3, name: 'Switzerland', countryCode: 'ch' },
    { slot: 4, name: 'Hungary', countryCode: 'hu' },
  ],
  E: [
    { slot: 1, name: 'Belgium', countryCode: 'be' },
    { slot: 2, name: 'Denmark', countryCode: 'dk' },
    { slot: 3, name: 'Wales', countryCode: 'gb-wls' },
    { slot: 4, name: 'Slovakia', countryCode: 'sk' },
  ],
  F: [
    { slot: 1, name: 'Ukraine', countryCode: 'ua' },
    { slot: 2, name: 'Czechia', countryCode: 'cz' },
    { slot: 3, name: 'Romania', countryCode: 'ro' },
    { slot: 4, name: 'Sweden', countryCode: 'se' },
  ],
}

// The UEFA round-robin order for four teams over three matchdays.
const ROUND_ROBIN: { home: number; away: number; matchday: number }[] = [
  { home: 1, away: 2, matchday: 1 },
  { home: 3, away: 4, matchday: 1 },
  { home: 1, away: 3, matchday: 2 },
  { home: 2, away: 4, matchday: 2 },
  { home: 1, away: 4, matchday: 3 },
  { home: 2, away: 3, matchday: 3 },
]

export type Fixture = {
  groups: FixtureGroup[]
  matches: FixtureMatch[]
}

export function buildFixture(): Fixture {
  const groups: FixtureGroup[] = GROUP_LETTERS.map((letter) => ({
    letter,
    teams: GROUP_TEAMS[letter],
  }))

  const matches: FixtureMatch[] = []
  for (const letter of GROUP_LETTERS) {
    ROUND_ROBIN.forEach((rr, i) => {
      matches.push({
        matchRef: `G${letter}-${i + 1}`,
        groupLetter: letter,
        matchday: rr.matchday,
        homeSlot: rr.home,
        awaySlot: rr.away,
      })
    })
  }
  return { groups, matches }
}

export function teamOf(fixture: Fixture, groupLetter: string, slot: number): FixtureTeam {
  const group = fixture.groups.find((g) => g.letter === groupLetter)!
  return group.teams.find((t) => t.slot === slot)!
}

// A short label for dry-run output, e.g. "Sco 2–1 Eng".
export function shortName(name: string): string {
  return name.slice(0, 3)
}
