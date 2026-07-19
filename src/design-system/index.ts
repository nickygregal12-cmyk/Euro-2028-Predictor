// Design-system public API. Presentational components only.

export { Button } from './Button'
export type { ButtonProps, ButtonVariant } from './Button'

export { ScoreInput } from './ScoreInput'
export type { ScoreInputProps } from './ScoreInput'

export { TeamFlag } from './TeamFlag'
export type { TeamFlagProps, TeamFlagSize } from './TeamFlag'

export { JokerButton } from './JokerButton'
export type { JokerButtonProps, JokerButtonState } from './JokerButton'

export { JokerCounter } from './JokerCounter'
export type { JokerCounterProps } from './JokerCounter'

export { MatchCard } from './MatchCard'
export type {
  MatchCardProps,
  MatchCardState,
  MatchCardScore,
  SaveStatus,
  JokerState,
} from './MatchCard'

export { GroupTable } from './GroupTable'
export type { GroupTableProps, GroupTableRow } from './GroupTable'

export { ThirdPlaceTable } from './ThirdPlaceTable'
export type { ThirdPlaceTableProps, ThirdPlaceRow } from './ThirdPlaceTable'

export type { MatchTeam } from './types'
export { FEATURES } from './featureFlags'
