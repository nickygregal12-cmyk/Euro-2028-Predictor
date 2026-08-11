import { useCallback, useState } from 'react'
import type { ResolvedInvite } from '../../services/supabase/inviteCodesModel'
import { normaliseInviteCode } from '../../services/supabase/inviteCodesModel'
import { userFacingError } from '../../shared/errors/userFacingError'

/**
 * Resolving and accepting one invite code — the whole of it, in one place.
 *
 * WHY IT IS A HOOK AND NOT TWO COPIES. The deep-link landing page and the
 * code-entry sheet ask the same two questions in the same order, and before
 * this they each had their own copy of "look the code up, then join it". That
 * was survivable while a code could only be a league; with two container kinds
 * and a server-chosen join function it is exactly how one surface starts
 * joining a Championship through the league path.
 *
 * THE SERVER DECIDES WHICH JOIN. `resolve_invite_code` returns `joinWith`, and
 * this dispatches on it — never on the code's shape, its length, or anything
 * the browser inferred. A league still goes through `join_league`; a private
 * competition goes through `join_private_competition`, which is the only way in
 * now that `join_competition_game` refuses a private container.
 *
 * NOT FOUND IS NOT AN ERROR AND IS DELIBERATELY UNINFORMATIVE. An unknown code,
 * a malformed one and a rotated one produce the same state and the same
 * sentence, because the server has already made them indistinguishable and a
 * client that helpfully told them apart would undo that.
 *
 * THE SUPABASE MODULES ARE IMPORTED LAZILY. `services/supabase/client` throws
 * at load without configuration, so naming it at module scope would make every
 * component built on this hook unmountable in a test or a harness.
 */

export type InviteState =
  | { status: 'idle' }
  | { status: 'looking' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invite: Extract<ResolvedInvite, { found: true }> }

export type InviteJoinResult =
  | { kind: 'league'; leagueId: string }
  | { kind: 'competition'; competitionId: string }

export function useInviteCode() {
  const [state, setState] = useState<InviteState>({ status: 'idle' })
  const [joining, setJoining] = useState(false)

  const reset = useCallback(() => {
    setState({ status: 'idle' })
    setJoining(false)
  }, [])

  const resolve = useCallback(async (raw: string) => {
    const code = normaliseInviteCode(raw)
    if (code.length === 0) {
      setState({ status: 'error', message: 'Enter an invite code.' })
      return
    }
    setState({ status: 'looking' })
    try {
      const { resolveInviteCode } = await import('../../services/supabase/inviteCodes')
      const invite = await resolveInviteCode(code)
      setState(invite.found ? { status: 'ready', invite } : { status: 'notfound' })
    } catch (thrown) {
      setState({
        status: 'error',
        message: userFacingError(thrown, 'Could not look up that code. Please try again.'),
      })
    }
  }, [])

  /**
   * Accept the resolved invite.
   *
   * Returns what was joined so the caller can navigate; throws nothing, and
   * reports a refusal through `state` instead, because a refusal here is
   * ordinary (a competition that filled, a game membership that is missing)
   * rather than exceptional.
   */
  const accept = useCallback(
    async (raw: string): Promise<InviteJoinResult | null> => {
      if (state.status !== 'ready') return null
      const code = normaliseInviteCode(raw)
      setJoining(true)
      try {
        if (state.invite.joinWith === 'join_league') {
          const { joinLeague } = await import('../../services/supabase/leagues')
          const joined = await joinLeague(code)
          return { kind: 'league', leagueId: joined.id }
        }
        const { joinPrivateCompetition } = await import('../../services/supabase/inviteCodes')
        const joined = await joinPrivateCompetition(code)
        return {
          kind: 'competition',
          competitionId: joined.gameCompetitionId ?? state.invite.id,
        }
      } catch (thrown) {
        setState({
          status: 'error',
          message: userFacingError(thrown, 'Could not join with that code. Please try again.'),
        })
        return null
      } finally {
        setJoining(false)
      }
    },
    [state],
  )

  return { state, joining, resolve, accept, reset }
}
