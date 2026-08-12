import { useCallback, useEffect, useState } from 'react'
import type { CompetitionTable } from '../../services/supabase/competitionTableModel'

/**
 * Contract 160's competition table, read once per season visit and shared.
 *
 * WHY IT IS A HOOK AND NOT A COMPONENT'S OWN EFFECT. `SeasonLeagueTable` used
 * to own this lifecycle, which was fine while the table had exactly one reader.
 * It now has three — the Table segment, the Match Centre's football context,
 * and the Match Predictor's insight panel — and three components each running
 * their own effect would be three requests for one answer, and three chances
 * for two surfaces on the same screen to disagree about a club's position while
 * one of them was still in flight.
 *
 * THE ROUTE OWNS THE READ AND THE COMPONENTS RENDER IT, which is the
 * architecture rule rather than a preference: a component that owns a fetch
 * lifecycle cannot be composed into a page that already has the answer.
 *
 * THE RETRY COMES WITH THE STATE. The Table segment offers "Try again" on a
 * failed read, and that control has to keep working after the read moves out of
 * it — so the failure state carries the callback rather than leaving the
 * component to invent its own nonce over a read it no longer owns.
 *
 * A REFUSAL IS A FAILURE HERE, DELIBERATELY. `get_competition_table` refuses
 * any competition that is not a league season, and the three consumers all want
 * the same thing from that: no table. Distinguishing "refused" from "failed"
 * would only matter if some surface acted differently on one, and none does.
 */

export type CompetitionTableState =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; table: CompetitionTable }

/**
 * `read` is optional because its ABSENCE is a real context rather than an
 * error: the DEV harness has fixtures and no season, and a competition that is
 * not a league season has no table at all. Both produce `unavailable`, which
 * callers render as nothing rather than as a segment that failed.
 */
export type CompetitionTableAnswer = CompetitionTableState | { status: 'unavailable' }

export function useCompetitionTable(
  read: (() => Promise<CompetitionTable>) | undefined,
): CompetitionTableAnswer {
  const [state, setState] = useState<CompetitionTableState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!read) return
    let active = true
    setState({ status: 'loading' })
    read()
      .then((table) => {
        if (active) setState({ status: 'ready', table })
      })
      .catch(() => {
        if (active) setState({ status: 'failed', retry })
      })
    return () => {
      active = false
    }
  }, [read, nonce, retry])

  if (!read) return { status: 'unavailable' }
  return state
}

/**
 * A club's row, by name.
 *
 * BY NAME BECAUSE THAT IS WHAT THE CALLERS HAVE. Contract 139's fixture entries
 * and the matchweek card both identify clubs by name and carry no team id, and
 * both names come from `public.teams.name` by foreign key — so this is an
 * equality on one source of truth rather than a fuzzy match, exactly as the
 * club-form join already is.
 *
 * NULL RATHER THAN A DEFAULT ROW. A club the table does not contain has no
 * position, and inventing a bottom-of-the-table row for it would be a claim
 * about the football.
 */
export function competitionTableLookup(
  answer: CompetitionTableAnswer,
): ((clubName: string) => import('../../services/supabase/competitionTableModel').CompetitionTableRow | null) | undefined {
  if (answer.status !== 'ready') return undefined
  const byName = new Map(answer.table.rows.map((row) => [row.teamName, row]))
  return (clubName: string) => byName.get(clubName) ?? null
}
