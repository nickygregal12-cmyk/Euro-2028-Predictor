import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextPlayerProfileScreen } from '../vnext/integration/playerProfile/VNextPlayerProfileScreen'
import { VNextPlayerProfileLoading } from '../vnext/integration/playerProfile/VNextPlayerProfileStates'
import { VNextNotice } from '../vnext/states/VNextStates'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT PLAYER PROFILE, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * ============================ WHAT IT IS FOR ==============================
 *
 * Stage 10's deterministic worlds prove the design. What none of them can
 * prove is the only question that matters about the integration: CAN THE
 * APPLICATION SUPPLY THIS HONESTLY? For a profile that question is sharper than
 * for any surface so far, because THREE reads with THREE different permission
 * boundaries have to disagree with each other correctly:
 *
 *   A. does contract 151 really refuse a player the caller shares no private
 *      league with, and does the refusal arrive as `insufficient_privilege`
 *      rather than as an empty profile?
 *   B. do contract 192's two reads ANSWER for that same player, since they need
 *      only `compare`? That divergence is the whole architecture, and a fixture
 *      asserting it proves nothing;
 *   C. does the rank history come back with a real `standing_rank` per settled
 *      matchweek — a position rather than a running total?
 *   D. is the rivalry's `matchweeksCompared` actually the settled-revealed-and-
 *      banked-by-both count, and does `recent` come back truncated beneath it?
 *
 * ============================ IT IS REACHED FROM THE LEAGUES HARNESS ======
 *
 * Which is the point. `/dev/vnext-leagues` now navigates here when a player row
 * is pressed, carrying the two server-issued identifiers in the query string —
 * so the doorway Stage 9 built is exercised end to end against real data, and
 * the "safely addressable permitted player opened from a real competition
 * context" the Stage 10 predicate asks for is a thing a reviewer can do.
 *
 * THE URL CARRIES NO DISPLAY NAME AT ALL, and the form has no field for one.
 * The screen has no name prop to give it to: the page is named by whichever
 * read answered. So a reviewer typing two identifiers into this form sees
 * exactly what the product will show, including the heading.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ================
 *
 * The pattern this repository already accepted. The component is behind
 * `import.meta.env.DEV` at its import site in `App.tsx`, so a production build
 * resolves that to `false`, tree-shakes the lazy import and emits no chunk.
 * Nothing in the product's navigation points here and there is no flag that
 * turns it on. THE PRODUCTION PROFILE ROUTE IS UNTOUCHED.
 */
export function VNextPlayerProfilePreview() {
  return (
    <AuthProvider>
      <PreviewBody />
    </AuthProvider>
  )
}

type ForcedState = 'loading' | 'failed'

function forcedStateFrom(search: URLSearchParams): ForcedState | null {
  const value = search.get('state')
  return value === 'loading' || value === 'failed' ? value : null
}

/** Blank inputs are absent inputs. An empty string addresses nothing. */
function trimmedOrNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function PreviewBody() {
  const { userId, loading } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const forced = forcedStateFrom(search)

  const [competitionSlug, setCompetitionSlug] = useState(search.get('competition') ?? '')
  const [seasonSlug, setSeasonSlug] = useState(search.get('season') ?? '')
  const [playerId, setPlayerId] = useState(search.get('playerId') ?? '')
  const [playerRef, setPlayerRef] = useState(search.get('playerRef') ?? '')

  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
    playerId: string
    playerRef: string | null
  } | null>(() => {
    const competition = trimmedOrNull(search.get('competition'))
    const season = trimmedOrNull(search.get('season'))
    const id = trimmedOrNull(search.get('playerId'))
    // ARRIVING FROM THE LEAGUES HARNESS RENDERS IMMEDIATELY. Making a reviewer
    // press "Render" again after pressing a player would hide the one thing
    // this harness exists to show: that the doorway carries enough to open the
    // page without anybody retyping an identifier.
    if (competition === null || season === null || id === null) return null
    return {
      competitionSlug: competition,
      seasonSlug: season,
      playerId: id,
      playerRef: trimmedOrNull(search.get('playerRef')),
    }
  })

  const [note, setNote] = useState<string | null>(null)
  const onShellIntent = useShellIntentHost(setNote)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Player Profile — real data</h2>
        <p className={styles.note}>
          Development harness. Reads the live database through contract 151 and
          contract 192&apos;s two reads, and renders the Stage 10 surface
          unchanged. Reachable from the Leagues harness by pressing a player.
          Not a product route.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!competitionSlug.trim() || !seasonSlug.trim() || !playerId.trim()) return
            setApplied({
              competitionSlug: competitionSlug.trim(),
              seasonSlug: seasonSlug.trim(),
              playerId: playerId.trim(),
              playerRef: trimmedOrNull(playerRef),
            })
          }}
        >
          <label className={styles.field}>
            <span>Competition slug</span>
            <input
              value={competitionSlug}
              onChange={(event) => setCompetitionSlug(event.target.value)}
              placeholder="scottish-premiership"
            />
          </label>
          <label className={styles.field}>
            <span>Season key</span>
            <input
              value={seasonSlug}
              onChange={(event) => setSeasonSlug(event.target.value)}
              placeholder="2026-27"
            />
          </label>
          <label className={styles.field}>
            <span>Player account id (contract 151)</span>
            <input
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              placeholder="uuid"
            />
          </label>
          <label className={styles.field}>
            {/* BLANK IS A REAL STATE. A doorway below contract 191 carries no
                reference, and both contract-192 panels must then say they are
                unaddressable rather than refused. */}
            <span>Season entry ref (contract 192 — blank = unaddressable)</span>
            <input
              value={playerRef}
              onChange={(event) => setPlayerRef(event.target.value)}
              placeholder="uuid"
            />
          </label>
          <button type="submit">Render profile</button>
        </form>

        <p className={styles.note}>
          {loading ? 'Resolving session…' : userId ? 'Signed in' : 'No session.'}
          {applied?.playerRef == null
            ? ' · no season reference, so the chart and comparison are unaddressable'
            : ' · both identifiers present'}
        </p>
        {note === null ? null : <p className={styles.note}>{note}</p>}
      </header>

      <VNextRoot>
        {forced === 'loading' ? (
          <VNextPlayerProfileLoading />
        ) : forced === 'failed' ? (
          <VNextNotice
            destination="leagues"
            heading="Player"
            title="We could not load this player"
            body="Their season is there — we just could not read it just now. Trying again usually works."
            onRetry={() => window.location.reload()}
          />
        ) : applied ? (
          <VNextPlayerProfileScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={applied.competitionSlug}
            seasonSlug={applied.seasonSlug}
            playerId={applied.playerId}
            playerRef={applied.playerRef}
            gameName="Match Predictor"
            onShellIntent={onShellIntent}
          />
        ) : (
          /* Deliberately renders the loading state before anything is applied,
             so the skeleton is the first thing a reviewer sees. */
          <VNextPlayerProfileScreen
            userId={userId}
            authLoading
            competitionSlug={undefined}
            seasonSlug={undefined}
            playerId={undefined}
            playerRef={null}
            gameName="Match Predictor"
          />
        )}
      </VNextRoot>
    </div>
  )
}

/**
 * THE HOST FOR THE SHELL'S INTENTS — the same shape the other harnesses use. A
 * destination intent has nowhere to go yet and is REPORTED rather than faked
 * into a legacy route that looks nothing like the vNext page.
 */
function useShellIntentHost(report: (message: string) => void) {
  const navigate = useNavigate()
  return useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          navigate('/competitions')
          return
        case 'account':
          navigate('/account')
          return
        default:
          report(`Shell intent "${intent.kind}" — reported rather than routed.`)
      }
    },
    [navigate, report],
  )
}
