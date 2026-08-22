import { SHELL_DESTINATIONS } from '../../models/shell'
import type { ShellContext, VNextShellModel } from '../../models/shell'
import { buildShellAttention } from './buildShellAttention'
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
 * IT IS THE ONE-COMPETITION SHAPE WHERE THE HOST GAVE IT ONE COMPETITION. A
 * host that passes `elsewhere: null` gets exactly what this function produced
 * from Stage 8 to Stage 13 — one context, no attention, no shortcut group — and
 * `shellSource.ts` explains why that is the right thing for a page-scoped host
 * to pass rather than a gap.
 *
 * WHERE THE HOST DID SUPPLY `elsewhere`, THE CONTEXTS ARE THE PLAYER'S OWN LIST
 * AND THE ATTENTION IS THE INBOX. Both come from reads the production Football
 * Hub already makes; neither is derived from the other, and no competition is
 * invented from the catalogue. The empty `games` and `leagues` lists on each
 * context remain the integration gap, stated as data.
 */
export function buildShellModel(source: ShellSource): VNextShellModel {
  const { competition } = source
  const outstanding = source.outstandingPredictions
  const statedPlayerName = source.playerName?.trim() ?? ''
  const playerName = statedPlayerName.length > 0 ? statedPlayerName : 'Your account'

  return {
    player: {
      // THE FALLBACK IS A CONTROL LABEL, NOT A PERSON. The previous fallback
      // named the control "Your account" but derived its visual mark from the
      // missing source name, which produced a lone middle dot. That was both
      // unrecognisable in the mobile chrome and indistinguishable from a
      // loading artefact. Deriving initials from the SAME deliberate fallback
      // keeps the visible and accessible states in agreement without inventing
      // an identity or requiring an avatar read.
      name: playerName,
      initials: initialsOf(playerName),
    },
    // NO COMPETITION MEANS NO ACTIVE CONTEXT, not an invented one. A page
    // outside a competition renders with a null active context, which is the
    // state the shell model documents and has always supported — and it may
    // still hold the player's other competitions, because Account is outside
    // the tournament boundary without the player ceasing to have competitions.
    contexts: contextsOf(source),
    activeContextId: competition === null ? null : competition.tournamentId,
    destinations:
      outstanding === null || outstanding <= 0
        ? SHELL_DESTINATIONS
        : SHELL_DESTINATIONS.map((entry) =>
            entry.id === 'games' ? { ...entry, badge: outstanding } : entry,
          ),
    // THE MAPPER HANDS OVER EVERYTHING IT WAS TOLD. Removing the active
    // competition is `attentionElsewhere`'s job and only its job — Home answers
    // what is waiting HERE, and two filters for one rule is how they start
    // disagreeing.
    attention: buildShellAttention(source.elsewhere?.inbox ?? null),
    discovery: { reachable: source.canNavigateAway, catalogueSize: null },
  }
}

/**
 * THE PLAYER'S COMPETITIONS, WITH THE ACTIVE ONE FIRST AND ONLY ONCE.
 *
 * The page's own competition and the player's list are two reads and they
 * overlap: the competition the page is about is nearly always in the list too.
 * Joining them on `tournamentId` — never on a name — is what stops the switcher
 * showing the current competition twice.
 *
 * THE ACTIVE ONE KEEPS ITS COLOURS. The page's model resolved a palette; the
 * player's competition list carries none. So the active context is built from
 * the page's answer and the rest from the list, and a competition that appears
 * in both is the page's.
 */
function contextsOf(source: ShellSource): readonly ShellContext[] {
  const { competition, elsewhere } = source

  const active: ShellContext[] =
    competition === null
      ? []
      : [
          context({
            tournamentId: competition.tournamentId,
            name: competition.name,
            seasonLabel: competition.seasonLabel,
            colours: competition.colours,
          }),
        ]

  if (elsewhere === null) return active

  const others = elsewhere.competitions
    .filter((entry) => entry.tournamentId !== competition?.tournamentId)
    .map((entry) =>
      context({
        tournamentId: entry.tournamentId,
        name: entry.name,
        seasonLabel: entry.seasonLabel,
        // NO PALETTE FOR A COMPETITION THIS PAGE HAS NOT RESOLVED ONE FOR.
        // Painting an unknown competition the platform's launch colours would
        // make it look like a known one.
        colours: null,
      }),
    )

  return [...active, ...others]
}

function context(entry: {
  tournamentId: string
  name: string
  seasonLabel: string
  colours: { readonly primary: string; readonly accent: string } | null
}): ShellContext {
  return {
    competition: {
      id: entry.tournamentId,
      name: entry.name,
      shortName: entry.name,
      monogram: monogramOf(entry.name),
      seasonLabel: entry.seasonLabel,
      colours: entry.colours ?? FALLBACK_COLOURS,
    },
    // The player's own list is what `PlayerCompetitions` answers, and it is
    // built from follows UNIONED with game membership — so a competition here
    // is one the player follows or plays in. `playing` is the relationship the
    // shell has always been given, and nothing in either read distinguishes the
    // two finely enough to say otherwise without guessing.
    relationship: 'playing',
    // No read answers "is football happening here right now" at the shell's
    // level. Home answers it INSIDE the page, which is the division of labour,
    // so the chrome says nothing rather than guessing.
    tempoLabel: null,
    // The game list and the private leagues are the integration gap. They are
    // reachable only through Jump, which this shape never offers, so an empty
    // list costs nothing and claims nothing.
    games: [],
    leagues: [],
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

/**
 * A compact visual mark for a label the shell can already say.
 *
 * The caller always hands this a non-empty label. Keeping the defensive `?`
 * means a future malformed label fails recognisably rather than regressing to
 * punctuation that looks like a rendering glitch.
 */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (first && second) return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase()
  return (first ?? '').slice(0, 2).toUpperCase() || '?'
}
