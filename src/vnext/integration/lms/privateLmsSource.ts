import type { PrivateCompetitionWorkspace } from '../../../services/supabase/privateCompetitionWorkspace'
import type { SeasonMatchweekFixtures } from '../../../services/supabase/seasonFixtures'
import type { SeasonTeamId } from '../../../services/supabase/seasonTeamIds'

export type PrivateLmsSource = {
  readonly generatedAt: string
  readonly context: {
    readonly tournamentId: string
    readonly competitionName: string
    readonly seasonLabel: string
  }
  readonly workspace: PrivateCompetitionWorkspace
  readonly fixtures: SeasonMatchweekFixtures | null
  readonly clubs: readonly SeasonTeamId[]
}
