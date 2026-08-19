import { SHELL_DESTINATIONS } from '../../models/shell'
import type { VNextShellModel } from '../../models/shell'
import type { ShellSource } from './shellSource'

/**
 * `ShellSource` → `VNextShellModel`. PURE: no network, no storage, no clock and
 * no React, exactly like `buildHomeModel` and `buildPredictorModel`.
 *
 * IT COMPUTES NOTHING IT WAS NOT TOLD. There is no arithmetic here, no
 * derivation of urgency from a deadline and no inference of a second
 * competition from anything. The one thing it invents is a MONOGRAM, which is
 * presentation over a name the application supplied and is not a fact about
 * football.
 *
 * IT IS THE ONE-COMPETITION SHAPE AND SAYS SO. See `shellSource.ts` for what
 * the application can and cannot answer today; the empty `attention` array and
 * the empty `games` list are the integration gap stated as data rather than
 * hidden behind a plausible-looking default.
 */
export function buildShellModel(source: ShellSource): VNextShellModel {
  const { competition } = source
  const outstanding = source.outstandingPredictions

  return {
    player: {
      // "Player" rather than a blank: the account control has to be nameable,
      // and a nameless button is worse than a generic one. It is never a
      // fabricated identity — the shell shows no id and claims no profile.
      name: source.playerName ?? 'Your account',
      initials: initialsOf(source.playerName),
    },
    // NO COMPETITION MEANS NO CONTEXT, not an invented one. A page outside a
    // competition renders with an empty switcher and a null active context,
    // which is the state the shell model documents and has always supported.
    contexts: competition === null ? [] : [
      {
        competition: {
          id: competition.tournamentId,
          name: competition.name,
          shortName: competition.name,
          monogram: monogramOf(competition.name),
          seasonLabel: competition.seasonLabel,
          colours: competition.colours ?? FALLBACK_COLOURS,
        },
        // The page was reached BY this competition's play context, which the
        // application only answers for a competition the player is in.
        relationship: 'playing',
        // No read answers "is football happening here right now" at the shell's
        // level. Home answers it INSIDE the page, which is the division of
        // labour, so the chrome says nothing rather than guessing.
        tempoLabel: null,
        // The game list and the private leagues are the integration gap. They
        // are reachable only through Jump, which this shape never offers, so an
        // empty list costs nothing and claims nothing.
        games: [],
        leagues: [],
      },
    ],
    activeContextId: competition === null ? null : competition.tournamentId,
    destinations:
      outstanding === null || outstanding <= 0
        ? SHELL_DESTINATIONS
        : SHELL_DESTINATIONS.map((entry) =>
            entry.id === 'games' ? { ...entry, badge: outstanding } : entry,
          ),
    attention: [],
    discovery: { reachable: source.canNavigateAway, catalogueSize: null },
  }
}

/**
 * A NEUTRAL PALETTE, NOT A COMPETITION'S.
 *
 * Both connected pages resolve their own colours, so this is only reached where
 * a model did not. Painting a competition the platform's launch colours would
 * make an unknown competition look like a known one.
 */
const FALLBACK_COLOURS = { primary: '#1d2330', accent: '#3a4457' }

/** Two letters from the competition's own words. Never a different competition. */
function monogramOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /[a-z]/i.test(word))
  const [first, second] = words
  if (first && second) return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase()
  return (first ?? name).slice(0, 2).toUpperCase()
}

function initialsOf(name: string | null): string {
  if (!name) return '·'
  const words = name.split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (first && second) return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase()
  return (first ?? '').slice(0, 2).toUpperCase() || '·'
}
