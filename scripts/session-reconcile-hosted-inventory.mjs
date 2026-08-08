import fs from 'node:fs'

const path = 'docs/ops/ops-pending-migrations.md'
let source = fs.readFileSync(path, 'utf8')

const currentStart = source.indexOf('## Current state')
const supersededStart = source.indexOf('\n## Superseded — 5 August 2026', currentStart)
if (currentStart < 0 || supersededStart < 0) throw new Error('Current/superseded inventory boundaries not found')

const current = `## Current state — 8 August 2026

The repository candidate is **contract 133**. Hosted Development and Production are both independently verified at **contract 132**, ending at \`20260807210812_provider_initial_fixture_approval\`; Contract 133 (\`20260808003000_private_season_cup_player_reads.sql\`) is therefore the only pending migration and remains repository-only until the guarded Development rollout is applied and verified. Production follows only through the separately controlled Production process.

The Contract 132 machine records had remained at 131 after the hosted rollouts, even though both migration ledgers had advanced. They were reconciled on 8 August 2026 from independent read-only ledger checks. This current section and the table below are live operating state; the dated superseded sections below remain historical evidence and are intentionally not rewritten.
`
source = source.slice(0, currentStart) + current + source.slice(supersededStart)
source = source.replace('| Repository `main` | **131** |', '| Repository candidate | **133** |')

const oldDev = '| Development Supabase `iouzoutneyjpugbbtdem` | **131** | Guarded fast-lane run `31186564948` applied canonical contracts 126–131 on 7 August 2026; workflow parity and an independent ledger read both end at `20260806220000_period_standings_display_names`. | LEVEL WITH REPOSITORY |'
const newDev = '| Development Supabase `iouzoutneyjpugbbtdem` | **132** | Independent read-only ledger verification on 8 August 2026 ends at `20260807210812_provider_initial_fixture_approval`. | ONE BEHIND CONTRACT-133 REPOSITORY CANDIDATE |'
const oldProd = '| Production Supabase | **131** | Guarded continuation run `31216257649` applied canonical batches C (97-114), D (115-125) and E (126-131); final and independent reads end at `20260806220000_period_standings_display_names`, with pg_net installed, six active cron jobs and zero provider poll targets. | LEVEL WITH REPOSITORY |'
const newProd = '| Production Supabase | **132** | Independent read-only ledger verification on 8 August 2026 ends at `20260807210812_provider_initial_fixture_approval`; application promotion remains separately controlled. | ONE BEHIND CONTRACT-133 REPOSITORY CANDIDATE |'
if (!source.includes(oldDev) || !source.includes(oldProd)) throw new Error('Expected hosted inventory rows not found')
source = source.replace(oldDev, newDev).replace(oldProd, newProd)
fs.writeFileSync(path, source)
