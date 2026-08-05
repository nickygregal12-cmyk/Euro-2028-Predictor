#!/usr/bin/env -S node --experimental-strip-types
/**
 * Provider bake-off — compare all three providers on the same real fixtures.
 *
 * Stage D's first open item is "confirm provider terms, coverage, timezone and
 * exceptional-state mappings with dated evidence". This harness produces the
 * COVERAGE half of that evidence. It cannot produce the terms half: no API
 * response tells you whether you are allowed to store it, and this
 * architecture archives exact raw response text by design. Read the licences.
 *
 * ---------------------------------------------------------------------------
 * WHY IT USES THE COMMITTED DECODERS
 * ---------------------------------------------------------------------------
 *
 * It imports `supabase/functions/provider-poll/providerDecoders.ts` — the same
 * module the deployed Edge Function runs — rather than parsing the responses
 * its own way. A bake-off scored by a bespoke parser tells you which provider
 * suits the parser somebody wrote for the bake-off. This one tells you which
 * provider the shipped decoder can actually read, and a decode failure here is
 * a real finding rather than a harness bug.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT SCORES, AND WHY THOSE THINGS
 * ---------------------------------------------------------------------------
 *
 * Not "which API is nicest". Specifically what this schema cannot work without:
 *
 *   ROUND       `season_fixtures.competition_round_id` is NOT NULL and points
 *               at `competition_rounds`. The season Match Predictor is played
 *               by matchweek. A provider that does not emit a matchday number
 *               cannot place a fixture at all, and no amount of other quality
 *               compensates. This is the sharpest single criterion.
 *
 *   KICKOFF     Locks are derived from the earliest kickoff in a matchweek, so
 *               a timezone error is a lock-correctness error — someone's card
 *               opens or shuts at the wrong moment — not a display nit.
 *
 *   STATUS      `season_fixtures.status` allows exactly
 *               scheduled / played / postponed / abandoned / void, and
 *               `matchweekSettlement.ts` treats the last two as completely
 *               different events: an ABANDONED fixture carries the prediction
 *               to the replay in full, a VOID one leaves the matches-played
 *               denominator entirely. Most feeds do not distinguish them, and
 *               several have no "void" at all. Every raw status this harness
 *               sees is reported with the mapping it would need, and anything
 *               unmapped is printed as an open question rather than guessed.
 *
 *   SCORES      Must be the full-time score of the league fixture. Extra time
 *               or penalties folded into the same field is a scoring defect
 *               waiting to happen.
 *
 *   TEAMS       Stable identifiers, so a fixture survives a rename.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WILL NOT DO
 * ---------------------------------------------------------------------------
 *
 * No database writes of any kind. It does not touch `provider_raw_responses`,
 * `provider_response_processing`, `season_fixtures` or anything else — the
 * custody RPCs are the Edge Function's job, and a comparison harness has no
 * business writing official-adjacent storage. It archives to local files.
 *
 * It never prints a credential, and it reads them only from the environment.
 *
 * ---------------------------------------------------------------------------
 * RUNNING IT
 * ---------------------------------------------------------------------------
 *
 *   SPORTMONKS_API_TOKEN=...  \
 *   API_FOOTBALL_API_KEY=...  \
 *   FOOTBALL_DATA_API_KEY=... \
 *   node --experimental-strip-types scripts/ops/provider-bakeoff.ts \
 *     --competition premier-league --from 2026-08-14 --to 2026-08-18
 *
 * A provider whose key is absent is SKIPPED and said to be skipped. Partial
 * results are the normal case while you are still acquiring keys, and a
 * harness that refuses to run without all three would be useless for exactly
 * the question you are asking.
 *
 * Point it at a window containing FINISHED fixtures to learn anything about
 * the status vocabulary and scores. A window of scheduled fixtures tells you
 * about coverage and rounds only — which is still the sharpest criterion, but
 * it is half the picture.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  decodeProviderPayload,
  ProviderDecodeError,
  type NormalizedFixture,
  type ProviderName,
} from '../../supabase/functions/provider-poll/providerDecoders.ts'

// ---------------------------------------------------------------------------
// Competitions
//
// The identifiers are provider-specific and are the single most likely thing
// to be wrong or out of date here, so they are declared in one visible place
// and overridable. The harness reports what it actually received rather than
// assuming the id meant what the table says.
//
// The Scottish Premiership is deliberately included and is the discriminating
// case: free and entry tiers commonly carry the large European leagues and not
// the SPFL, and this platform seeds BOTH `Premier League 2026/27` and
// `Scottish Premiership 2026/27` as competition seasons. A provider that
// cannot supply the second one does not cover this product.
// ---------------------------------------------------------------------------

type CompetitionKey = 'premier-league' | 'scottish-premiership'

export const COMPETITIONS: Record<
  CompetitionKey,
  { label: string; seasonRow: string; ids: Record<ProviderName, string | null> }
> = {
  'premier-league': {
    label: 'English Premier League',
    seasonRow: 'Premier League 2026/27',
    ids: { sportmonks: '8', 'api-football': '39', 'football-data': 'PL' },
  },
  'scottish-premiership': {
    label: 'Scottish Premiership',
    seasonRow: 'Scottish Premiership 2026/27',
    ids: { sportmonks: '501', 'api-football': '179', 'football-data': 'SPL' },
  },
}

// The season a provider wants named. Only api-football requires it in the
// query; the others infer it from the date window.
const SEASON_YEAR = '2026'

// ---------------------------------------------------------------------------
// Status vocabulary
//
// The mapping this schema needs, stated rather than inferred. Anything a
// provider returns that is not in here is reported as unmapped — which is a
// finding to take to the provider's documentation, not a value to guess at.
//
// Note what is missing on purpose: almost nothing maps to `void`. A fixture
// that will never be played, with its result expunged, is usually a
// competition ruling rather than a feed state, and pretending a provider
// tells you would put a wrong denominator into everyone's points-per-game.
// ---------------------------------------------------------------------------

/**
 * The five values `season_fixtures_status_allowed` permits. Duplicated here on
 * purpose so a test can assert the mapping never targets something the
 * database would reject — the failure mode otherwise is an ingestion that
 * looks correct until the first suspended match of the season.
 */
export const ALLOWED_FIXTURE_STATUSES = [
  'scheduled',
  'played',
  'postponed',
  'abandoned',
  'void',
] as const

export const STATUS_MAP: Record<string, string> = {
  // football-data
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  IN_PLAY: 'scheduled',
  PAUSED: 'scheduled',
  FINISHED: 'played',
  POSTPONED: 'postponed',
  SUSPENDED: 'abandoned',
  CANCELLED: 'void',
  AWARDED: 'played',
  // api-football
  TBD: 'scheduled',
  NS: 'scheduled',
  '1H': 'scheduled',
  HT: 'scheduled',
  '2H': 'scheduled',
  ET: 'scheduled',
  BT: 'scheduled',
  P: 'scheduled',
  FT: 'played',
  AET: 'played',
  PEN: 'played',
  SUSP: 'abandoned',
  INT: 'abandoned',
  PST: 'postponed',
  CANC: 'void',
  ABD: 'abandoned',
  AWD: 'played',
  WO: 'played',
  // SportMonks returns a numeric state_id, which this harness cannot map
  // without the states endpoint. That is itself a finding: an integration
  // against SportMonks needs a second lookup before it can settle a matchweek.
}

// ---------------------------------------------------------------------------

type ProviderCall = {
  url: string
  headers: Record<string, string>
}

function buildCall(
  provider: ProviderName,
  competitionId: string,
  from: string,
  to: string,
  secret: string,
): ProviderCall {
  switch (provider) {
    case 'sportmonks':
      return {
        // `participants` and `scores` are includes, not defaults. Without them
        // the committed decoder throws on every row — which is a genuine
        // integration cost worth seeing rather than papering over.
        url:
          `https://api.sportmonks.com/v3/football/fixtures/between/${from}/${to}`
          + `?filters=fixtureLeagues:${competitionId}&include=participants;scores`,
        headers: { Authorization: secret },
      }
    case 'api-football':
      return {
        url:
          `https://v3.football.api-sports.io/fixtures`
          + `?league=${competitionId}&season=${SEASON_YEAR}&from=${from}&to=${to}`,
        headers: { 'x-apisports-key': secret },
      }
    case 'football-data':
      return {
        url:
          `https://api.football-data.org/v4/competitions/${competitionId}/matches`
          + `?dateFrom=${from}&dateTo=${to}`,
        headers: { 'X-Auth-Token': secret },
      }
  }
}

const SECRET_NAMES: Record<ProviderName, string> = {
  sportmonks: 'SPORTMONKS_API_TOKEN',
  'api-football': 'API_FOOTBALL_API_KEY',
  'football-data': 'FOOTBALL_DATA_API_KEY',
}

const RATE_LIMIT_HEADERS = [
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'x-requests-limit',
  'x-requests-remaining',
  'x-requests-reset',
]

type Assessment = {
  provider: ProviderName
  skipped?: string
  httpStatus?: number
  transportError?: string
  decodeError?: string
  rawBytes?: number
  rateLimit?: Record<string, string>
  fixtures?: number
  withRound?: number
  withKickoff?: number
  withScores?: number
  distinctTeams?: number
  rawStatuses?: string[]
  unmappedStatuses?: string[]
  archivePath?: string
}

async function assess(
  provider: ProviderName,
  competition: CompetitionKey,
  from: string,
  to: string,
  outDir: string,
): Promise<Assessment> {
  const secret = process.env[SECRET_NAMES[provider]]
  if (!secret) {
    return { provider, skipped: `${SECRET_NAMES[provider]} is not set` }
  }
  const competitionId = COMPETITIONS[competition].ids[provider]
  if (!competitionId) {
    return { provider, skipped: `no ${provider} identifier declared for ${competition}` }
  }

  const call = buildCall(provider, competitionId, from, to, secret)

  let response: Response
  try {
    response = await fetch(call.url, {
      method: 'GET',
      headers: { accept: 'application/json', ...call.headers },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    return {
      provider,
      transportError: error instanceof Error ? error.message : String(error),
    }
  }

  // Archive before decode, mirroring the custody rule the Edge Function
  // follows. If the decode below throws, the exact bytes that caused it are
  // already on disk and can be replayed.
  const rawBody = await response.text()
  const archivePath = resolve(outDir, `${provider}.json`)
  writeFileSync(archivePath, rawBody)

  const rateLimit: Record<string, string> = {}
  for (const name of RATE_LIMIT_HEADERS) {
    const value = response.headers.get(name)
    if (value !== null) rateLimit[name] = value
  }

  const base: Assessment = {
    provider,
    httpStatus: response.status,
    rawBytes: Buffer.byteLength(rawBody),
    rateLimit,
    archivePath,
  }

  if (!response.ok) return base

  let fixtures: NormalizedFixture[]
  try {
    fixtures = decodeProviderPayload(provider, JSON.parse(rawBody))
  } catch (error) {
    return {
      ...base,
      decodeError:
        error instanceof ProviderDecodeError || error instanceof Error
          ? error.message
          : String(error),
    }
  }

  const rawStatuses = [...new Set(fixtures.map((fixture) => fixture.status))].sort()
  const teams = new Set(
    fixtures.flatMap((fixture) => [
      fixture.homeTeamProviderId,
      fixture.awayTeamProviderId,
    ]),
  )

  return {
    ...base,
    fixtures: fixtures.length,
    withRound: fixtures.filter((fixture) => fixture.roundProviderId !== null).length,
    withKickoff: fixtures.filter((fixture) => fixture.kickoffAt !== null).length,
    withScores: fixtures.filter((fixture) => fixture.homeScore !== null).length,
    distinctTeams: teams.size,
    rawStatuses,
    unmappedStatuses: rawStatuses.filter((status) => !(status in STATUS_MAP)),
  }
}

function report(
  assessments: Assessment[],
  competition: CompetitionKey,
  from: string,
  to: string,
): string {
  const detail = COMPETITIONS[competition]
  const lines: string[] = [
    `# Provider bake-off — ${detail.label}`,
    '',
    `Window \`${from}\` to \`${to}\`. Season row \`${detail.seasonRow}\`.`,
    'Decoded by the committed `providerDecoders.ts`, the same module the',
    'deployed Edge Function runs. No database was written.',
    '',
    '| Provider | HTTP | Fixtures | With round | With kickoff | With scores | Teams | Decode |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]

  for (const item of assessments) {
    if (item.skipped) {
      lines.push(`| \`${item.provider}\` | — | — | — | — | — | — | skipped: ${item.skipped} |`)
      continue
    }
    if (item.transportError) {
      lines.push(`| \`${item.provider}\` | — | — | — | — | — | — | transport: ${item.transportError} |`)
      continue
    }
    lines.push(
      `| \`${item.provider}\` | ${item.httpStatus} | ${item.fixtures ?? '—'} `
        + `| ${item.withRound ?? '—'} | ${item.withKickoff ?? '—'} `
        + `| ${item.withScores ?? '—'} | ${item.distinctTeams ?? '—'} `
        + `| ${item.decodeError ? `FAILED — ${item.decodeError}` : item.httpStatus === 200 ? 'ok' : '—'} |`,
    )
  }

  lines.push('', '## Status vocabulary observed', '')
  for (const item of assessments) {
    if (!item.rawStatuses) continue
    lines.push(`- \`${item.provider}\`: ${item.rawStatuses.map((s) => `\`${s}\``).join(', ') || 'none'}`)
    if (item.unmappedStatuses?.length) {
      lines.push(
        `  - **unmapped, needs a decision:** `
          + item.unmappedStatuses.map((s) => `\`${s}\``).join(', '),
      )
    }
  }

  lines.push('', '## Rate limits as reported', '')
  for (const item of assessments) {
    if (!item.rateLimit || Object.keys(item.rateLimit).length === 0) continue
    lines.push(
      `- \`${item.provider}\`: `
        + Object.entries(item.rateLimit).map(([k, v]) => `${k}=${v}`).join(', '),
    )
  }

  lines.push(
    '',
    '## What this does not tell you',
    '',
    'Whether you are permitted to store any of it. This platform archives exact',
    'raw response text and keeps it; several licences allow the call and not the',
    'retention, and one that forbids retention makes the custody control itself a',
    'breach — discovered after the data is stored. That question is answered by',
    'reading the licence, not by running this.',
    '',
    'The round column is the one to read first. A provider that cannot supply a',
    'matchday number cannot place a fixture in this schema at all.',
    '',
  )
  return lines.join('\n')
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

async function main() {
  const competition = argument('competition', 'premier-league') as CompetitionKey
  if (!(competition in COMPETITIONS)) {
    console.error(
      `Unknown competition "${competition}". Known: ${Object.keys(COMPETITIONS).join(', ')}`,
    )
    process.exit(2)
  }

  const today = new Date()
  const from = argument('from', today.toISOString().slice(0, 10))
  const to = argument(
    'to',
    new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10),
  )
  const outDir = resolve(
    argument('out', `provider-bakeoff/${competition}-${from}-to-${to}`),
  )
  mkdirSync(outDir, { recursive: true })

  const providers: ProviderName[] = ['sportmonks', 'api-football', 'football-data']
  const assessments: Assessment[] = []
  for (const provider of providers) {
    // Sequential on purpose. Three concurrent calls can trip a per-minute
    // limit on an entry tier and turn a coverage question into a 429.
    assessments.push(await assess(provider, competition, from, to, outDir))
  }

  const markdown = report(assessments, competition, from, to)
  const reportPath = resolve(outDir, 'report.md')
  writeFileSync(reportPath, markdown)
  writeFileSync(resolve(outDir, 'assessments.json'), JSON.stringify(assessments, null, 2))

  console.log(markdown)
  console.log(`Raw responses and report written to ${outDir}`)
}

// Only when run directly. A test importing the tables above must not fire off
// three provider requests as a side effect of the import.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
