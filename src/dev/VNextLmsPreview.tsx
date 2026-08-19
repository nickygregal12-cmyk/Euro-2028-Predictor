import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextLmsScreen } from '../vnext/integration/lms/VNextLmsScreen'
import { VNextLmsLoading } from '../vnext/integration/lms/VNextLmsStates'
import { VNextLeaguesNotice } from '../vnext/integration/leagues/VNextLeaguesStates'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT LAST MAN STANDING, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * ============================ WHAT IT IS FOR ==============================
 *
 * Stage 11's deterministic worlds prove the design. What none of them can prove
 * is the only question that matters about this integration, and it is a sharper
 * question than any earlier stage's because THIS ONE WRITES:
 *
 *   A. does a real pick actually land through `save_lms_selection`, and does
 *      the re-read afterwards show the club as chosen and spent?
 *   B. does contract 116's `used` flag really arrive per club, and does it
 *      match the clubs the player has actually spent this cycle?
 *   C. does the server refuse a pick this page thought was allowed — and when
 *      it does, does the page say WHICH refusal it was rather than "something
 *      went wrong"?
 *   D. does `locks_at` arrive at all, and does the page's judgement of it agree
 *      with the server's willingness to accept the write?
 *
 * A fixture can assert any of that. Only a real round can show whether the
 * write and the read agree about what a player has spent — which is the whole
 * game.
 *
 * ============================ IT IS THE ONLY PLACE A REAL PICK IS MADE ====
 *
 * And that is worth stating plainly: pressing a club here SPENDS IT, in the
 * development database, for the season. That is the point — a survival game
 * whose write was never exercised against real data is a survival game nobody
 * has tested — but it is not an idle button.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ================
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`, so a production
 * build resolves that to `false`, tree-shakes the lazy import and emits no
 * chunk. Nothing in the product's navigation points here and there is no flag
 * that turns it on. THE PRODUCTION LMS SURFACES ARE UNTOUCHED.
 */
export function VNextLmsPreview() {
  return (
    <AuthProvider>
      <PreviewBody />
    </AuthProvider>
  )
}

type ForcedState = 'loading' | 'failed'

function forcedStateFrom(search: string): ForcedState | null {
  const value = new URLSearchParams(search).get('state')
  return value === 'loading' || value === 'failed' ? value : null
}

function PreviewBody() {
  const { userId, loading } = useAuth()
  const forced = forcedStateFrom(window.location.search)

  const [competitionSlug, setCompetitionSlug] = useState('')
  const [seasonSlug, setSeasonSlug] = useState('')
  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
  } | null>(null)

  const [note, setNote] = useState<string | null>(null)
  const onShellIntent = useShellIntentHost(setNote)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Last Man Standing — real data</h2>
        <p className={styles.note}>
          Development harness. Reads contract 116 and writes through
          <code> save_lms_selection</code>, rendering the Stage 11 surface
          unchanged. Not a product route.
        </p>
        <p className={styles.note}>
          <strong>Pressing a club spends it.</strong> This writes to the
          development database for real — that is what makes it worth running,
          and it is not an idle button.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!competitionSlug.trim() || !seasonSlug.trim()) return
            setApplied({
              competitionSlug: competitionSlug.trim(),
              seasonSlug: seasonSlug.trim(),
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
          <button type="submit">Render the round</button>
        </form>

        <p className={styles.note}>
          {loading ? 'Resolving session…' : userId ? 'Signed in' : 'No session.'}
        </p>
        {note === null ? null : <p className={styles.note}>{note}</p>}
      </header>

      <VNextRoot>
        {forced === 'loading' ? (
          <VNextLmsLoading />
        ) : forced === 'failed' ? (
          <VNextLeaguesNotice
            heading="Last Man Standing"
            title="We could not load this round"
            body="The round is there — we just could not read it just now. Trying again usually works."
            onRetry={() => window.location.reload()}
          />
        ) : applied ? (
          <VNextLmsScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={applied.competitionSlug}
            seasonSlug={applied.seasonSlug}
            gameName="Last Man Standing"
            onShellIntent={onShellIntent}
          />
        ) : (
          /* Deliberately renders the loading state before anything is applied,
             so the skeleton is the first thing a reviewer sees. */
          <VNextLmsScreen
            userId={userId}
            authLoading
            competitionSlug={undefined}
            seasonSlug={undefined}
            gameName="Last Man Standing"
          />
        )}
      </VNextRoot>
    </div>
  )
}

/**
 * THE HOST FOR THE SHELL'S INTENTS — the same shape the other harnesses use.
 * A destination intent has nowhere to go yet and is REPORTED rather than faked
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
