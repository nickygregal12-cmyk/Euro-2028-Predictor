import fs from 'node:fs'

const IMPORT_FROM = "import { isEntryLocked } from '../../domain/tournament/entryLock'"
const IMPORT_TO = "import { useTournamentEntryLocked } from '../shared/useTournamentEntryLocked'"

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function write(path, content) {
  fs.writeFileSync(path, content)
}

function replaceExact(path, from, to) {
  const content = read(path)
  const occurrences = content.split(from).length - 1
  if (occurrences !== 1) {
    throw new Error(`${path}: expected exactly one occurrence, found ${occurrences}: ${JSON.stringify(from)}`)
  }
  write(path, content.replace(from, to))
}

function migrateImport(path) {
  replaceExact(path, IMPORT_FROM, IMPORT_TO)
}

const files = {
  account: 'src/features/account/AccountPage.tsx',
  h2h: 'src/features/h2h/H2HPage.tsx',
  league: 'src/features/leagues/LeagueDetailPage.tsx',
  group: 'src/features/predict/GroupPredictorPage.tsx',
  entry: 'src/features/predict/PredictEntryPage.tsx',
  hub: 'src/features/predict/PredictHubPage.tsx',
  review: 'src/features/predict/ReviewPage.tsx',
  workspace: 'src/features/predict/ReviewWorkspacePage.tsx',
  profile: 'src/features/profile/ProfilePage.tsx',
  share: 'src/features/share/useShareModel.ts',
  trends: 'src/features/trends/PredictionTrendsPage.tsx',
}

for (const path of Object.values(files)) migrateImport(path)

replaceExact(
  files.account,
  '  const preds = usePredictions()\n',
  '  const preds = usePredictions()\n  const entryLocked = useTournamentEntryLocked(true)\n',
)
replaceExact(
  files.account,
  "data.status === 'ready' ? isEntryLocked(data.data.tournament.lockAt) : true",
  "data.status === 'ready' ? entryLocked : true",
)

replaceExact(
  files.h2h,
  '  const preds = usePredictions()\n',
  '  const preds = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(files.h2h, 'locked: isEntryLocked(td.tournament.lockAt)', 'locked: entryLocked')
replaceExact(files.h2h, '  }, [data, preds])', '  }, [data, preds, entryLocked])')

replaceExact(
  files.league,
  '  const tournament = useTournamentData()\n',
  '  const tournament = useTournamentData()\n  const revealed = useTournamentEntryLocked()\n',
)
replaceExact(
  files.league,
  "  const lockAt = tournament.status === 'ready' ? tournament.data.tournament.lockAt : null\n",
  '',
)
replaceExact(files.league, '  const revealed = isEntryLocked(lockAt)\n', '')

replaceExact(
  files.group,
  '  const preds = usePredictions()\n',
  '  const preds = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(
  files.group,
  '  const locked = isEntryLocked(data.data.tournament.lockAt)',
  '  const locked = entryLocked',
)

replaceExact(
  files.entry,
  '  const predictions = usePredictions()\n',
  '  const predictions = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(
  files.entry,
  '    !isEntryLocked(tournament.data.tournament.lockAt) ||',
  '    !entryLocked ||',
)

replaceExact(
  files.hub,
  '  const preds = usePredictions()\n',
  '  const preds = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(
  files.hub,
  '  const locked = isEntryLocked(data.data.tournament.lockAt)',
  '  const locked = entryLocked',
)

replaceExact(
  files.review,
  '  const preds = usePredictions()\n',
  '  const preds = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(
  files.review,
  '  const locked = isEntryLocked(data.data.tournament.lockAt)',
  '  const locked = entryLocked',
)

replaceExact(
  files.workspace,
  '  const predictions = usePredictions()\n',
  '  const predictions = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(
  files.workspace,
  "  const locked =\n    tournament.status === 'ready'\n      ? isEntryLocked(tournament.data.tournament.lockAt)\n      : false",
  '  const locked = tournament.status === \'ready\' ? entryLocked : false',
)

replaceExact(
  files.profile,
  '  const preds = usePredictions()\n',
  '  const preds = usePredictions()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(files.profile, '    const locked = isEntryLocked(td.tournament.lockAt)', '    const locked = entryLocked')
replaceExact(
  files.profile,
  '  }, [data, preds, ready, reloadKey, tournamentId])',
  '  }, [data, preds, ready, reloadKey, tournamentId, entryLocked])',
)

replaceExact(
  files.share,
  '  const auth = useAuth()\n',
  '  const auth = useAuth()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(files.share, '  const locked = isEntryLocked(td.tournament.lockAt)', '  const locked = entryLocked')

replaceExact(
  files.trends,
  '  const tournament = useTournamentData()\n',
  '  const tournament = useTournamentData()\n  const entryLocked = useTournamentEntryLocked()\n',
)
replaceExact(
  files.trends,
  "  const locked = tournament.status === 'ready' && isEntryLocked(tournament.data.tournament.lockAt)",
  "  const locked = tournament.status === 'ready' && entryLocked",
)

for (const path of Object.values(files)) {
  const content = read(path)
  if (content.includes('isEntryLocked(') || content.includes("domain/tournament/entryLock")) {
    throw new Error(`${path}: legacy entry-lock caller remains`)
  }
}

fs.rmSync('scripts/migrate-entry-lock-callers.mjs')
fs.rmSync('.github/workflows/one-off-entry-lock-migration.yml')
