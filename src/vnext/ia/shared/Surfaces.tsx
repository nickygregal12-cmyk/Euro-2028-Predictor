import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  GAME_NAMES,
  GAME_SHORT_NAMES,
  attentionFor,
  contextById,
  offeredGames,
  peopleFor,
} from '../../models/ia'
import type {
  AttentionItem,
  CatalogueEntry,
  FootballContext,
  GameOffering,
  IaModel,
  PeopleScope,
  StandingEntry,
} from '../../models/ia'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import type { IaDestination } from './navigation'
import type { IaNavigation } from './navigation'
import styles from './shared.module.css'
import text from '../../foundations/typography.module.css'

/**
 * EVERYTHING BELOW THE CHROME, AND IT IS THE SAME IN ALL THREE CONCEPTS.
 *
 * WHY THAT IS THE DESIGN AND NOT A SHORTCUT. Stage 7.5 asks which information
 * architecture is right, so the architecture has to be the only thing that
 * varies. Give each concept its own league table and the review becomes a
 * comparison of league tables. Every destination body here is therefore
 * deliberately plain: it states what the destination holds, using the real
 * football, player and game data from the shared model, and no more.
 *
 * THESE ARE NOT THE PAGES AND MUST NEVER BECOME THEM. Home, the Match
 * Predictor, Matches, Leagues, Last Man Standing and the Predictor Championship
 * are each their own stage of work — two of them already accepted and
 * explicitly out of scope here. What a concept has to prove is ARRIVAL: that
 * the player got to the right place, knows which competition and which game
 * they are in, and can get back. So each body names the surface that will
 * eventually render there and shows the state it would open with.
 *
 * NOTHING HERE RENDERS AN `<h1>`. The concept chrome owns the single page
 * heading, because where the heading sits is part of what the concepts differ
 * about. Bodies start at `<h2>`.
 */

/* ==========================================================================
   identity
   ========================================================================== */

export function CompetitionMark({
  monogram,
  primary,
  accent,
  size = 'sm',
}: {
  monogram: string
  primary: string
  accent: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={`${styles.mark} ${size === 'md' ? styles.markMd : ''}`}
      style={{ '--mark-primary': primary, '--mark-accent': accent } as React.CSSProperties}
      aria-hidden="true"
    >
      {monogram}
    </span>
  )
}

/**
 * A PLAYER'S NAME, AND WHETHER IT IS A DOOR.
 *
 * THIS COMPONENT IS THE STAGE 7.5 SOCIAL FINDING MADE MECHANICAL. A name is a
 * button only where the model says `reach === 'profile'`, and the model says
 * that only where the platform actually holds an identifier and the server will
 * answer. On the global season leaderboard it holds neither: contract 95's
 * payload carries a display name, points, rank, matchweeks played and `isYou`,
 * and no user id at all.
 *
 * SO `name-only` RENDERS AS TEXT — not a disabled button, not a link that
 * explains itself when pressed. A control that exists and refuses teaches a
 * player that the product is broken; a name that was never a control teaches
 * them nothing false. The one thing that must not happen is a frontend
 * inventing an address, and this component cannot.
 */
function PlayerName({
  entry,
  onOpen,
}: {
  entry: StandingEntry
  onOpen?: (playerId: string) => void
}) {
  if (entry.reach === 'profile' && onOpen) {
    return (
      <button
        type="button"
        className={`${styles.playerLink} ${text.emphasis}`}
        onClick={() => onOpen(entry.player.id)}
      >
        {entry.player.name}
        {entry.isYou ? <span className={styles.youTag}>you</span> : null}
      </button>
    )
  }
  return (
    <span className={`${styles.playerText} ${text.emphasis}`}>
      {entry.player.name}
      {entry.isYou ? <span className={styles.youTag}>you</span> : null}
    </span>
  )
}

/* ==========================================================================
   game state, in each game's own terms
   ========================================================================== */

/**
 * ONE RENDERING PER GAME, AND THEY LOOK DIFFERENT ON PURPOSE.
 *
 * Match Predictor is a fraction against a deadline. Last Man Standing is a life
 * and a club. The Championship is a position in a table. Drawing all three as
 * "headline plus detail" is exactly how Last Man Standing became "another
 * little tab", and the brief names that as the thing Stage 7.5 must not repeat.
 */
export function GameStatusLine({ game }: { game: GameOffering }) {
  const status = game.status
  if (!status) {
    switch (game.availability) {
      case 'joinable':
        return <span className={styles.statusMuted}>Not joined · open to join</span>
      case 'registration-closed':
        return <span className={styles.statusMuted}>Registration closed for this season</span>
      case 'not-offered':
        return <span className={styles.statusMuted}>Not run in this competition</span>
      default:
        return <span className={styles.statusMuted}>Joined</span>
    }
  }

  if (status.kind === 'match-predictor') {
    return (
      <span className={styles.statusRow}>
        <span className={styles.statusStrong}>
          {status.made} of {status.of} predicted
        </span>
        <span className={styles.statusDot} aria-hidden="true" />
        <span className={styles.statusMuted}>{status.deadlineLabel}</span>
        {status.jokerPlayed ? <span className={styles.jokerTag}>Joker played</span> : null}
      </span>
    )
  }

  if (status.kind === 'last-man-standing') {
    return (
      <span className={styles.statusRow}>
        <span
          className={
            status.life === 'eliminated' ? styles.lifeEliminated : styles.lifeAlive
          }
        >
          {status.life === 'alive'
            ? 'Still alive'
            : status.life === 'eliminated'
              ? 'Eliminated'
              : 'Not entered'}
        </span>
        <span className={styles.statusDot} aria-hidden="true" />
        <span className={styles.statusMuted}>
          {status.selection ?? 'No club picked'}
        </span>
        {status.remaining === null ? null : (
          <>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusMuted}>{status.remaining} remain</span>
          </>
        )}
        {status.deadlineLabel ? (
          <>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusMuted}>{status.deadlineLabel}</span>
          </>
        ) : null}
      </span>
    )
  }

  return (
    <span className={styles.statusRow}>
      <span className={styles.statusStrong}>
        {status.position} of {status.of}
      </span>
      {status.gapLabel ? (
        <>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusMuted}>{status.gapLabel}</span>
        </>
      ) : null}
      {status.nextOpponent ? (
        <>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusMuted}>v {status.nextOpponent}</span>
        </>
      ) : null}
    </span>
  )
}

/* ==========================================================================
   attention
   ========================================================================== */

function AttentionCard({
  item,
  model,
  onOpen,
  showContext = true,
}: {
  item: AttentionItem
  model: IaModel
  onOpen: (destination: IaDestination) => void
  showContext?: boolean
}) {
  const context = contextById(model, item.contextId)
  return (
    <li className={styles.attentionItem} data-urgency={item.urgency} data-shape={item.shape}>
      <button
        type="button"
        className={styles.attentionButton}
        onClick={() => onOpen({ kind: 'game', contextId: item.contextId, game: item.game })}
      >
        <span className={styles.attentionTop}>
          {showContext && context ? (
            <>
              <CompetitionMark
                monogram={context.competition.monogram}
                primary={context.competition.colours.primary}
                accent={context.competition.colours.accent}
              />
              <span className={styles.attentionContext}>{context.competition.shortName}</span>
              <span className={styles.statusDot} aria-hidden="true" />
            </>
          ) : null}
          <span className={styles.attentionGame}>{GAME_SHORT_NAMES[item.game]}</span>
        </span>
        <span className={`${styles.attentionHeadline} ${text.emphasis}`}>{item.headline}</span>
        <span className={styles.attentionDetail}>{item.detail}</span>
      </button>
    </li>
  )
}

/* ==========================================================================
   destination bodies
   ========================================================================== */

function SurfaceNote({ children }: { children: React.ReactNode }) {
  return <p className={styles.surfaceNote}>{children}</p>
}

function HomeBody({ nav }: { nav: IaNavigation }) {
  const { model, contextId, go } = nav
  const items = attentionFor(model, contextId)
  const context = contextById(model, contextId)

  return (
    <div className={styles.body}>
      <section aria-labelledby="ia-home-attention" className={styles.panel}>
        <h2 id="ia-home-attention" className={styles.panelHeading}>
          What should I care about right now?
        </h2>
        {items.length === 0 ? (
          <p className={styles.empty}>Nothing needs you here. The football is quiet.</p>
        ) : (
          <ul className={styles.attentionList}>
            {items.map((item) => (
              <AttentionCard key={item.id} item={item} model={model} onOpen={go} showContext={false} />
            ))}
          </ul>
        )}
        <SurfaceNote>
          The accepted Gold Standard Home renders here. Stage 7.5 changes nothing about it — this
          panel shows only the state it would open with, so each architecture can be judged on
          whether the player arrived in the right competition.
        </SurfaceNote>
      </section>

      {context ? <GameStrip context={context} onOpen={go} /> : null}
    </div>
  )
}

function GameStrip({
  context,
  onOpen,
}: {
  context: FootballContext
  onOpen: (destination: IaDestination) => void
}) {
  const offered = offeredGames(context)
  const missing = context.games.filter((game) => game.availability === 'not-offered')

  return (
    <section aria-labelledby="ia-home-games" className={styles.panel}>
      <h2 id="ia-home-games" className={styles.panelHeading}>
        Games in {context.competition.name}
      </h2>
      <ul className={styles.gameList}>
        {offered.map((game) => (
          <li key={game.key} className={styles.gameItem} data-game={game.key}>
            <button
              type="button"
              className={styles.gameButton}
              onClick={() =>
                onOpen({ kind: 'game', contextId: context.competition.id, game: game.key })
              }
            >
              <span className={`${styles.gameName} ${text.emphasis}`}>{game.name}</span>
              <GameStatusLine game={game} />
            </button>
          </li>
        ))}
      </ul>
      {missing.length > 0 ? (
        <p className={styles.notOffered}>
          {context.competition.name} does not run{' '}
          {missing.map((game) => game.name).join(' or ')}.
        </p>
      ) : null}
    </section>
  )
}

function AttentionBody({ nav }: { nav: IaNavigation }) {
  const { model, go } = nav
  const groups = useMemo(() => {
    const order: readonly AttentionItem['urgency'][] = [
      'urgent',
      'live',
      'soon',
      'later',
      'done',
    ]
    return order
      .map((urgency) => ({
        urgency,
        items: model.attention.filter((item) => item.urgency === urgency),
      }))
      .filter((group) => group.items.length > 0)
  }, [model.attention])

  const HEADINGS: Record<AttentionItem['urgency'], string> = {
    urgent: 'Needs you now',
    live: 'Happening now',
    soon: 'This week',
    later: 'Later',
    done: 'Done and waiting',
  }

  return (
    <div className={styles.body}>
      {groups.length === 0 ? (
        <p className={styles.empty}>Nothing needs you in any competition.</p>
      ) : (
        groups.map((group) => (
          <section
            key={group.urgency}
            aria-labelledby={`ia-attention-${group.urgency}`}
            className={styles.panel}
          >
            <h2 id={`ia-attention-${group.urgency}`} className={styles.panelHeading}>
              {HEADINGS[group.urgency]}
            </h2>
            <ul className={styles.attentionList}>
              {group.items.map((item) => (
                <AttentionCard key={item.id} item={item} model={model} onOpen={go} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function GamesBody({ nav, contextId }: { nav: IaNavigation; contextId: string }) {
  const context = contextById(nav.model, contextId)
  if (!context) return null
  return (
    <div className={styles.body}>
      <GameStrip context={context} onOpen={nav.go} />
      <section aria-labelledby="ia-games-note" className={styles.panel}>
        <h2 id="ia-games-note" className={styles.panelHeading}>
          Three games, not three competitions
        </h2>
        <SurfaceNote>
          The Match Predictor, Last Man Standing and the Predictor Championship are formats drawn
          over this competition’s football. They are joined independently, they run on different
          rhythms, and none of them is a competition or a private league. Whichever architecture
          wins has to keep those three sentences true.
        </SurfaceNote>
      </section>
    </div>
  )
}

function MatchesBody({ nav, contextId }: { nav: IaNavigation; contextId: string }) {
  const context = contextById(nav.model, contextId)
  if (!context) return null
  return (
    <div className={styles.body}>
      <section aria-labelledby="ia-matches" className={styles.panel}>
        <h2 id="ia-matches" className={styles.panelHeading}>
          {context.competition.name} football
        </h2>
        {context.tempoLabel ? <p className={styles.tempo}>{context.tempoLabel}</p> : null}
        <ul className={styles.fixtureList}>
          {context.fixtureLines.map((line) => (
            <li key={line} className={styles.fixtureLine}>
              {line}
            </li>
          ))}
        </ul>
        <SurfaceNote>
          The Matches system is Stage 8 and is deliberately not designed here. What this
          architecture has to answer is only where it sits: whether football browsing is a
          destination of its own, a competition section, or a mode the player switches into.
        </SurfaceNote>
      </section>
    </div>
  )
}

function GameBody({
  nav,
  contextId,
  gameKey,
}: {
  nav: IaNavigation
  contextId: string
  gameKey: GameOffering['key']
}) {
  const context = contextById(nav.model, contextId)
  const game = context?.games.find((entry) => entry.key === gameKey)
  if (!context || !game) return null

  if (game.availability === 'not-offered') {
    return (
      <div className={styles.body}>
        <section aria-labelledby="ia-game-absent" className={styles.panel}>
          <h2 id="ia-game-absent" className={styles.panelHeading}>
            {GAME_NAMES[gameKey]} is not run in {context.competition.name}
          </h2>
          <p className={styles.empty}>
            This is not a permission and not a closed window — the competition does not run the
            game at all. Nothing here is disabled, because there is nothing to disable.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.body}>
      <section aria-labelledby="ia-game" className={styles.panel}>
        <h2 id="ia-game" className={styles.panelHeading}>
          {game.name} · {context.competition.name}
        </h2>
        <p className={styles.gameStatusLead}>
          <GameStatusLine game={game} />
        </p>
        {game.availability === 'joinable' ? (
          <p className={styles.empty}>
            {context.competition.name} runs this game and you have not joined it. Joining is a
            deliberate act and nothing here does it for you.
          </p>
        ) : null}
        {game.availability === 'registration-closed' ? (
          <p className={styles.empty}>
            Registration for this season closed. That is a fact about the window, not about you.
          </p>
        ) : null}
        <SurfaceNote>
          {gameKey === 'match-predictor'
            ? 'Stage 7’s accepted Match Predictor renders here, unchanged. This architecture is judged on how the player reached it, whether the competition stays visible while predicting, and what leaving means.'
            : gameKey === 'last-man-standing'
              ? 'A Last Man Standing surface is a later stage. What Stage 7.5 must prove is that it has a natural home — alive or eliminated, the current selection, the deadline, used clubs, players remaining and survival history all belong to one place that is not a competition and not a private league.'
              : 'The Predictor Championship is its own nested system and a later stage. Stage 7.5 only decides where that system hangs, so it can be redesigned later without revisiting the shell.'}
        </SurfaceNote>
      </section>
    </div>
  )
}

function PeopleBody({ nav, contextId }: { nav: IaNavigation; contextId: string | null }) {
  const scopes = peopleFor(nav.model, contextId)
  return (
    <div className={styles.body}>
      {scopes.length === 0 ? (
        <p className={styles.empty}>No leagues and no standings in this context yet.</p>
      ) : (
        scopes.map((scope) => (
          <ScopeCard key={scope.id} scope={scope} nav={nav} compact />
        ))
      )}
    </div>
  )
}

function ScopeCard({
  scope,
  nav,
  compact = false,
}: {
  scope: PeopleScope
  nav: IaNavigation
  compact?: boolean
}) {
  const context = contextById(nav.model, scope.contextId)
  const entries = compact ? scope.entries.slice(0, 3) : scope.entries

  return (
    <section aria-labelledby={`ia-scope-${scope.id}`} className={styles.panel}>
      <h2 id={`ia-scope-${scope.id}`} className={styles.panelHeading}>
        {scope.title}
      </h2>
      <p className={styles.scopeMeta}>
        {context ? context.competition.shortName : 'Unknown competition'}
        {scope.kind === 'private-league' ? (
          <>
            {' · '}
            {GAME_SHORT_NAMES[scope.game]}
            {' · '}
            {scope.memberCount} members
          </>
        ) : (
          <> · {scope.fieldSize.toLocaleString('en-GB')} entrants</>
        )}
      </p>
      <ul className={styles.standings}>
        {entries.map((entry) => (
          <li key={entry.player.id} className={styles.standingRow} data-you={entry.isYou}>
            <span className={`${styles.position} ${text.numeric}`}>{entry.position}</span>
            <span className={styles.standingName}>
              <PlayerName
                entry={entry}
                {...(scope.kind === 'private-league'
                  ? {
                      onOpen: (playerId: string) =>
                        nav.go({ kind: 'player', playerId, fromScopeId: scope.id }),
                    }
                  : {})}
              />
              <span className={styles.rankLabel}>{entry.rankLabel}</span>
            </span>
            <span className={`${styles.points} ${text.numeric}`}>{entry.points}</span>
          </li>
        ))}
      </ul>
      {scope.kind === 'global' ? (
        <p className={styles.reachNote}>
          These names cannot be opened. The global season leaderboard read returns a display name
          and no identifier, so there is no address to link to — a backend gap, not a permission a
          frontend could widen.
        </p>
      ) : null}
      {compact && scope.kind === 'private-league' ? (
        <button
          type="button"
          className={styles.inlineAction}
          onClick={() => nav.go({ kind: 'league', scopeId: scope.id })}
        >
          Open {scope.title}
        </button>
      ) : null}
    </section>
  )
}

function LeagueBody({ nav, scopeId }: { nav: IaNavigation; scopeId: string }) {
  const scope = nav.model.people.find((entry) => entry.id === scopeId)
  if (!scope) return null
  return (
    <div className={styles.body}>
      <ScopeCard scope={scope} nav={nav} />
      <SurfaceNote>
        The private-league workspace — table, matchweek and members — is its own stage. Here it
        proves only that a rival is one press from their table and that the way back is stated
        rather than left to browser history.
      </SurfaceNote>
    </div>
  )
}

function PlayerBody({
  nav,
  playerId,
  fromScopeId,
}: {
  nav: IaNavigation
  playerId: string
  fromScopeId: string
}) {
  const scope = nav.model.people.find((entry) => entry.id === fromScopeId)
  const entry = scope?.entries.find((row) => row.player.id === playerId)
  const context = contextById(nav.model, scope?.contextId ?? null)
  if (!scope || !entry) return null

  return (
    <div className={styles.body}>
      <section aria-labelledby="ia-player" className={styles.panel}>
        <h2 id="ia-player" className={styles.panelHeading}>
          {entry.player.name}
        </h2>
        <p className={styles.scopeMeta}>
          {context ? `${context.competition.name} · ` : ''}
          {entry.rankLabel} · {entry.points} points
        </p>
        <ul className={styles.capabilityList}>
          <li>
            <span className={styles.capabilityState} data-state="real">
              Real now
            </span>
            Season points, rank of field, exact-score and correct-result counts, and matchweek
            history — contract 151’s season player profile.
          </li>
          <li>
            <span className={styles.capabilityState} data-state="real">
              Real now
            </span>
            Their predictions, but only for matchweeks that have already locked. The server
            applies that boundary; nothing here decides it.
          </li>
          <li>
            <span className={styles.capabilityState} data-state="partial">
              Partial
            </span>
            Head to head and rank history exist for the Euro tournament. There is no weekly-season
            counterpart, so a domestic H2H is a backend gap rather than a page to design.
          </li>
          <li>
            <span className={styles.capabilityState} data-state="absent">
              Absent
            </span>
            Following a player. The platform has no follow graph and the accepted direction says
            people you play with are private-league members.
          </li>
        </ul>
        <p className={styles.reachNote}>
          You can be here because you share <strong>{scope.title}</strong> with this player.
          Sharing the competition alone would not be enough — the server refuses a caller who
          shares no private league.
        </p>
      </section>
    </div>
  )
}

function DiscoverBody({ nav }: { nav: IaNavigation }) {
  const [query, setQuery] = useState('')
  const { model } = nav

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return model.catalogue
    return model.catalogue.filter((entry) =>
      entry.competition.name.toLowerCase().includes(needle),
    )
  }, [model.catalogue, query])

  const mine = matches.filter((entry) => entry.relationship !== 'browsing')
  const rest = matches.filter((entry) => entry.relationship === 'browsing')

  return (
    <div className={styles.body}>
      <section aria-labelledby="ia-discover" className={styles.panel}>
        <h2 id="ia-discover" className={styles.panelHeading}>
          Competitions
        </h2>
        <label className={styles.searchLabel} htmlFor="ia-discover-search">
          Search {model.catalogue.length} published competitions
        </label>
        <input
          id="ia-discover-search"
          className={styles.search}
          type="search"
          value={query}
          placeholder="Premier, Liga, Cup…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className={styles.reachNote}>
          Search, the player’s own pinned, then the rest. There is no region, country, type or
          popularity grouping because the platform holds none of them, and a heading guessed from a
          competition’s name would be a heading that lies.
        </p>

        {mine.length > 0 ? (
          <>
            <h3 className={styles.subHeading}>Yours</h3>
            <CatalogueList entries={mine} nav={nav} />
          </>
        ) : null}

        <h3 className={styles.subHeading}>
          {mine.length > 0 ? 'Everything else' : 'All competitions'}
        </h3>
        {rest.length === 0 ? (
          <p className={styles.empty}>Nothing else matches “{query}”.</p>
        ) : (
          <CatalogueList entries={rest} nav={nav} />
        )}
      </section>
    </div>
  )
}

function CatalogueList({
  entries,
  nav,
}: {
  entries: readonly CatalogueEntry[]
  nav: IaNavigation
}) {
  const known = new Set(nav.model.contexts.map((entry) => entry.competition.id))
  return (
    <ul className={styles.catalogue}>
      {entries.map((entry) => (
        <li key={entry.competition.id} className={styles.catalogueItem}>
          <button
            type="button"
            className={styles.catalogueButton}
            disabled={!known.has(entry.competition.id)}
            onClick={() => nav.switchContext(entry.competition.id)}
          >
            <CompetitionMark
              monogram={entry.competition.monogram}
              primary={entry.competition.colours.primary}
              accent={entry.competition.colours.accent}
            />
            <span className={styles.catalogueName}>
              <span className={text.emphasis}>{entry.competition.name}</span>
              <span className={styles.catalogueMeta}>
                {entry.competition.seasonLabel ? `${entry.competition.seasonLabel} · ` : ''}
                {entry.offers.map((game) => GAME_SHORT_NAMES[game]).join(' · ')}
              </span>
            </span>
            <span className={styles.catalogueRelationship} data-relationship={entry.relationship}>
              {entry.relationship === 'playing'
                ? 'Playing'
                : entry.relationship === 'following'
                  ? 'Following'
                  : 'Not yours'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function MeBody({ nav }: { nav: IaNavigation }) {
  return (
    <div className={styles.body}>
      <section aria-labelledby="ia-me" className={styles.panel}>
        <h2 id="ia-me" className={styles.panelHeading}>
          {nav.model.player.name}
        </h2>
        <SurfaceNote>
          The platform profile, the season history archive and account settings already exist and
          are not redesigned here. What Stage 7.5 settles is whether identity is a destination, a
          corner of the chrome, or something reached only through the people you play with.
        </SurfaceNote>
      </section>
    </div>
  )
}

/* ==========================================================================
   the dispatcher
   ========================================================================== */

export function destinationTitle(nav: IaNavigation): string {
  const { destination, model } = nav
  switch (destination.kind) {
    case 'home': {
      const context = contextById(model, nav.contextId)
      return context ? context.competition.name : 'Home'
    }
    case 'attention':
      return 'Needs you'
    case 'matches': {
      const context = contextById(model, destination.contextId)
      return context ? `${context.competition.shortName} matches` : 'Matches'
    }
    case 'games': {
      const context = contextById(model, destination.contextId)
      return context ? `${context.competition.shortName} games` : 'Games'
    }
    case 'game':
      return GAME_NAMES[destination.game]
    case 'people':
      return 'Leagues and standings'
    case 'league':
      return model.people.find((scope) => scope.id === destination.scopeId)?.title ?? 'League'
    case 'player': {
      const scope = model.people.find((entry) => entry.id === destination.fromScopeId)
      const entry = scope?.entries.find((row) => row.player.id === destination.playerId)
      return entry?.player.name ?? 'Player'
    }
    case 'discover':
      return 'Competitions'
    case 'me':
      return nav.model.player.name
    default:
      return 'Home'
  }
}

/** The football context a destination is about, in words. Null when none. */
export function destinationContextLabel(nav: IaNavigation): string | null {
  const context = contextById(nav.model, nav.contextId)
  if (!context) return null
  return context.competition.seasonLabel
    ? `${context.competition.name} · ${context.competition.seasonLabel}`
    : context.competition.name
}

export function IaSurface({ nav }: { nav: IaNavigation }) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { destination } = nav

  const body = (() => {
    switch (destination.kind) {
      case 'home':
        return <HomeBody nav={nav} />
      case 'attention':
        return <AttentionBody nav={nav} />
      case 'matches':
        return <MatchesBody nav={nav} contextId={destination.contextId} />
      case 'games':
        return <GamesBody nav={nav} contextId={destination.contextId} />
      case 'game':
        return (
          <GameBody nav={nav} contextId={destination.contextId} gameKey={destination.game} />
        )
      case 'people':
        return <PeopleBody nav={nav} contextId={destination.contextId} />
      case 'league':
        return <LeagueBody nav={nav} scopeId={destination.scopeId} />
      case 'player':
        return (
          <PlayerBody
            nav={nav}
            playerId={destination.playerId}
            fromScopeId={destination.fromScopeId}
          />
        )
      case 'discover':
        return <DiscoverBody nav={nav} />
      case 'me':
        return <MeBody nav={nav} />
      default:
        return null
    }
  })()

  return (
    <motion.div
      // Keyed on the destination so a change of place is a change of content,
      // not a diff of two unrelated screens.
      key={`${destination.kind}-${JSON.stringify(destination)}`}
      variants={rise}
      initial="hidden"
      animate="visible"
    >
      {body}
    </motion.div>
  )
}

/**
 * THE WAY OUT, STATED RATHER THAN INHERITED FROM HISTORY.
 *
 * Every concept renders this in its own place, and all three get the same
 * answer, because a deterministic parent is a property of the destination and
 * not of the chrome around it.
 */
export function BackControl({ nav }: { nav: IaNavigation }) {
  if (!nav.back || !nav.backLabel) return null
  return (
    <button type="button" className={styles.back} onClick={nav.back}>
      <span aria-hidden="true">←</span> {nav.backLabel}
    </button>
  )
}
