// Assembles the bracket "survivors" rows (the converging funnel on the full-
// bracket card) from the bracket pipeline's rounds. Pure: rounds + a team
// resolver in, survivor stages out. The R16 row is the teams predicted to WIN
// their R16 (i.e. reach QF), QF → reach SF, SF → the two finalists — flag size
// grows with depth in the renderer.

import type { ShareSurvivorStage, ShareTeam } from './shareModel'

type RoundLike = { key: string; ties: { pickedTeamId: string | null }[] }

export function survivorsFromRounds(
  rounds: RoundLike[],
  teamOf: (teamId: string) => ShareTeam | null,
): ShareSurvivorStage[] {
  const rowFor = (key: string, stage: ShareSurvivorStage['stage']): ShareSurvivorStage => {
    const round = rounds.find((r) => r.key === key)
    const teams = (round?.ties ?? [])
      .map((t) => t.pickedTeamId)
      .filter((id): id is string => !!id)
      .map(teamOf)
      .filter((t): t is ShareTeam => t !== null)
    return { stage, teams }
  }
  return [rowFor('R16', 'R16'), rowFor('QF', 'QF'), rowFor('SF', 'SF')].filter((r) => r.teams.length > 0)
}
