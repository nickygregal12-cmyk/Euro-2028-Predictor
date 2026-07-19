// Deterministic generation of the fake mid-tournament: ~20 test users with
// hostile-variety display names, a complete submitted entry each (all 36 group
// scores, a predicted order per group, a full knockout progression, up to five
// jokers, a total-goals guess), and ~12 entered group results.
//
// Pure and seeded: same seed → identical output, so re-running the seed is
// stable (idempotency). No I/O here — the runner turns this into DB rows or a
// dry-run printout.

import type { KnockoutStage } from '../../src/domain/tournament/scoringConfig'
import { GROUP_LETTERS, type Fixture } from './fixture'

// The seed marks its users by email domain so the idempotent wipe can find them
// without touching any real account.
export const SEED_EMAIL_DOMAIN = 'seed.euro28.test'
const DEFAULT_SEED = 0x51_7ea1

// Hostile-data display names (design-system §6): very short, single-word,
// hyphenated, accented/unicode, emoji, ALL CAPS, punctuation, and the longest
// plausible (≤40 chars, the DB limit). Kept at ~22 so callers can take 20.
export const HOSTILE_NAMES: string[] = [
  'Al',
  'Bo',
  'Cristiano',
  'Priya Shah',
  'Alex Turner',
  'Jordan Blake',
  'Sam Okafor',
  'Anne-Marie Ndlovu-Okonkwo',
  'Maximilian von Habsburg-Lothringen III',
  'Zoë Müller',
  'José Peña',
  'Søren Kjær-Nielsen',
  'Fatima Al-Sayed',
  'Wojciech Szczęsny',
  'MEGA FAN 2028',
  'xX_Predictor_Xx',
  '🦁 Leo the Lion',
  'renée',
  "O'Sullivan",
  'The Undisputed Champion Of All Groups',
  'Ng',
  'María-José da Silva',
]

// --- deterministic RNG (mulberry32) ------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d_2b_79_f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const intBelow = (rng: () => number, n: number) => Math.floor(rng() * n)

// A goal count skewed toward 0–2, like real football.
function goals(rng: () => number): number {
  const r = rng()
  if (r < 0.34) return 0
  if (r < 0.68) return 1
  if (r < 0.87) return 2
  if (r < 0.96) return 3
  return 4
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = intBelow(rng, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// --- generated shapes --------------------------------------------------------
export type GeneratedEntry = {
  displayName: string
  email: string
  groupMatches: { matchRef: string; homeScore: number; awayScore: number; joker: boolean }[]
  groupOrders: { groupLetter: string; order: number[] }[] // slots, predicted 1st→4th
  progression: { groupLetter: string; slot: number; stage: KnockoutStage }[]
  totalGoals: number
}

export type GeneratedResult = { matchRef: string; homeScore: number; awayScore: number }

export type SeedData = {
  entries: GeneratedEntry[]
  results: GeneratedResult[]
}

// A valid knockout progression is a furthest-stage per qualifying team, with the
// bracket's team counts: 1 champion, 1 finalist, 2 semis, 4 quarters, 8 last-16.
const STAGE_PLAN: { stage: KnockoutStage; count: number }[] = [
  { stage: 'CHAMPION', count: 1 },
  { stage: 'FINAL', count: 1 },
  { stage: 'SF', count: 2 },
  { stage: 'QF', count: 4 },
  { stage: 'R16', count: 8 },
]

function generateProgression(
  rng: () => number,
): { groupLetter: string; slot: number; stage: KnockoutStage }[] {
  // All 24 team refs, shuffled; the first 16 qualify.
  const allTeams = GROUP_LETTERS.flatMap((letter) =>
    [1, 2, 3, 4].map((slot) => ({ groupLetter: letter, slot })),
  )
  const qualifiers = shuffle(allTeams, rng).slice(0, 16)
  const progression: { groupLetter: string; slot: number; stage: KnockoutStage }[] = []
  let i = 0
  for (const { stage, count } of STAGE_PLAN) {
    for (let c = 0; c < count; c++) {
      progression.push({ ...qualifiers[i], stage })
      i++
    }
  }
  return progression
}

function generateEntry(name: string, index: number, fixture: Fixture, rng: () => number): GeneratedEntry {
  const groupMatches = fixture.matches.map((m) => ({
    matchRef: m.matchRef,
    homeScore: goals(rng),
    awayScore: goals(rng),
    joker: false,
  }))

  // Up to five jokers per entry (varied: index % 6 gives 0..5), on distinct
  // group matches — mirrors the real allowance.
  const jokerCount = index % 6
  const jokerTargets = shuffle(
    groupMatches.map((_, i) => i),
    rng,
  ).slice(0, jokerCount)
  for (const t of jokerTargets) groupMatches[t].joker = true

  const groupOrders = GROUP_LETTERS.map((letter) => ({
    groupLetter: letter,
    order: shuffle([1, 2, 3, 4], rng),
  }))

  return {
    displayName: name,
    email: `seed-${index + 1}@${SEED_EMAIL_DOMAIN}`,
    groupMatches,
    groupOrders,
    progression: generateProgression(rng),
    totalGoals: 60 + intBelow(rng, 60), // a plausible group-stage total guess
  }
}

/**
 * Generate the whole fake mid-tournament. `userCount` test users (default 20)
 * and `resultCount` entered group results (default 12 — a group stage in
 * progress). Deterministic for a given seed.
 */
export function generateSeedData(
  fixture: Fixture,
  options: { userCount?: number; resultCount?: number; seed?: number } = {},
): SeedData {
  const userCount = options.userCount ?? 20
  const resultCount = options.resultCount ?? 12
  const rng = mulberry32(options.seed ?? DEFAULT_SEED)

  const names = HOSTILE_NAMES.slice(0, userCount)
  const entries = names.map((name, i) => generateEntry(name, i, fixture, rng))

  // ~12 results: the earliest matchdays first, so the seeded state reads as a
  // group stage partway through rather than random scattered fixtures.
  const byMatchday = fixture.matches
    .slice()
    .sort((a, b) => a.matchday - b.matchday || a.matchRef.localeCompare(b.matchRef))
  const results: GeneratedResult[] = byMatchday.slice(0, resultCount).map((m) => ({
    matchRef: m.matchRef,
    homeScore: goals(rng),
    awayScore: goals(rng),
  }))

  return { entries, results }
}
