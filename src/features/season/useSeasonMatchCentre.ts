import { useCallback, useEffect, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import { presentMatchCentre, type MatchCentreView } from './matchCentreModel'
import type { FixtureListRow } from './fixtureListModel'
import type { MatchPredictorPage } from './matchPredictorModel'

/**
 * The player's own side of one fixture, loaded on demand.
 *
 * ON DEMAND IS THE POINT. The Matches list is a competition surface and shows
 * a fortnight at a time; reading a matchweek card for every row on it would ask
 * the server for the player's whole entry to render a list that does not show
 * it. The card is read when a fixture is opened, for that fixture's matchweek
 * only.
 *
 * NOT PLAYING IS NOT AN ERROR. Fixtures are readable by anyone following the
 * competition, and most people reading a fixture list have not joined every
 * game behind it. `get_season_matchweek_card` refuses a non-entrant with 42501,
 * and this surface is behind authentication, so on this route that code means
 * "you have not joined the Main Predictor" rather than "you are signed out".
 * Classified by CODE and answered with copy written here — never by passing the
 * server's message through, which is the discipline `lmsRefusal` already sets.
 */

export type SeasonMatchCentreState =
  | { status: 'loading' }
  | { status: 'not_playing' }
  | { status: 'failed'; error: string }
  | {
      status: 'ready'
      view: MatchCentreView
      /**
       * The card the view was derived from, carried rather than re-read.
       *
       * `MatchCentreView` formats the prediction as a string for display, and
       * the `INNOV-001` projection needs the goals as numbers to score a
       * hypothetical scoreline with. Parsing "2 - 1" back into a pair would be a
       * second decoder over data this hook already holds.
       */
      card: MatchPredictorPage
    }

export type SeasonMatchCentreCardReader = (matchweek: number) => Promise<MatchPredictorPage>

function isNotAnEntrant(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === '42501' || code === 'insufficient_privilege'
}

export function useSeasonMatchCentre(
  read: SeasonMatchCentreCardReader,
  fixture: FixtureListRow,
): SeasonMatchCentreState & { reload: () => void } {
  const [state, setState] = useState<SeasonMatchCentreState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const matchweek = fixture.round.ordinal
  const fixtureId = fixture.id

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    read(matchweek)
      .then((card) => {
        if (!active) return
        setState({ status: 'ready', view: presentMatchCentre(fixture, card), card })
      })
      .catch((cause: unknown) => {
        if (!active) return
        setState(
          isNotAnEntrant(cause)
            ? { status: 'not_playing' }
            : { status: 'failed', error: userFacingError(cause, 'Your entry could not be read.') },
        )
      })
    return () => {
      active = false
    }
    // Keyed on the fixture's IDENTITY rather than on the object: the row is
    // rebuilt by the list model on every window read, and depending on it
    // would re-read the card each time the list refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, matchweek, fixtureId, nonce])

  return { ...state, reload: useCallback(() => setNonce((value) => value + 1), []) }
}
