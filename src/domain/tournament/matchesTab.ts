// Pure domain for the Matches tab (design-system §6) — the time-shaped fixture
// browser. Groups every fixture by matchday (group MD1–3 + the four KO rounds,
// the same whole-tournament matchday concept as rank_history) or by group letter,
// and picks the group to auto-scroll to. No React, no DB — data in, data out.

import { MATCHDAY_POINTS, type MatchdayKey } from './rankHistory'

export type FixtureLike = {
  id: string
  round: string
  matchday: number | null
  groupId: string | null
  matchDate: string // ISO
  kickoffAt: string | null // ISO
  matchRef: string
}

export type FixtureGroup<T> = { key: string; label: string; matches: T[] }

const MATCHDAY_LABEL: Record<MatchdayKey, string> = {
  MD1: 'Matchday 1',
  MD2: 'Matchday 2',
  MD3: 'Matchday 3',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  FINAL: 'Final',
}

function whenOf(m: FixtureLike): number {
  return new Date(m.kickoffAt ?? m.matchDate).getTime()
}
function byWhen<T extends FixtureLike>(a: T, b: T): number {
  return whenOf(a) - whenOf(b) || a.matchRef.localeCompare(b.matchRef)
}

/** Every fixture grouped by matchday, in tournament order; empty groups dropped. */
export function groupByMatchday<T extends FixtureLike>(matches: T[]): FixtureGroup<T>[] {
  return MATCHDAY_POINTS.map((p) => ({
    key: p.key,
    label: MATCHDAY_LABEL[p.key],
    matches: matches
      .filter((m) => m.round === p.round && (p.matchday === null || m.matchday === p.matchday))
      .slice()
      .sort(byWhen),
  })).filter((g) => g.matches.length > 0)
}

/** Group-stage fixtures re-grouped by group letter A–F (the "By group" view). */
export function groupByGroupLetter<T extends FixtureLike>(
  matches: T[],
  letterOf: (groupId: string | null) => string | null,
): FixtureGroup<T>[] {
  const byLetter = new Map<string, T[]>()
  for (const m of matches) {
    if (m.round !== 'group') continue
    const letter = letterOf(m.groupId)
    if (!letter) continue
    const list = byLetter.get(letter) ?? []
    list.push(m)
    byLetter.set(letter, list)
  }
  return [...byLetter.keys()]
    .sort()
    .map((letter) => ({ key: `G${letter}`, label: `Group ${letter}`, matches: (byLetter.get(letter) ?? []).slice().sort(byWhen) }))
}

/**
 * Which group to scroll into view on open: the first group that still has a
 * match today or in the future (the "current front" of the tournament). Once
 * everything is played, the last group. 0 for an empty list.
 */
export function currentGroupIndex<T extends FixtureLike>(groups: FixtureGroup<T>[], now: Date = new Date()): number {
  if (groups.length === 0) return 0
  const t = now.getTime()
  const idx = groups.findIndex((g) => g.matches.some((m) => whenOf(m) >= t))
  return idx === -1 ? groups.length - 1 : idx
}
