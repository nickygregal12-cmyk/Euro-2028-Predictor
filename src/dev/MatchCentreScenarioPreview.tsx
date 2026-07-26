import { useParams } from 'react-router'
import {
  MATCH_CENTRE_SCENARIOS,
  type MatchCentreScenarioName,
} from '../domain/tournament/matchCentreScenarios'
import { bridgeExternalMatchToLegacyHeader } from '../domain/tournament/matchCentreLegacyBridge'
import { matchCentreLifecycleContent } from '../domain/tournament/matchCentreLifecycleContent'
import { MatchCentreScreen } from '../features/matches/MatchCentreScreen'

function isScenarioName(value: string | undefined): value is MatchCentreScenarioName {
  return Boolean(value && value in MATCH_CENTRE_SCENARIOS)
}

/**
 * Development-only browser harness for deterministic lifecycle and feed-quality
 * coverage. App.tsx registers this route only when import.meta.env.DEV is true,
 * so production builds do not expose or ship the preview.
 */
export function MatchCentreScenarioPreview() {
  const { scenario: requestedScenario } = useParams<{ scenario: string }>()
  const scenarioName: MatchCentreScenarioName = isScenarioName(requestedScenario)
    ? requestedScenario
    : 'scheduled'
  const scenario = MATCH_CENTRE_SCENARIOS[scenarioName]
  const header = bridgeExternalMatchToLegacyHeader(scenario.external)
  const lifecycleContent = matchCentreLifecycleContent(scenario.external.lifecycle)

  return (
    <MatchCentreScreen
      eyebrow={`Scenario · ${header.statusPresentation.label}`}
      venue={scenario.external.venue ?? 'Venue unavailable'}
      venueCountryCode={scenario.external.home.countryCode ?? 'gb-sct'}
      home={{
        name: scenario.external.home.name,
        countryCode: scenario.external.home.countryCode ?? 'gb-sct',
      }}
      away={{
        name: scenario.external.away.name,
        countryCode: scenario.external.away.countryCode ?? 'de',
      }}
      temporalState={header.temporalState}
      lifecycleContent={lifecycleContent}
      statusPresentation={header.statusPresentation}
      matchSource={scenario.external.source}
      result={header.result}
      countdownLabel={header.temporalState === 'before' ? 'Kick-off 9 Jun' : null}
      liveMinute={scenario.external.clockLabel}
      stake={{
        kind: 'group',
        stake: {
          pick: { homeScore: 1, awayScore: 1, joker: false },
          outcome: header.result ? 'correct' : 'unknown',
          points: header.result ? 3 : null,
        },
      }}
      scope={{ type: 'overall' }}
      leagues={[]}
      said={{ revealed: false, predicted: 8, total: 12 }}
      scoreEvents={[]}
    />
  )
}
