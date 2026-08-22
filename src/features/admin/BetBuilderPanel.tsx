import { useEffect, useMemo, useState } from 'react'
import {
  buildAccumulators,
  defaultRequest,
  type BuiltAccumulator,
  type Objective,
} from '../../domain/ai/betBuilder'
import { Alert, Button, Skeleton } from '../../design-system'
import { AI_LAB_LEAGUES } from '../../services/supabase/aiLabModel'
import {
  fetchBetBuilderBookmakers,
  fetchBetBuilderCandidates,
  type BetBuilderCandidates,
  type BookmakerSummary,
} from '../../services/supabase/betBuilder'
import { userFacingError } from '../../shared/errors/userFacingError'
import styles from './BetBuilderPanel.module.css'

/**
 * The Bet Builder is a combination layer over server-approved value legs.
 *
 * It never manufactures a bet, relaxes the value gate or mixes prices from
 * different bookmakers. The default is deliberately probability-first: the old
 * UI opened on "Biggest return", which made the most speculative valid
 * combination look like the Lab's recommendation. High return remains
 * available, but it is an explicit choice rather than the first answer.
 */

const LEG_CHOICES = [
  { legs: 1, label: 'Single' },
  { legs: 2, label: 'Double' },
  { legs: 3, label: 'Treble' },
  { legs: 4, label: '4-fold' },
  { legs: 5, label: '5-fold' },
] as const

const GOALS: readonly { key: Objective; label: string; description: string }[] = [
  {
    key: 'safety',
    label: 'Recommended',
    description:
      'Probability-first. Among selections that already passed the value gate, prefer the combination the model estimates is most likely to land.',
  },
  {
    key: 'value',
    label: 'Best value',
    description:
      'Prioritises expected value. A leg can be good value without being the most likely result in its match.',
  },
  {
    key: 'confidence',
    label: 'Best evidenced',
    description:
      'Prioritises the strength of the evidence behind the legs, not the payout or raw chance alone.',
  },
  {
    key: 'return',
    label: 'High return',
    description:
      'Prioritises combined odds. This is the most speculative mode and says nothing about how likely the combination is to land.',
  },
]

export type DateWindow = 'today' | 'tomorrow' | 'saturday3pm' | 'weekend' | 'week'

const DATE_CHOICES: readonly { key: DateWindow; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'saturday3pm', label: 'Saturday 3pm' },
  { key: 'weekend', label: 'All weekend' },
  { key: 'week', label: 'Next 7 days' },
]

const SATURDAY_BLOCK_FROM_HOUR = 14.5
const SATURDAY_BLOCK_TO_HOUR = 17

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function windowFor(choice: DateWindow, now: Date): { from: Date; to: Date } {
  const today = startOfDay(now)
  if (choice === 'today') {
    const end = new Date(today)
    end.setDate(end.getDate() + 1)
    return { from: now, to: end }
  }
  if (choice === 'tomorrow') {
    const from = new Date(today)
    from.setDate(from.getDate() + 1)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    return { from, to }
  }
  if (choice === 'saturday3pm') {
    const from = new Date(today)
    from.setDate(from.getDate() + ((6 - from.getDay() + 7) % 7))
    const to = new Date(from)
    from.setHours(
      Math.floor(SATURDAY_BLOCK_FROM_HOUR),
      (SATURDAY_BLOCK_FROM_HOUR % 1) * 60,
      0,
      0,
    )
    to.setHours(SATURDAY_BLOCK_TO_HOUR, 0, 0, 0)
    if (to <= now) {
      from.setDate(from.getDate() + 7)
      to.setDate(to.getDate() + 7)
    }
    return { from, to }
  }
  if (choice === 'weekend') {
    const from = new Date(today)
    from.setDate(from.getDate() + ((6 - from.getDay() + 7) % 7))
    const to = new Date(from)
    to.setDate(to.getDate() + 2)
    return { from: from < now ? now : from, to }
  }
  const to = new Date(today)
  to.setDate(to.getDate() + 7)
  return { from: now, to }
}

function money(value: number): string {
  return `£${value.toFixed(2)}`
}

function percent(value: number | null, digits = 0): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function when(value: string | null): string {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function selectionLabel(selection: string, home: string, away: string): string {
  if (selection === 'H') return `${home} to win`
  if (selection === 'A') return `${away} to win`
  return `${home} v ${away} — draw`
}

export function chooseBetBuilderBookmaker(
  rows: readonly BookmakerSummary[],
  requestedLegs: number,
  current: string | null,
): string | null {
  const actionable = rows.filter((row) => row.isRealPrice)
  const currentRow = actionable.find((row) => row.code === current)
  if (currentRow && currentRow.legs >= requestedLegs) return currentRow.code

  const enough = actionable.filter((row) => row.legs >= requestedLegs)
  const pool = enough.length ? enough : actionable
  return [...pool].sort((a, b) => b.legs - a.legs || a.code.localeCompare(b.code))[0]?.code ?? null
}

type Loaded =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; candidates: BetBuilderCandidates }

export function BetBuilderPanel() {
  const [books, setBooks] = useState<readonly BookmakerSummary[] | null>(null)
  const [booksError, setBooksError] = useState<string | null>(null)
  const [bookmaker, setBookmaker] = useState<string | null>(null)
  const [leagues, setLeagues] = useState<readonly string[]>([])
  const [dateWindow, setDateWindow] = useState<DateWindow>('week')
  const [stake, setStake] = useState(10)
  const [legs, setLegs] = useState(2)
  const [objective, setObjective] = useState<Objective>('safety')
  const [minLegProbability, setMinLegProbability] = useState<number | null>(null)
  const [minDataConfidence, setMinDataConfidence] = useState<number | null>(null)
  const [excludeTeams, setExcludeTeams] = useState('')
  const [state, setState] = useState<Loaded>({ kind: 'idle' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setBooksError(null)
    fetchBetBuilderBookmakers()
      .then((rows) => {
        if (!active) return
        setBooks(rows)
        setBookmaker((current) => chooseBetBuilderBookmaker(rows, legs, current))
      })
      .catch((error: unknown) => {
        if (active) setBooksError(userFacingError(error, 'Bookmakers could not be read.'))
      })
    return () => {
      active = false
    }
  }, [reload, legs])

  useEffect(() => {
    if (!bookmaker) return
    let active = true
    setState({ kind: 'loading' })
    const { from, to } = windowFor(dateWindow, new Date())
    fetchBetBuilderCandidates({
      bookmaker,
      leagues: leagues.length ? leagues : null,
      from,
      to,
    })
      .then((candidates) => {
        if (active) setState({ kind: 'ready', candidates })
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: 'failed',
            message: userFacingError(error, 'Current value selections could not be read.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [bookmaker, leagues, dateWindow, reload])

  const registry = useMemo(
    () =>
      (books ?? []).map((row) => ({
        code: row.code,
        name: row.name,
        kind: row.kind,
        isRealPrice: row.isRealPrice,
        exchangeCommission: row.exchangeCommission,
      })),
    [books],
  )

  const built = useMemo(() => {
    if (state.kind !== 'ready') return null
    return buildAccumulators(
      state.candidates.legs,
      defaultRequest({
        legs,
        objective,
        stake,
        minLegProbability,
        minDataConfidence,
        excludeTeams: excludeTeams
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
        bookmaker,
        results: 5,
      }),
      registry,
    )
  }, [
    state,
    legs,
    objective,
    stake,
    minLegProbability,
    minDataConfidence,
    excludeTeams,
    bookmaker,
    registry,
  ])

  const actionable = built?.accumulators.filter((acc) => acc.actionable) ?? []
  const selectedBook = books?.find((row) => row.code === bookmaker) ?? null
  const activeFilterCount = [
    leagues.length > 0,
    minLegProbability !== null,
    minDataConfidence !== null,
    excludeTeams.trim() !== '',
  ].filter(Boolean).length
  const goal = GOALS.find((choice) => choice.key === objective) ?? GOALS[0]

  return (
    <div className={styles.builder}>
      <header className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>Paper research · value-qualified legs only</span>
          <h2>Build a combination</h2>
          <p>
            This starts with selections the server has already judged to be genuine current value.
            It never forces a bet when there are not enough qualifying legs.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
          Refresh
        </Button>
      </header>

      {booksError ? <Alert variant="warning">{booksError}</Alert> : null}

      <section className={styles.controls} aria-label="Bet Builder controls">
        <div className={styles.primaryControls}>
          <label>
            Stake
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={stake}
              onChange={(event) => setStake(Number(event.target.value) || 0)}
            />
          </label>
          <label>
            Legs
            <select value={legs} onChange={(event) => setLegs(Number(event.target.value))}>
              {LEG_CHOICES.map((choice) => (
                <option key={choice.legs} value={choice.legs}>{choice.label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className={styles.fieldset}>
          <legend>What do you want?</legend>
          <div className={styles.chips}>
            {GOALS.map((choice) => (
              <button
                type="button"
                key={choice.key}
                aria-pressed={objective === choice.key}
                onClick={() => setObjective(choice.key)}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <p className={styles.explanation}>{goal.description}</p>
          {objective === 'return' ? (
            <p className={styles.riskNote}>
              High return deliberately favours bigger prices. It is not the Lab's recommended mode.
            </p>
          ) : null}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>When?</legend>
          <div className={styles.chips}>
            {DATE_CHOICES.map((choice) => (
              <button
                type="button"
                key={choice.key}
                aria-pressed={dateWindow === choice.key}
                onClick={() => setDateWindow(choice.key)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>

        <details className={styles.more}>
          <summary>
            More filters{activeFilterCount ? ` (${activeFilterCount} active)` : ''}
          </summary>
          <div className={styles.moreGrid}>
            <label>
              Bookmaker
              <select
                aria-label="Bookmaker"
                value={bookmaker ?? ''}
                onChange={(event) => setBookmaker(event.target.value || null)}
              >
                {(books ?? []).filter((book) => book.isRealPrice).map((book) => (
                  <option key={book.code} value={book.code}>
                    {book.name} · {book.legs} current legs
                  </option>
                ))}
              </select>
            </label>
            <label>
              Minimum model chance
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="No extra minimum"
                value={minLegProbability === null ? '' : Math.round(minLegProbability * 100)}
                onChange={(event) => {
                  const raw = event.target.value
                  setMinLegProbability(raw === '' ? null : Math.max(0, Math.min(1, Number(raw) / 100)))
                }}
              />
            </label>
            <label>
              Minimum data confidence
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                placeholder="Server gate only"
                value={minDataConfidence === null ? '' : Math.round(minDataConfidence * 100)}
                onChange={(event) => {
                  const raw = event.target.value
                  setMinDataConfidence(raw === '' ? null : Math.max(0, Math.min(1, Number(raw) / 100)))
                }}
              />
            </label>
            <label>
              Exclude teams
              <input
                type="text"
                placeholder="Team A, Team B"
                value={excludeTeams}
                onChange={(event) => setExcludeTeams(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.leagueFilters} aria-label="League filters">
            {AI_LAB_LEAGUES.map((item) => {
              const active = leagues.includes(item.key)
              return (
                <button
                  type="button"
                  key={item.key}
                  aria-pressed={active}
                  onClick={() =>
                    setLeagues((current) =>
                      current.includes(item.key)
                        ? current.filter((key) => key !== item.key)
                        : [...current, item.key],
                    )
                  }
                >
                  {item.name}
                </button>
              )
            })}
          </div>
        </details>
      </section>

      {state.kind === 'loading' ? (
        <div className={styles.loading} role="status" aria-label="Loading Bet Builder">
          <Skeleton height={110} radius="card" />
          <Skeleton height={220} radius="card" />
        </div>
      ) : null}

      {state.kind === 'failed' ? (
        <Alert variant="warning" title="Builder unavailable">{state.message}</Alert>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <section className={styles.coverage} aria-label="Bet Builder evidence coverage">
            <div>
              <span>Fixtures checked</span>
              <strong>{state.candidates.coverage.fixturesInWindow}</strong>
            </div>
            <div>
              <span>Current decisions</span>
              <strong>{state.candidates.coverage.withCurrentDecision}</strong>
            </div>
            <div>
              <span>Value anywhere</span>
              <strong>{state.candidates.coverage.actionableAnywhere}</strong>
            </div>
            <div>
              <span>At {selectedBook?.name ?? state.candidates.bookmaker.name}</span>
              <strong>{state.candidates.coverage.actionableAtThisBook}</strong>
            </div>
          </section>

          {actionable.length ? (
            <section className={styles.results} aria-label="Bet Builder results">
              <div className={styles.resultsHeading}>
                <div>
                  <span className={styles.eyebrow}>{goal.label}</span>
                  <h3>{legs === 1 ? 'Current selection' : `Current ${LEG_CHOICES.find((c) => c.legs === legs)?.label ?? `${legs}-fold`}`}</h3>
                </div>
                <p>{actionable.length} ranked result{actionable.length === 1 ? '' : 's'}</p>
              </div>
              <div className={styles.resultGrid}>
                {actionable.map((acc, index) => (
                  <CombinationCard key={combinationKey(acc)} acc={acc} rank={index + 1} />
                ))}
              </div>
            </section>
          ) : (
            <section className={styles.empty}>
              <strong>No combination clears these constraints</strong>
              <p>
                That is a valid answer. The Lab will not add weaker selections merely to fill a
                {legs === 1 ? ' single' : ` ${legs}-leg combination`}.
              </p>
              {built?.answerWhenEmpty ? <small>{built.answerWhenEmpty}</small> : null}
              {state.candidates.coverage.passed > 0 ? (
                <p>
                  {state.candidates.coverage.passed} fixture{state.candidates.coverage.passed === 1 ? '' : 's'} currently have PASS decisions from the value gate.
                </p>
              ) : null}
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}

function combinationKey(acc: BuiltAccumulator): string {
  return acc.legs.map((leg) => `${leg.fixtureId}:${leg.selection}`).join('|')
}

function CombinationCard({ acc, rank }: { acc: BuiltAccumulator; rank: number }) {
  return (
    <article className={styles.combo}>
      <header>
        <span>#{rank}</span>
        <div>
          <strong>{acc.combinedOdds.toFixed(2)}</strong>
          <small>combined odds</small>
        </div>
        <div>
          <strong>{percent(acc.estimatedJointProbability, 1)}</strong>
          <small>model chance</small>
        </div>
      </header>
      <ul>
        {acc.legs.map((leg) => (
          <li key={`${leg.fixtureId}:${leg.selection}`}>
            <div>
              <strong>{selectionLabel(leg.selection, leg.home, leg.away)}</strong>
              <span>{leg.home} v {leg.away} · {when(leg.kickoffAt)}</span>
            </div>
            <div className={styles.legNumbers}>
              <strong>{leg.odds.toFixed(2)}</strong>
              <span>{percent(leg.probability, 0)}</span>
            </div>
          </li>
        ))}
      </ul>
      <footer>
        <div><span>Stake</span><strong>{money(acc.stake)}</strong></div>
        <div><span>Return if it lands</span><strong>{money(acc.estimatedTotalReturn)}</strong></div>
        <div><span>Profit if it lands</span><strong>{money(acc.estimatedProfit)}</strong></div>
        <div><span>Estimated EV</span><strong>{percent(acc.expectedValue, 1)}</strong></div>
      </footer>
      <p className={styles.bookNote}>{acc.actionableNote}</p>
    </article>
  )
}
