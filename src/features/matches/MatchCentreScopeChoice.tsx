import { ChoiceSheet } from '../../design-system'
import type { MatchScope } from './MatchCentreScreen'

type MatchCentreScopeChoiceProps = {
  scope: MatchScope
  leagues: { id: string; name: string }[]
  onScopeChange?: (scope: MatchScope) => void
}

/**
 * Branded replacement for the native league select used by Match Centre.
 * Keeps the conversion between a simple selected value and the richer
 * MatchScope union out of the screen component.
 */
export function MatchCentreScopeChoice({
  scope,
  leagues,
  onScopeChange,
}: MatchCentreScopeChoiceProps) {
  return (
    <ChoiceSheet
      label="Prediction scope"
      value={scope.type === 'league' ? scope.id : 'overall'}
      options={[
        { value: 'overall', label: 'Overall' },
        ...leagues.map((league) => ({ value: league.id, label: league.name })),
      ]}
      onChange={(value) => {
        if (value === 'overall') {
          onScopeChange?.({ type: 'overall' })
          return
        }

        const league = leagues.find((candidate) => candidate.id === value)
        if (!league) return

        onScopeChange?.({
          type: 'league',
          id: league.id,
          name: league.name,
        })
      }}
    />
  )
}
