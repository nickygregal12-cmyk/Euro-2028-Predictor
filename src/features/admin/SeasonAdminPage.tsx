import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Skeleton, TextInput } from '../../design-system'
import {
  fetchHubMembership,
  type HubSeasonMembership,
} from '../../services/supabase/competitionGames'
import { fetchSeasonMatchweekFixtures } from '../../services/supabase/seasonFixtures'
import {
  openSeasonCompetition,
  recordSeasonFixtureResult,
  type SeasonResultAction,
} from '../../services/supabase/seasonAdmin'
import { HUB_COMPETITIONS, type HubCompetition } from '../hub/competitionCatalogue'
import {
  openOutcomeMessage,
  openableGames,
  presentSeasonReadiness,
  seasonAdminRefusal,
  type SeasonReadiness,
} from './seasonAdminModel'
import styles from './SeasonAdminPage.module.css'

/**
 * `/admin/season` — Development competition administration (`DFA-009`).
 *
 * WHAT IT IS FOR. Two of the protected authorities this repository has built
 * had no caller anywhere: nothing in a browser could open a season competition
 * for play, and nothing could give a season fixture a result. Both are operator
 * actions by design — contract 127 makes opening one because the launch fixes
 * the draw at whatever field size it finds, and contract 125 keeps result
 * confirmation outside provider automation entirely — so the missing piece was
 * always a surface, not a job. Without it the `DFA-007` rehearsal cannot be run
 * by a person at all.
 *
 * NEVER A SECOND RULES ENGINE. Every refusal comes back from the server and is
 * reported; none is predicted here. The one thing the page reads for itself is
 * a fixture's stored status, which decides whether it offers Confirm or Correct
 * and Clear — the same stored fact the server reads, not a guess about it.
 *
 * IT RELOADS AFTER EVERY WRITE. The RPCs return what they did, not the new
 * state of the matchweek, and a page that patched its own list from a write's
 * return value would be maintaining a second copy of the truth. One extra read
 * on an operator surface is cheap; disagreeing with the database is not.
 *
 * WHAT IT DELIBERATELY DOES NOT OFFER, both because the browser cannot see what
 * it would be acting on:
 *
 *   • provider fixture approval (contract 132). `admin_approve_initial_provider_
 *     fixtures` is granted, but nothing exposes the STAGED PROPOSALS, so the
 *     control would be a button to approve a list nobody can read. It needs a
 *     read before it needs a button;
 *   • disqualifying an entrant. `admin_disqualify_competition_game_entry` is
 *     granted and no browser read enumerates a competition's entrants, so the
 *     surface could not name who it was about to remove.
 *
 * Both are named in the interface rather than silently absent, because an
 * operator who cannot see a capability assumes it does not exist.
 */

type FixturesState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; readiness: SeasonReadiness }

type Draft = { home: string; away: string; reason: string }

const EMPTY_DRAFT: Draft = { home: '', away: '', reason: '' }

function seasonsWithGames(): readonly HubCompetition[] {
  // The catalogue holds only currently published domestic seasons — Euro 2028
  // is deliberately absent from it — which is exactly the set this page
  // administers. A season row the database does not hold resolves to nothing
  // below and is reported rather than assumed.
  return HUB_COMPETITIONS
}

function parseScore(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null
  return Number.parseInt(value.trim(), 10)
}

export function SeasonAdminPage() {
  const seasons = useMemo(seasonsWithGames, [])
  const [selected, setSelected] = useState<HubCompetition>(seasons[0] as HubCompetition)
  const [membership, setMembership] = useState<HubSeasonMembership | null>(null)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [matchweek, setMatchweek] = useState(1)
  const [fixtures, setFixtures] = useState<FixturesState>({ status: 'loading' })
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setMembership(null)
    setMembershipError(null)
    fetchHubMembership([selected.seasonRowName])
      .then((rows) => {
        if (!active) return
        const row = rows.find((entry) => entry.seasonName === selected.seasonRowName) ?? null
        setMembership(row)
        if (!row) {
          // Not an empty state. The catalogue names rows the C1b migration
          // created, so a miss means this environment does not hold the season
          // — which an operator needs told, not hidden behind "no games".
          setMembershipError(
            `This environment holds no season row named "${selected.seasonRowName}".`,
          )
        }
      })
      .catch((error: unknown) => {
        if (active) setMembershipError(seasonAdminRefusal(error))
      })
    return () => {
      active = false
    }
  }, [selected, reload])

  const tournamentId = membership?.tournamentId ?? null
  const seasonResolved = membership !== null || membershipError !== null

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setFixtures({ status: 'loading' })
    fetchSeasonMatchweekFixtures(tournamentId, matchweek)
      .then((page) => {
        if (active) setFixtures({ status: 'ready', readiness: presentSeasonReadiness(page) })
      })
      .catch((error: unknown) => {
        if (active) setFixtures({ status: 'failed', message: seasonAdminRefusal(error) })
      })
    return () => {
      active = false
    }
  }, [tournamentId, matchweek, reload])

  const draftFor = useCallback(
    (fixtureId: string): Draft => drafts[fixtureId] ?? EMPTY_DRAFT,
    [drafts],
  )

  function setDraft(fixtureId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [fixtureId]: { ...(current[fixtureId] ?? EMPTY_DRAFT), ...patch },
    }))
  }

  async function submitResult(fixtureId: string, action: SeasonResultAction) {
    const draft = draftFor(fixtureId)
    setBusy(fixtureId)
    setNotice(null)
    try {
      const home = parseScore(draft.home)
      const away = parseScore(draft.away)
      await recordSeasonFixtureResult({
        fixtureId,
        action,
        // Sent as given, including absent. The server refuses a result with a
        // missing score and says so; refusing here first would be this page
        // holding an opinion about the rule.
        ...(action === 'clear' ? {} : { home: home ?? undefined, away: away ?? undefined }),
        reason: draft.reason,
      })
      setNotice({ tone: 'success', text: 'The result was recorded.' })
      setDrafts((current) => ({ ...current, [fixtureId]: EMPTY_DRAFT }))
      setReload((n) => n + 1)
    } catch (error: unknown) {
      setNotice({ tone: 'warning', text: seasonAdminRefusal(error) })
    } finally {
      setBusy(null)
    }
  }

  async function openCompetition(competitionId: string) {
    setBusy(competitionId)
    setNotice(null)
    try {
      const outcome = await openSeasonCompetition(competitionId)
      setNotice({
        // Every outcome is reported the same way. "Already open" is not a
        // failure and "no schedulable round" is not a success, and an operator
        // needs to read both rather than have one dressed as the other.
        tone: outcome.outcome === 'opened' ? 'success' : 'warning',
        text: openOutcomeMessage(outcome),
      })
      setReload((n) => n + 1)
    } catch (error: unknown) {
      setNotice({ tone: 'warning', text: seasonAdminRefusal(error) })
    } finally {
      setBusy(null)
    }
  }

  // A season that resolved to nothing must not leave the matchweek panel
  // spinning for ever: a permanent skeleton reads as a slow environment rather
  // than an absent season, and the two need different actions from an operator.
  //
  // DERIVED DURING RENDER RATHER THAN SET FROM AN EFFECT, which is how the
  // first version did it and why a test caught it intermittently: two effects
  // settling in two passes meant one paint of skeleton after the membership
  // read had already answered. There is nothing asynchronous about "there is no
  // season" once the membership read has returned.
  const fixturesView: FixturesState = tournamentId
    ? fixtures
    : seasonResolved
      ? { status: 'failed', message: 'There is no season here to read a matchweek from.' }
      : { status: 'loading' }

  const readiness = fixturesView.status === 'ready' ? fixturesView.readiness : null
  const games = membership ? openableGames(membership.seasonGames.games) : []

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="season-admin-heading">
        <h1 className={styles.heading} id="season-admin-heading">
          Competition administration
        </h1>
        <p className={styles.caption}>
          Development readiness and the setup actions the protected server
          authorities already permit. Every rule stays on the server; this states
          what it answered.
        </p>
        <div className={styles.chooser} role="group" aria-label="Season">
          {seasons.map((season) => (
            <button
              key={season.seasonRowName}
              type="button"
              aria-pressed={season.seasonRowName === selected.seasonRowName}
              className={
                season.seasonRowName === selected.seasonRowName
                  ? styles.seasonButtonActive
                  : styles.seasonButton
              }
              onClick={() => {
                setSelected(season)
                setMatchweek(1)
                setNotice(null)
              }}
            >
              {season.name} {season.seasonLabel}
            </button>
          ))}
        </div>
      </section>

      {notice ? (
        <Alert variant={notice.tone === 'success' ? 'success' : 'warning'}>{notice.text}</Alert>
      ) : null}

      {membershipError ? <Alert variant="warning">{membershipError}</Alert> : null}

      <section className={styles.panel} aria-labelledby="season-games-heading">
        <h2 className={styles.heading} id="season-games-heading">
          Open a competition for play
        </h2>
        <p className={styles.caption}>
          Idempotent: a competition that already holds a calendar or a draw
          reports that and is left exactly as it stands.
        </p>
        {membership === null && membershipError === null ? (
          <Skeleton height={72} radius="card" />
        ) : null}
        <ul className={styles.list}>
          {games.map((game) => (
            <li className={styles.row} key={game.competitionId}>
              <div className={styles.gameRow}>
                <span className={styles.gameName}>{game.name}</span>
                <Button
                  variant="secondary"
                  disabled={busy !== null || game.unavailable !== null}
                  onClick={() => void openCompetition(game.competitionId)}
                >
                  Open for play
                </Button>
              </div>
              {game.unavailable ? <p className={styles.caption}>{game.unavailable}</p> : null}
            </li>
          ))}
        </ul>
        {membership !== null && games.length === 0 ? (
          <p className={styles.caption}>This season runs no games yet.</p>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="season-results-heading">
        <h2 className={styles.heading} id="season-results-heading">
          Matchweek results
        </h2>

        <div className={styles.stepper}>
          <Button
            variant="secondary"
            disabled={matchweek <= 1}
            onClick={() => setMatchweek((week) => Math.max(1, week - 1))}
          >
            Previous
          </Button>
          <p className={styles.matchweek}>
            Matchweek {matchweek}
            {readiness ? ` of ${readiness.matchweekCount}` : ''}
          </p>
          <Button
            variant="secondary"
            disabled={readiness !== null && matchweek >= readiness.matchweekCount}
            onClick={() => setMatchweek((week) => week + 1)}
          >
            Next
          </Button>
        </div>

        {fixturesView.status === 'loading' ? (
          <div aria-busy="true" aria-live="polite">
            <span className={styles.srOnly}>Loading this matchweek</span>
            <Skeleton height={180} radius="card" />
          </div>
        ) : null}

        {fixturesView.status === 'failed' ? (
          <Alert variant="warning" title="This matchweek could not be loaded">
            {fixturesView.message}
          </Alert>
        ) : null}

        {readiness ? (
          <>
            <dl className={styles.readiness}>
              <div className={styles.figure}>
                <dt>Fixtures</dt>
                <dd>{readiness.fixtures}</dd>
              </div>
              <div className={styles.figure}>
                <dt>With a result</dt>
                <dd>{readiness.withResult}</dd>
              </div>
              <div className={styles.figure}>
                <dt>No kickoff yet</dt>
                <dd>{readiness.withoutKickoff}</dd>
              </div>
            </dl>
            {readiness.withoutKickoff > 0 ? (
              <p className={styles.caption}>
                A round cannot be scheduled until every fixture in it has a
                confirmed kickoff, so a competition opened against this matchweek
                will report that it has no schedulable round.
              </p>
            ) : null}

            <ul className={styles.list}>
              {readiness.rows.map((row) => {
                const draft = draftFor(row.id)
                return (
                  <li className={styles.row} key={row.id}>
                    <div className={styles.rowHeader}>
                      <span className={styles.fixture}>{row.label}</span>
                      <span className={styles.status}>
                        {row.score ? <span className={styles.score}>{row.score}</span> : row.status}
                      </span>
                    </div>

                    {row.actions.length === 0 ? (
                      <p className={styles.caption}>
                        The server calls this fixture “{row.status}”, which offers
                        no result action.
                      </p>
                    ) : (
                      // A fieldset rather than repeated fixture-qualified
                      // labels. Every row's fields are "Home", "Away" and
                      // "Reason", so the fixture has to reach a screen reader
                      // some other way, and a group legend is how — labels
                      // reading "Rangers v Hibernian: home score" would be
                      // correct and unreadable at nine fixtures a matchweek.
                      <fieldset className={styles.controls}>
                        <legend className={styles.srOnly}>{row.label}</legend>

                        {row.actions.includes('confirm') || row.actions.includes('correct') ? (
                          <span className={styles.scores}>
                            <TextInput
                              label="Home"
                              inputMode="numeric"
                              value={draft.home}
                              onChange={(event) =>
                                setDraft(row.id, { home: event.target.value })
                              }
                            />
                            <span aria-hidden="true">–</span>
                            <TextInput
                              label="Away"
                              inputMode="numeric"
                              value={draft.away}
                              onChange={(event) =>
                                setDraft(row.id, { away: event.target.value })
                              }
                            />
                          </span>
                        ) : null}

                        <span className={styles.reason}>
                          <TextInput
                            label={row.reasonRequired ? 'Reason' : 'Reason (optional)'}
                            value={draft.reason}
                            onChange={(event) => setDraft(row.id, { reason: event.target.value })}
                          />
                        </span>

                        {row.actions.map((action) => (
                          <Button
                            key={action}
                            variant={action === 'clear' ? 'destructive' : 'primary'}
                            disabled={busy !== null}
                            onClick={() => void submitResult(row.id, action)}
                          >
                            {action === 'confirm'
                              ? 'Confirm'
                              : action === 'correct'
                                ? 'Correct'
                                : 'Clear'}
                          </Button>
                        ))}
                      </fieldset>
                    )}
                  </li>
                )
              })}
            </ul>

            {readiness.fixtures === 0 ? (
              <p className={styles.caption}>This matchweek holds no fixtures.</p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="season-admin-gaps-heading">
        <h2 className={styles.heading} id="season-admin-gaps-heading">
          Not offered here, and why
        </h2>
        <p className={styles.caption}>
          Approving a provider’s initial calendar and disqualifying an entrant are
          both permitted by the server and are absent from this page on purpose:
          no browser read exposes the staged fixture proposals, or a
          competition’s entrants, so either control would be acting on a list
          nobody can see. Each needs a read before it needs a button.
        </p>
      </section>
    </div>
  )
}
