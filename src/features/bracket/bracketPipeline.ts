// The knockout-bracket pipeline: from the user's group predictions (plus tie
// resolutions) and their stored knockout progression, to the round-by-round
// view the bracket screen renders. It shapes inputs and outputs only — every
// piece of progression logic lives in the pure domain (resolveGroupTies,
// rankThirdPlacedTeams, resolveRoundOf16, and bracketPicks). Same architecture
// contract as thirdPlacePipeline (CLAUDE.md rule 2).

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import {
  rankThirdPlacedTeams,
  type ThirdPlacedTeam,
} from '../../domain/tournament/rankThirdPlacedTeams'
import {
  resolveRoundOf16,
  type R16Slot,
} from '../../domain/tournament/resolveRoundOf16'
import { KNOCKOUT_BRACKET } from '../../domain/tournament/knockoutBracket'
import {
  winnersFromProgression,
  roundOfRef,
  type ProgressionStage,
} from '../../domain/tournament/bracketPicks'
import type { GroupLetter } from '../../domain/tournament/roundOf16Allocation'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { TieResolution } from '../../domain/tournament/tieResolutions'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'
import { formatShortDate } from '../../app/time'
import { venueCountryCode } from '../predict/venues'

export type RoundKey = 'R16' | 'QF' | 'SF' | 'FINAL'

export const ROUND_ORDER: RoundKey[] = ['R16', 'QF', 'SF', 'FINAL']

// Short labels for the switcher + provenance eyebrows.
export const ROUND_LABEL: Record<RoundKey, string> = {
  R16: 'R16',
  QF: 'QF',
  SF: 'SF',
  FINAL: 'Final',
}

// One side of a tie: a resolved team, or a placeholder for a feeding tie the
// user has not decided yet (never blank, never guessable — design-system §5).
export type TieSide =
  | { kind: 'team'; teamId: string; name: string; countryCode: string }
  | { kind: 'placeholder'; feederRef: string; label: string }

export type BracketTie = {
  ref: string
  round: RoundKey
  // Eyebrow provenance, e.g. "R16 · Winner A v Runner-up C".
  provenance: string
  date: string
  venue: string
  venueCountryCode: string
  home: TieSide
  away: TieSide
  // The picked winner's teamId, or null when this tie is unpicked.
  pickedTeamId: string | null
  // A tie is pickable only when both sides are resolved to real teams.
  pickable: boolean
}

export type BracketRoundView = {
  key: RoundKey
  label: string
  ties: BracketTie[]
  picked: number
  total: number
}

export type BracketChampion = { teamId: string; name: string; countryCode: string }

export type BracketPipeline = {
  // False until every group is predicted and every tie is settled, so the R16
  // draw (winners, runners-up and the four qualifying thirds) is fully known.
  ready: boolean
  rounds: BracketRoundView[]
  // The reconstructed winners map — the screen applies picks to this.
  winners: Record<string, string>
  pickedCount: number
  total: number // 15
  champion: BracketChampion | null
}

const TOTAL_PICKS = 15

function describeSlot(slot: R16Slot): string {
  switch (slot.type) {
    case 'winner':
      return `Winner ${slot.group}`
    case 'runnerUp':
      return `Runner-up ${slot.group}`
    case 'third':
      return `3rd Group ${slot.group}`
  }
}

const notReady = (): BracketPipeline => ({
  ready: false,
  rounds: ROUND_ORDER.map((key) => ({
    key,
    label: ROUND_LABEL[key],
    ties: [],
    picked: 0,
    total: key === 'R16' ? 8 : key === 'QF' ? 4 : key === 'SF' ? 2 : 1,
  })),
  winners: {},
  pickedCount: 0,
  total: TOTAL_PICKS,
  champion: null,
})

export function buildBracketPipeline(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  resolutions: TieResolution[],
  progression: Record<string, ProgressionStage>,
): BracketPipeline {
  const nameById = new Map(data.teams.map((t) => [t.id, t.name]))
  const teamSide = (teamId: string): TieSide => ({
    kind: 'team',
    teamId,
    name: nameById.get(teamId) ?? teamId,
    countryCode: '',
  })

  const groupMatches = data.matches.filter((m) => m.round === 'group')
  for (const m of groupMatches) {
    const p = getPrediction(m.id)
    if (p.homeScore === null || p.awayScore === null) return notReady()
  }

  // Derive each group's winner, runner-up and third with the user's tie orders
  // applied. Any unresolved tie in the top three leaves the R16 draw undecided.
  const groups = [...data.groups].sort((a, b) => a.letter.localeCompare(b.letter))
  const winners: Record<string, string> = {}
  const runnersUp: Record<string, string> = {}
  const thirds: ThirdPlacedTeam[] = []

  for (const g of groups) {
    const teamIds = data.teams
      .filter((t) => t.groupId === g.id)
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.id)
    const scores: MatchScore[] = groupMatches
      .filter((m) => m.groupId === g.id && m.homeTeamId && m.awayTeamId)
      .map((m) => {
        const p = getPrediction(m.id)
        return {
          homeTeamId: m.homeTeamId as string,
          awayTeamId: m.awayTeamId as string,
          homeScore: p.homeScore as number,
          awayScore: p.awayScore as number,
        }
      })

    const { standings } = resolveGroupTies(teamIds, scores, resolutions)
    const [first, second, third] = standings
    if (
      !first || first.tiedUnresolved ||
      !second || second.tiedUnresolved ||
      !third || third.tiedUnresolved
    ) {
      return notReady()
    }
    winners[g.letter] = first.teamId
    runnersUp[g.letter] = second.teamId
    thirds.push({ ...third, groupLetter: g.letter })
  }

  const ranked = rankThirdPlacedTeams(thirds, resolutions)
  if (!ranked.qualifiers) return notReady()

  let r16
  try {
    r16 = resolveRoundOf16({
      winners: winners as Record<GroupLetter, string>,
      runnersUp: runnersUp as Record<GroupLetter, string>,
      qualifyingThirds: ranked.qualifiers.map((q) => ({
        groupLetter: q.groupLetter as GroupLetter,
        teamId: q.teamId,
      })),
    })
  } catch {
    // A malformed draw (should be impossible once ties are settled) — stay
    // gated rather than render a broken bracket.
    return notReady()
  }

  // Reconstruct the user's picks from stored progression, through the domain.
  const picks = winnersFromProgression(r16, progression)

  // Knockout fixture metadata (venue + date) by ref.
  const metaByRef = new Map(
    data.matches
      .filter((m) => m.round !== 'group')
      .map((m) => [m.matchRef, m]),
  )
  const venueOf = (ref: string) => metaByRef.get(ref)?.venue ?? ''
  const placeholder = (feederRef: string): TieSide => ({
    kind: 'placeholder',
    feederRef,
    label: `Winner ${ROUND_LABEL[roundOfRef(feederRef)]} · ${venueOf(feederRef)} tie`,
  })

  const tieFor = (
    ref: string,
    round: RoundKey,
    home: TieSide,
    away: TieSide,
    homeDesc: string,
    awayDesc: string,
  ): BracketTie => {
    const meta = metaByRef.get(ref)
    const pickedTeamId =
      picks[ref] !== undefined &&
      ((home.kind === 'team' && home.teamId === picks[ref]) ||
        (away.kind === 'team' && away.teamId === picks[ref]))
        ? picks[ref]
        : null
    return {
      ref,
      round,
      provenance: `${ROUND_LABEL[round]} · ${homeDesc} v ${awayDesc}`,
      date: meta ? formatShortDate(meta.matchDate) : '',
      venue: meta?.venue ?? '',
      venueCountryCode: venueCountryCode(meta?.venue ?? ''),
      home,
      away,
      pickedTeamId,
      pickable: home.kind === 'team' && away.kind === 'team',
    }
  }

  // R16 ties — both sides are always resolved teams (from the group draw).
  const r16Ties: BracketTie[] = r16.map((f) =>
    tieFor(
      f.ref,
      'R16',
      teamSide(f.home.teamId),
      teamSide(f.away.teamId),
      describeSlot(f.home.slot),
      describeSlot(f.away.slot),
    ),
  )

  // Forward ties — a side is resolved when its feeder is picked, else a
  // placeholder. Feeder relationships come from KNOCKOUT_BRACKET.
  const forwardTies = (round: RoundKey): BracketTie[] =>
    KNOCKOUT_BRACKET.filter((m) => m.round === round).map((m) => {
      const home = picks[m.homeFrom] !== undefined ? teamSide(picks[m.homeFrom]) : placeholder(m.homeFrom)
      const away = picks[m.awayFrom] !== undefined ? teamSide(picks[m.awayFrom]) : placeholder(m.awayFrom)
      return tieFor(m.ref, round, home, away, `Winner ${m.homeFrom}`, `Winner ${m.awayFrom}`)
    })

  const roundTies: Record<RoundKey, BracketTie[]> = {
    R16: r16Ties,
    QF: forwardTies('QF'),
    SF: forwardTies('SF'),
    FINAL: forwardTies('FINAL'),
  }

  const rounds: BracketRoundView[] = ROUND_ORDER.map((key) => {
    const ties = roundTies[key]
    return {
      key,
      label: ROUND_LABEL[key],
      ties,
      picked: ties.filter((t) => t.pickedTeamId !== null).length,
      total: ties.length,
    }
  })

  const pickedCount = rounds.reduce((sum, r) => sum + r.picked, 0)
  const championId = picks['FINAL']
  const champion: BracketChampion | null =
    championId !== undefined
      ? { teamId: championId, name: nameById.get(championId) ?? championId, countryCode: '' }
      : null

  return { ready: true, rounds, winners: picks, pickedCount, total: TOTAL_PICKS, champion }
}
