export type PrivateLmsChoice = {
  readonly key: string
  readonly teamId: string
  readonly name: string
  readonly fixtureId: string
  readonly kickoffAt: string | null
}

export type PrivateLmsRoundState =
  | 'no-round'
  | 'not-entered'
  | 'not-open'
  | 'open'
  | 'picked'
  | 'locked'
  | 'eliminated'

export type PrivateLmsPageModel = {
  readonly context: {
    readonly competitionName: string
    readonly seasonLabel: string
    readonly privateCompetitionName: string
  }
  readonly round: {
    readonly label: string | null
    readonly opensAt: string | null
    readonly locksAt: string | null
    readonly state: PrivateLmsRoundState
  }
  readonly memberCount: number
  readonly inviteCode: string | null
  readonly choices: readonly PrivateLmsChoice[]
}
