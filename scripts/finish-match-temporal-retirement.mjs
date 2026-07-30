import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function write(path, content) {
  fs.writeFileSync(path, content)
}

function replaceCount(path, from, to, expected = 1) {
  const content = read(path)
  const count = content.split(from).length - 1
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} occurrences, found ${count}: ${JSON.stringify(from)}`)
  }
  write(path, content.split(from).join(to))
}

const components = 'src/dev/ComponentsPreview.tsx'
const scenarios = 'src/dev/MatchCentreScenarioPreview.tsx'
const screen = 'src/features/matches/MatchCentreScreen.tsx'
const matches = 'src/features/matches/MatchesPage.tsx'

replaceCount(
  components,
  "import { MatchCentreScreen } from '../features/matches/MatchCentreScreen'\n",
  "import { MatchCentreScreen } from '../features/matches/MatchCentreScreen'\nimport { matchCentreLifecycleContent } from '../domain/tournament/matchCentreLifecycleContent'\nimport { presentMatchLifecycle } from '../domain/tournament/matchCentrePresentation'\n",
)
replaceCount(
  components,
  '          temporalState="after"\n',
  "          lifecycleContent={matchCentreLifecycleContent('FULL_TIME')}\n          statusPresentation={presentMatchLifecycle('FULL_TIME')}\n",
  3,
)
replaceCount(
  components,
  '          temporalState="before"\n',
  "          lifecycleContent={matchCentreLifecycleContent('SCHEDULED')}\n          statusPresentation={presentMatchLifecycle('SCHEDULED')}\n",
)
replaceCount(
  components,
  '          temporalState="during"\n',
  "          lifecycleContent={matchCentreLifecycleContent('LIVE_SECOND_HALF')}\n          statusPresentation={presentMatchLifecycle('LIVE_SECOND_HALF')}\n",
)

replaceCount(
  scenarios,
  "import { matchCentreLifecycleContent } from '../domain/tournament/matchCentreLifecycleContent'\n",
  "import { matchCentreLifecycleContent } from '../domain/tournament/matchCentreLifecycleContent'\nimport { shouldShowMatchCentreCountdown } from '../domain/tournament/matchCentrePageModel'\n",
)
replaceCount(scenarios, '    temporalState: header.temporalState,\n', '')
replaceCount(
  scenarios,
  "    countdownLabel: header.temporalState === 'before' ? 'Kick-off 9 Jun' : null,",
  "    countdownLabel: shouldShowMatchCentreCountdown(scenario.external.lifecycle)\n      ? 'Kick-off 9 Jun'\n      : null,",
)

replaceCount(
  screen,
  "      {showMatchImpact && temporalState === 'after' && props.consequence && props.consequence.casualties > 0 ? (",
  "      {showMatchImpact &&\n      props.statusPresentation?.isTerminal &&\n      props.consequence &&\n      props.consequence.casualties > 0 ? (",
)

replaceCount(
  matches,
  "import { matchTemporalState, groupStake, koStake } from '../../domain/tournament/matchCentre'",
  "import { groupStake, koStake } from '../../domain/tournament/matchCentre'",
)
replaceCount(
  matches,
  "    const td = data.data\n    const letterOf = (groupId: string | null) => td.groups.find((g) => g.id === groupId)?.letter ?? null\n",
  "    const td = data.data\n    const nowServer = new Date()\n    const competition = resolveTournamentCompetitionContext({\n      data: td,\n      submitted: preds.submittedAt !== null,\n      entryComplete: false,\n      nowServer,\n      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',\n    })\n    const resolvedMatchState = new Map(\n      competition.context.matches.map((candidate) => [candidate.id, candidate.state]),\n    )\n    const letterOf = (groupId: string | null) => td.groups.find((g) => g.id === groupId)?.letter ?? null\n",
)
replaceCount(
  matches,
  '      const state = matchTemporalState(match)\n',
  "      const sharedState = resolvedMatchState.get(match.id)\n      const state: FixtureRowVM['state'] =\n        sharedState === 'confirmed' || sharedState === 'scored'\n          ? 'after'\n          : sharedState === 'in_play_feed'\n            ? 'during'\n            : 'before'\n",
)
replaceCount(
  matches,
  "    const nowServer = new Date()\n    const competition = resolveTournamentCompetitionContext({\n      data: td,\n      submitted: preds.submittedAt !== null,\n      entryComplete: false,\n      nowServer,\n      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',\n    })\n    const scrollToKey = filter === 'all' && viewModels.length\n",
  "    const scrollToKey = filter === 'all' && viewModels.length\n",
)

for (const path of [components, scenarios, screen, matches]) {
  const content = read(path)
  if (content.includes('temporalState') || content.includes('matchTemporalState')) {
    throw new Error(`${path}: legacy temporal state remains`)
  }
}

fs.rmSync('scripts/finish-match-temporal-retirement.mjs')
fs.rmSync('.github/workflows/one-off-finish-match-temporal-retirement.yml')
