import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextChampionshipScreen } from '../vnext/integration/championship/VNextChampionshipScreen'
import { VNextChampionshipLoading } from '../vnext/integration/championship/VNextChampionshipStates'
import { VNextLeaguesNotice } from '../vnext/integration/leagues/VNextLeaguesStates'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT PREDICTOR CHAMPIONSHIP, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * ============================ WHAT IT IS FOR ==============================
 *
 * Stage 12's deterministic worlds prove the design. This proves the read, and
 * the questions are sharper here than in any earlier stage because **nothing in
 * the application has ever called contract 193**. Every shape the decoder
 * handles was established by reading the migration; this is where reading meets
 * a real payload:
 *
 *   A. does `get_season_cup_bracket` return at all for a real Championship —
 *      including one that has reached its SPLIT, which raised an exception
 *      until contract 205 pinned the seed lookup to the initial membership?
 *   B. does an unfilled seat really arrive as `{user_id: null, display_name:
 *      'Player'}`, so that the decoder is right to key on the id?
 *   C. do `my_tie.opponent` and `my_ties[].opponent` really differ — null
 *      outright versus an object with a null id — as the two SQL constructions
 *      imply?
 *   D. does the read return `split` fixtures under its broad `stage <> 'group'`
 *      predicate, so that the decoder's filter is doing real work rather than
 *      guarding against a hypothetical?
 *
 * D is the one to watch. A `single_group` Championship that has split is the
 * shape where contract 193 offers a LEAGUE FIXTURE as a knockout tie, and no
 * fixture can prove the filter catches a real one.
 *
 * ============================ IT WRITES. READ THIS ONE. ==================
 *
 * THE PENALTY NUMBER FORM IS LIVE. It renders the Stage 12 surface unchanged,
 * and that surface's one intent is wired straight through
 * `VNextChampionshipScreen` to `submit_cup_penalty_number` against the
 * database this harness is pointed at.
 *
 * A Penalty Number is a SEALED BID in a real tie. Submitting one here is
 * indistinguishable from submitting one in the product: it is stored against
 * the caller's own user id, it is what the settlement authority reads when the
 * tie goes to a Penalty Number, and there is no undo. It locks at the round's
 * first kickoff and cannot be changed after.
 *
 * So: point this at a Championship whose result you are willing to be bound
 * by, or leave the field alone. Every other control here is a read.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ================
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`, so a production
 * build resolves that to `false`, tree-shakes the lazy import and emits no
 * chunk. Nothing in the product's navigation points here and there is no flag
 * that turns it on. THE PRODUCTION CHAMPIONSHIP SURFACES ARE UNTOUCHED.
 */
export function VNextChampionshipPreview() {
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
  const [championshipId, setChampionshipId] = useState('')
  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
    championshipId: string
  } | null>(null)

  const [note, setNote] = useState<string | null>(null)
  const onShellIntent = useShellIntentHost(setNote)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Predictor Championship — real data</h2>
        <p className={styles.note}>
          Development harness. Reads contract 193
          <code> get_season_cup_bracket</code> and renders the Stage 12 surface
          unchanged. Not a product route.
        </p>
        <p className={styles.warning}>
          <strong>The Penalty Number form below is live.</strong> It submits a
          real sealed bid, against your own account, in whatever Championship
          you point this at — the same write the product makes. It locks at the
          round&rsquo;s first kickoff and cannot be undone. Everything else on
          this page only reads.
        </p>
        <p className={styles.note}>
          <strong>This is contract 193&rsquo;s first caller.</strong> The most
          useful Championship to point it at is one that has reached its SPLIT —
          that is the shape which raised an exception before contract 205, and
          the shape whose <code>split</code> fixtures the decoder filters out of
          the bracket.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!competitionSlug.trim() || !seasonSlug.trim() || !championshipId.trim()) return
            setApplied({
              competitionSlug: competitionSlug.trim(),
              seasonSlug: seasonSlug.trim(),
              championshipId: championshipId.trim(),
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
            <span>Championship id</span>
            <input
              value={championshipId}
              onChange={(event) => setChampionshipId(event.target.value)}
              placeholder="bonus_competitions.id"
            />
          </label>
          <button type="submit">Render the Championship</button>
        </form>

        <p className={styles.note}>
          {loading ? 'Resolving session…' : userId ? 'Signed in' : 'No session.'}
        </p>
        {note === null ? null : <p className={styles.note}>{note}</p>}
      </header>

      <VNextRoot>
        {forced === 'loading' ? (
          <VNextChampionshipLoading />
        ) : forced === 'failed' ? (
          <VNextLeaguesNotice
            heading="Predictor Championship"
            title="We could not load this Championship"
            body="The draw is there — we just could not read it just now. Trying again usually works."
            onRetry={() => window.location.reload()}
          />
        ) : applied ? (
          <VNextChampionshipScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={applied.competitionSlug}
            seasonSlug={applied.seasonSlug}
            championshipId={applied.championshipId}
            gameName="Predictor Championship"
            onShellIntent={onShellIntent}
          />
        ) : (
          /* Deliberately renders the loading state before anything is applied,
             so the skeleton is the first thing a reviewer sees. */
          <VNextChampionshipScreen
            userId={userId}
            authLoading
            competitionSlug={undefined}
            seasonSlug={undefined}
            championshipId={undefined}
            gameName="Predictor Championship"
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
