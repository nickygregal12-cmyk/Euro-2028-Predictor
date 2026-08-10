import type { CupTableRow } from './cupPhaseModel'
import type {
  ChampionshipMember,
  ChampionshipPlayerView,
} from '../../services/supabase/seasonCupPlayer'

/**
 * Where the player stands in their Championship group, as a compact panel
 * beside their fixture.
 *
 * IT IS NOT A SECOND TABLE. The Championship already has a Table page, and
 * putting the whole group beside My Fixture would be the same data rendered
 * twice, one copy narrower. This is the player's own row and the rows either
 * side of it — the answer to "am I in trouble", which the full table makes you
 * find yourself in.
 *
 * IT COSTS NO EXTRA READ. `ChampionshipPlayerView` already carries the table
 * and the members, and the page has both in hand; this rearranges what is
 * loaded rather than asking for more.
 *
 * OPPONENTS ARE NAMED WHERE THE READ NAMES THEM. Contract 133's player view
 * carries `members` with display names for a competition the caller is in, so
 * a neighbour in the table is a person rather than "an entrant at a rank".
 * That is a narrower disclosure than a public directory — it is the group the
 * player is competing in — and it is the read's own decision, not this model's.
 *
 * THE SCORING NOTE IS A FACT ABOUT THE GAME, not a derived number: Championship
 * ties are decided by the Match Predictor points the player is already earning.
 * A player looking at a fixture they cannot directly influence needs telling
 * once where the points come from.
 *
 * PURE.
 */

export type ChampionshipStandingRow = {
  key: string
  rank: number
  name: string
  isYou: boolean
  tablePoints: number
  /** Prediction points scored across the phase. The tie-break the table uses. */
  pointsFor: number
}

export type ChampionshipStanding = {
  /** "3rd of 8", or null when the caller has no row in the table. */
  positionLine: string | null
  /** The caller's row and its immediate neighbours, in rank order. */
  rows: readonly ChampionshipStandingRow[]
  /** "League phase" / "The split". Null when the read supplied no phase. */
  phaseLine: string | null
  /** True when the table holds nothing yet — a real state, not a failure. */
  empty: boolean
}

function ordinal(rank: number): string {
  const tens = rank % 100
  if (tens >= 11 && tens <= 13) return `${rank}th`
  switch (rank % 10) {
    case 1:
      return `${rank}st`
    case 2:
      return `${rank}nd`
    case 3:
      return `${rank}rd`
    default:
      return `${rank}th`
  }
}

function nameOf(row: CupTableRow, members: readonly ChampionshipMember[]): string {
  if (row.isYou) return 'You'
  // Falls back to the anonymous form contract 120 used, rather than inventing a
  // name, whenever the read did not carry the member.
  return members.find((member) => member.userId === row.userId)?.displayName ?? 'Entrant'
}

/**
 * The caller's row plus one either side. Three rows, because that is the
 * smallest window that answers "who is above me and who is behind me" — the
 * two facts a fixture-page panel is for.
 */
const NEIGHBOURS = 1

export function presentChampionshipStanding(
  view: ChampionshipPlayerView,
): ChampionshipStanding {
  const table = [...view.table].sort((left, right) => left.groupRank - right.groupRank)
  const phaseLine =
    view.phaseKind === 'split'
      ? 'The split'
      : view.phaseKind === 'initial'
        ? 'League phase'
        : null

  if (table.length === 0) {
    return { positionLine: null, rows: [], phaseLine, empty: true }
  }

  const index = table.findIndex((row) => row.isYou)
  const you = index === -1 ? null : table[index]

  const from = index === -1 ? 0 : Math.max(0, index - NEIGHBOURS)
  const to = index === -1 ? Math.min(table.length, 3) : Math.min(table.length, index + NEIGHBOURS + 1)

  return {
    positionLine: you ? `${ordinal(you.groupRank)} of ${table.length}` : null,
    rows: table.slice(from, to).map((row) => ({
      key: row.userId,
      rank: row.groupRank,
      name: nameOf(row, view.members),
      isYou: row.isYou,
      tablePoints: row.tablePoints,
      pointsFor: row.pointsFor,
    })),
    phaseLine,
    empty: false,
  }
}
