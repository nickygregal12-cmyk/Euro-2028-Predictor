import { useMemo, useState } from 'react'
import styles from './SeasonPreview.module.css'
import {
  ClubIdentity,
  ClubMatchCard,
  LeagueTable,
  type ClubMatchCardState,
  type LeagueTableRow,
  type LeagueZone,
} from '../design-system'
import {
  MATCHWEEK_COUNT,
  PREVIEW_GAMES,
  PREVIEW_INSTANTS,
  SEASON_CLUBS,
  SEASON_CONFIG,
  SEASON_STANDINGS,
  fixturesForMatchweek,
  instantFor,
  matchweekScopeId,
  resolveSeasonPreview,
  type PreviewGameKey,
} from './seasonPreviewFixture'

/**
 * A league season, rendered from the real competition engine (DEV only).
 *
 * Everything a person can currently click in this application is the Euro
 * tournament, which makes the season half of the platform impossible to have an
 * opinion about. This page exists so there is something to react to before the
 * competition-season schema lands — not to ship, and not to pre-empt the
 * schema's design.
 *
 * The distinction that matters: **the rules on this page are real and the data
 * is not.** The lock state, the phase and every match state come from
 * `resolveCompetitionContext` in `src/domain/competition/`, given a
 * `LeagueSeasonCompetitionConfig`. Nothing here reimplements them, and nothing
 * here branches on "is this a season?" — the differences fall out of the config.
 *
 * What is missing is as informative as what is here, so it is stated on the page
 * rather than discovered later:
 *
 * - **there is no season match card.** `MatchCard` is nation-shaped: it takes a
 *   `venueCountryCode`, renders `TeamFlag`, and labels fixtures by group and
 *   matchday. Club fixtures need a sibling, which is a real design-system piece
 *   nobody has built. The rows below are preview-local scaffolding, deliberately
 *   plain so they are not mistaken for a component;
 * - **standings are written down, not computed.** Season standings and scoring
 *   are open authorities (ADR 0012/0013), and a preview must not be where a rule
 *   gets invented;
 * - **nothing is persisted.** There is no season schema, so there is nothing to
 *   read from or write to.
 */

const ZONES: LeagueZone[] = [
  { from: 1, to: 1, kind: 'champion', label: 'Champions' },
  { from: 2, to: 4, kind: 'europe', label: 'Champions League' },
  { from: 5, to: 5, kind: 'playoff', label: 'Europa League' },
  { from: 18, to: 20, kind: 'relegation', label: 'Relegation' },
]

const CLUBS_BY_ID = new Map(SEASON_CLUBS.map((club) => [club.id, club]))

const STANDINGS_ROWS: LeagueTableRow[] = SEASON_STANDINGS.map((row) => {
  const club = CLUBS_BY_ID.get(row.clubId)
  return {
    position: row.position,
    name: club?.name ?? row.clubId,
    club: club?.tokens ?? { monogram: row.clubId, primary: '#666666' },
    played: row.played,
    goalDifference: row.goalDifference,
    points: row.points,
    movement: row.movement,
  }
})

/**
 * Kickoff in the *competition's* zone, never the viewer's.
 *
 * The competition owns its calendar — which matchweek a fixture belongs to
 * cannot have two answers — so this formats with `SEASON_CONFIG.competitionTimeZone`
 * rather than letting the device decide.
 */
function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SEASON_CONFIG.competitionTimeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function SeasonPreview() {
  const [matchweek, setMatchweek] = useState(5)
  const [game, setGame] = useState<PreviewGameKey>('main-predictor')
  const [instantKey, setInstantKey] = useState('hour-before')
  const [feedAvailable, setFeedAvailable] = useState(true)
  const [submitted, setSubmitted] = useState(true)
  const [missingFixtureData, setMissingFixtureData] = useState(false)
  const [staleFixtureData, setStaleFixtureData] = useState(false)
  // Page-local draft scores for the editable cards. Deliberately not
  // persisted: there is no season prediction schema yet, and this preview
  // must not pretend otherwise.
  const [draftScores, setDraftScores] = useState<
    Record<string, { home: number | null; away: number | null }>
  >({})

  const offsetMinutes =
    PREVIEW_INSTANTS.find((instant) => instant.key === instantKey)?.offsetMinutes ?? -60
  const now = useMemo(
    () => instantFor(matchweek, offsetMinutes),
    [matchweek, offsetMinutes],
  )

  const context = useMemo(
    () =>
      resolveSeasonPreview(now, {
        matchweek,
        game,
        feedAvailable,
        submitted,
        missingFixtureData,
        staleFixtureData,
      }),
    [now, matchweek, game, feedAvailable, submitted, missingFixtureData, staleFixtureData],
  )

  // The same season and instant under each game's own lock policy, side by
  // side — the visible proof that the season owns no buffer of its own.
  const lockComparison = useMemo(
    () =>
      (Object.keys(PREVIEW_GAMES) as PreviewGameKey[]).map((key) => ({
        key,
        game: PREVIEW_GAMES[key],
        lock: resolveSeasonPreview(now, {
          matchweek,
          game: key,
          feedAvailable,
          submitted,
          missingFixtureData,
          staleFixtureData,
        }).lockScopes[matchweekScopeId(matchweek)],
      })),
    [now, matchweek, feedAvailable, submitted, missingFixtureData, staleFixtureData],
  )

  const fixtures = fixturesForMatchweek(matchweek)
  const scopeLock = context.lockScopes[matchweekScopeId(matchweek)]
  const stateByMatch = new Map(context.matches.map((match) => [match.id, match]))

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <h1 className={styles.h1}>{SEASON_CONFIG.name}</h1>
        <p className={styles.sub}>
          A synthetic league season driven by the real competition engine. The rules are
          real; the data is not. Nothing here is persisted, and nothing here ships.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Scenario</h2>
          <div className={styles.controls}>
            <label className={styles.control}>
              Matchweek
              <select
                value={matchweek}
                onChange={(event) => setMatchweek(Number(event.target.value))}
              >
                {Array.from({ length: MATCHWEEK_COUNT }, (_, index) => index + 1).map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.control}>
              Game
              <select
                value={game}
                onChange={(event) => setGame(event.target.value as PreviewGameKey)}
              >
                {(Object.keys(PREVIEW_GAMES) as PreviewGameKey[]).map((key) => (
                  <option key={key} value={key}>
                    {PREVIEW_GAMES[key].name} — lock buffer{' '}
                    {PREVIEW_GAMES[key].lockPolicy.bufferMinutes} min
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.control}>
              Now, relative to first kickoff
              <select value={instantKey} onChange={(event) => setInstantKey(event.target.value)}>
                {PREVIEW_INSTANTS.map((instant) => (
                  <option key={instant.key} value={instant.key}>
                    {instant.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.toggles}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={feedAvailable}
                  onChange={(event) => setFeedAvailable(event.target.checked)}
                />
                Feed available
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={submitted}
                  onChange={(event) => setSubmitted(event.target.checked)}
                />
                Entry submitted
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={missingFixtureData}
                  onChange={(event) => setMissingFixtureData(event.target.checked)}
                />
                Fixture data missing
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={staleFixtureData}
                  onChange={(event) => setStaleFixtureData(event.target.checked)}
                />
                Fixture data stale
              </label>
            </div>
          </div>
          <p className={styles.note}>
            The lock is the thing to watch, and it belongs to the game, not the season. The
            Main Predictor locks each matchweek exactly at its earliest kickoff, with no
            buffer; Last Man Standing locks the same matchweek 30 minutes earlier — on the
            same season configuration, at the same instant. Matchweek {matchweek + 1} stays
            open while matchweek {matchweek} is shut. No component branches on any of that;
            it comes from the selected game&apos;s own <code>lockPolicy</code>.
          </p>

          <div className={styles.readout}>
            {lockComparison.map(({ key, game: comparedGame, lock }) => (
              <div key={key} className={styles.cell}>
                <span className={styles.cellLabel}>
                  {comparedGame.name} ({comparedGame.lockPolicy.bufferMinutes}-min buffer)
                </span>
                <span className={styles.cellValue}>
                  {lock ? `${lock.status} — ${lock.reason}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Resolved context</h2>
          <div className={styles.readout}>
            {[
              ['Competition kind', context.competitionKind],
              ['Phase', `${context.competitionPhase.state} / ${context.competitionPhase.stageKind ?? '—'}`],
              ['Day state', context.dayState],
              ['Entry state', context.entryState],
              ['Next action', context.nextUserAction],
              ['Matchweek lock', scopeLock ? `${scopeLock.status} — ${scopeLock.reason}` : '—'],
              ['Lock config valid', String(context.lockConfigurationValid)],
              ['Live now', String(context.liveMatches.length)],
            ].map(([label, value]) => (
              <div key={label} className={styles.cell}>
                <span className={styles.cellLabel}>{label}</span>
                <span className={styles.cellValue}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Matchweek {matchweek}</h2>
          <div className={styles.fixtures}>
            {fixtures.map((fixture) => {
              const resolved = stateByMatch.get(fixture.id)
              const cardState: ClubMatchCardState | null =
                resolved?.state === 'scheduled_editable'
                  ? 'editable'
                  : resolved?.state === 'scheduled_locked'
                    ? 'locked'
                    : null

              if (cardState === null) {
                // In-play, awaiting-confirmation and scored presentation is
                // Match Centre work; the plain row keeps those states honest.
                return (
                  <div key={fixture.id} className={styles.fixture}>
                    <span className={styles.kickoff}>{formatKickoff(fixture.kickoffAt)}</span>
                    <span className={styles.state}>{resolved?.state ?? '—'}</span>
                    {[fixture.home, fixture.away].map((club, index) => (
                      <span key={club.id} className={styles.side}>
                        <ClubIdentity name={club.name} tokens={club.tokens} size="table" />
                        {club.name}
                        {index === 0 ? <span className="sr-only">versus</span> : null}
                      </span>
                    ))}
                  </div>
                )
              }

              const draft = draftScores[fixture.id]
              return (
                <ClubMatchCard
                  key={fixture.id}
                  state={cardState}
                  matchweek={matchweek}
                  kickoff={formatKickoff(fixture.kickoffAt)}
                  home={{ name: fixture.home.name, tokens: fixture.home.tokens }}
                  away={{ name: fixture.away.name, tokens: fixture.away.tokens }}
                  homeScore={draft?.home ?? null}
                  awayScore={draft?.away ?? null}
                  onHomeScoreChange={(value) =>
                    setDraftScores((current) => ({
                      ...current,
                      [fixture.id]: { home: value, away: current[fixture.id]?.away ?? null },
                    }))
                  }
                  onAwayScoreChange={(value) =>
                    setDraftScores((current) => ({
                      ...current,
                      [fixture.id]: { home: current[fixture.id]?.home ?? null, away: value },
                    }))
                  }
                  countdown={cardState === 'locked' ? 'soon' : undefined}
                />
              )
            })}
          </div>
          <p className={styles.note}>
            Editable and locked fixtures now render through <code>ClubMatchCard</code> — the
            club sibling of the nation-shaped <code>MatchCard</code>: club identity marks
            instead of flags, a matchweek eyebrow instead of group and matchday, and no
            per-fixture Joker control because the domestic Joker doubles the whole matchweek.
            Scores typed here live in this page only; nothing is persisted. In-play and
            scored presentation remains Match Centre work and stays a plain row.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Standings</h2>
          <LeagueTable
            caption={`${SEASON_CONFIG.name} table`}
            rows={STANDINGS_ROWS}
            zones={ZONES}
          />
          <p className={styles.note}>
            Written down, not computed. Season standings and scoring are open authorities
            (ADR 0012 and ADR 0013), and this preview is not where either gets decided.
          </p>
        </section>
      </div>
    </main>
  )
}
