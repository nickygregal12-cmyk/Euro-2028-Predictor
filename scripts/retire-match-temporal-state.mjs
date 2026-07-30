import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function write(path, content) {
  fs.writeFileSync(path, content)
}

function replaceExact(path, from, to) {
  const content = read(path)
  const count = content.split(from).length - 1
  if (count !== 1) {
    throw new Error(`${path}: expected one occurrence, found ${count}: ${JSON.stringify(from)}`)
  }
  write(path, content.replace(from, to))
}

const domain = 'src/domain/tournament/matchCentre.ts'
const bridge = 'src/domain/tournament/matchCentreLegacyBridge.ts'
const pageModel = 'src/domain/tournament/matchCentrePageModel.ts'
const screen = 'src/features/matches/MatchCentreScreen.tsx'
const page = 'src/features/matches/MatchCentrePage.tsx'
const domainTest = 'tests/domain/matchCentre.test.ts'
const differential = 'tests/domain/matchCentreContext.differential.test.ts'

replaceExact(
  domain,
  `// --- Temporal state --------------------------------------------------------\n\nexport type MatchTemporalState = 'before' | 'during' | 'after'\n\n/**\n * Which of the three states a fixture is in. \`after\` once a result exists;\n * \`before\` otherwise. The \`during\` member is reserved for a real live-score\n * source: like the Match Centre adapter (matchCentreRepositoryAdapter), this\n * NEVER infers a live period merely because kickoff has passed — an absent or\n * delayed feed fails closed rather than showing a convincing live match.\n */\nexport function matchTemporalState(\n  match: { kickoffAt: string | null; homeScore: number | null; awayScore: number | null },\n): MatchTemporalState {\n  if (match.homeScore !== null && match.awayScore !== null) return 'after'\n  return 'before'\n}\n\n`,
  '',
)

replaceExact(bridge, "import type { MatchTemporalState } from './matchCentre'\n", '')
replaceExact(bridge, '  temporalState: MatchTemporalState\n', '')
replaceExact(
  bridge,
  `const LIVE_STATES = new Set<ExternalMatchData['lifecycle']>([\n  'LIVE_FIRST_HALF',\n  'HALF_TIME',\n  'LIVE_SECOND_HALF',\n  'EXTRA_TIME',\n  'PENALTIES',\n])\n\nexport function lifecycleToLegacyTemporalState(\n  lifecycle: ExternalMatchData['lifecycle'],\n): MatchTemporalState {\n  if (lifecycle === 'FULL_TIME' || lifecycle === 'CANCELLED') return 'after'\n  if (LIVE_STATES.has(lifecycle)) return 'during'\n  return 'before'\n}\n\n`,
  '',
)
replaceExact(bridge, '    temporalState: lifecycleToLegacyTemporalState(external.lifecycle),\n', '')

replaceExact(
  pageModel,
  "import type { MatchState } from '../competition/matchState'\n",
  "import type { MatchState } from '../competition/matchState'\nimport type { MatchLifecycleState } from './matchCentreContract'\n",
)
replaceExact(
  pageModel,
  `function kickoffLabel(kickoffAt: string): string {\n  const parsed = new Date(kickoffAt)\n  if (Number.isNaN(parsed.getTime())) return 'Kick-off time to be confirmed'\n  return \`Kick-off \${parsed.toLocaleDateString(undefined, {\n    day: 'numeric',\n    month: 'short',\n  })}\`\n}\n`,
  `function kickoffLabel(kickoffAt: string): string {\n  const parsed = new Date(kickoffAt)\n  if (Number.isNaN(parsed.getTime())) return 'Kick-off time to be confirmed'\n  return \`Kick-off \${parsed.toLocaleDateString(undefined, {\n    day: 'numeric',\n    month: 'short',\n  })}\`\n}\n\nconst COUNTDOWN_LIFECYCLES = new Set<MatchLifecycleState>([\n  'SCHEDULED',\n  'PRE_MATCH',\n  'POSTPONED',\n  'SUSPENDED',\n])\n\nexport function shouldShowMatchCentreCountdown(lifecycle: MatchLifecycleState): boolean {\n  return COUNTDOWN_LIFECYCLES.has(lifecycle)\n}\n`,
)
replaceExact(
  pageModel,
  `    countdownLabel:\n      screen.temporalState === 'before' ? kickoffLabel(viewModel.external.kickoffAt) : null,`,
  `    countdownLabel: shouldShowMatchCentreCountdown(viewModel.external.lifecycle)\n      ? kickoffLabel(viewModel.external.kickoffAt)\n      : null,`,
)

replaceExact(screen, '  MatchTemporalState,\n', '')
replaceExact(screen, '  temporalState: MatchTemporalState\n', '')
replaceExact(screen, '  const { home, away, result, temporalState } = props', '  const { home, away, result } = props')
replaceExact(
  screen,
  "  const live = props.statusPresentation?.isLive ?? temporalState === 'during'",
  '  const live = props.statusPresentation?.isLive ?? false',
)
replaceExact(
  screen,
  "  const showMatchImpact = props.lifecycleContent?.showMatchImpact ?? temporalState !== 'before'",
  '  const showMatchImpact = props.lifecycleContent?.showMatchImpact ?? false',
)
replaceExact(
  screen,
  `      {temporalState === 'before' && props.countdownLabel ? (\n        <p className={s.countdown}>{props.countdownLabel}</p>\n      ) : null}`,
  `      {props.countdownLabel ? (\n        <p className={s.countdown}>{props.countdownLabel}</p>\n      ) : null}`,
)

replaceExact(
  page,
  '  const { home, away, result, temporalState: temporal } = pageModel',
  '  const { home, away, result } = pageModel',
)
replaceExact(page, '      temporalState={temporal}\n', '')

replaceExact(domainTest, '  matchTemporalState,\n', '')
replaceExact(domainTest, "\nconst AT = (iso: string) => new Date(iso)\n", '\n')
replaceExact(
  domainTest,
  `describe('matchTemporalState', () => {\n  const kick = '2028-06-10T18:00:00Z'\n  it('is "after" once a result exists (regardless of clock)', () => {\n    expect(matchTemporalState({ kickoffAt: kick, homeScore: 2, awayScore: 1 })).toBe('after')\n  })\n  it('is "before" ahead of kickoff', () => {\n    expect(matchTemporalState({ kickoffAt: kick, homeScore: null, awayScore: null })).toBe('before')\n  })\n  it('never infers a live period from a passed kickoff — it fails closed to "before"', () => {\n    expect(matchTemporalState({ kickoffAt: '2020-01-01T00:00:00Z', homeScore: null, awayScore: null })).toBe('before')\n  })\n  it('is "before" when there is no kickoff time and no result', () => {\n    expect(matchTemporalState({ kickoffAt: null, homeScore: null, awayScore: null })).toBe('before')\n  })\n})\n\n`,
  '',
)

replaceExact(differential, "import { matchTemporalState } from '../../src/domain/tournament/matchCentre'\n", '')
replaceExact(
  differential,
  "describe('Match Centre temporal differential evidence', () => {",
  "describe('Match Centre captured shared-state evidence', () => {",
)
replaceExact(differential, "    expect(matchTemporalState(match)).toBe('before')\n", '')
replaceExact(differential, "    expect(matchTemporalState(match)).toBe('after')\n", '')

for (const path of [domain, bridge, pageModel, screen, page, domainTest, differential]) {
  const content = read(path)
  if (content.includes('MatchTemporalState') || content.includes('matchTemporalState(')) {
    throw new Error(`${path}: legacy temporal state remains`)
  }
}

fs.rmSync('scripts/retire-match-temporal-state.mjs')
fs.rmSync('.github/workflows/one-off-retire-match-temporal-state.yml')
