import { useId, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { LeagueChoice, LeaguesModel, LeaguesScope } from '../models/leagues'
import { leaguesKnownEmpty, leaguesSwitchable } from '../models/leagues'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { ScopeMarker } from '../components/navigation/ScopeMarker'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatNumber } from '../foundations/format'
import { GlobalStandingsTable, PrivateStandingsTable } from './LeagueTables'
import text from '../foundations/typography.module.css'
import styles from './leagues.module.css'

/**
 * WHAT THE PLAYER ASKED THIS SURFACE FOR.
 *
 * ONE INTENT TYPE, as every vNext page uses. `openPlayer` CARRIES TWO
 * SERVER-ISSUED IDENTIFIERS AND NO NAME FIELD, which is the type-level half of
 * the social identity rule: a host wiring this to a router literally cannot
 * receive a display name to route by, because none is sent.
 *
 * WHY BOTH IDENTIFIERS. They address different reads, and Stage 10's profile
 * needs both: `playerId` is the ACCOUNT id that opens contract 151's profile,
 * and `playerRef` is contract 191's SEASON-SCOPED entry id that opens contract
 * 192's rank history and rivalry. Neither is substitutable for the other, and a
 * doorway that carried only one would leave a panel unaddressable.
 *
 * `playerRef` IS NULLABLE AND THE ID IS NOT. The id comes from the destination
 * union, which has exactly one openable case and requires it; the reference
 * comes from the row and is absent below contract 191. Carrying a null ref is
 * honest — Stage 10 draws "not available from here" rather than a refusal —
 * whereas carrying a null id would mean opening a profile with no address.
 */
export type LeaguesIntent =
  | {
      readonly kind: 'openPlayer'
      /**
       * THE ADDRESS. Contract 206 made the season ref the identity a profile is
       * opened by, and the one boundary that reveals no account id still reveals
       * this. Every openable row carries one.
       */
      readonly playerRef: string
      /**
       * The account id where the server also sent one — the older
       * shared-private-league boundary. `null` is an ordinary openable player
       * and never a half-open one; a host that needs an address uses the ref.
       */
      readonly playerId: string | null
    }
  | { readonly kind: 'scope'; readonly scope: LeaguesScope }
  /**
   * THE TWO WAYS OUT OF "YOU ARE NOT IN A PRIVATE LEAGUE YET".
   *
   * Stage 9 deliberately drew no control here, and said why: *"a button here
   * would be a door onto a corridor that has not been built."* It is built —
   * `/competitions/:c/:s/games/create` — so the sentence stops being a dead end
   * and becomes what it should always have been, which is an offer.
   *
   * A player with an invite is the commoner case of the two and is offered
   * first by the host; joining is `/join/:code`, which the invite corridor
   * already owns end to end.
   */
  | { readonly kind: 'create-private-play' }
  | { readonly kind: 'join-with-code' }

/**
 * vNEXT LEAGUES — WHO AM I COMPETING AGAINST, AND WHERE DO I STAND?
 *
 * ============================ IT IS PEOPLE, INSIDE A GAME, INSIDE A
 * COMPETITION ============================================================
 *
 * The three dimensions the Competition Deck has kept apart since Stage 7.6, and
 * this page is the one where losing track of them would be easiest. "Sunday
 * Club" alone could be any of three games in any of twenty competitions, so the
 * header names the competition and the game and the table names neither —
 * because a table that repeated them would be answering a question the chrome
 * has already answered, and a table that omitted them from the page entirely
 * would be ranking nothing in particular.
 *
 * ============================ THE SCOPE IS A CHOICE, NOT A FILTER ========
 *
 * "Season" and each private league are two different tables with two different
 * rank authorities — the season's rank is across the competition, a league's is
 * recomputed inside it. So the control switches between tables rather than
 * narrowing one, and the two are drawn by two different components that cannot
 * be merged by a prop.
 *
 * THE CONTROL DISAPPEARS BELOW TWO CHOICES. A player in no private league sees
 * the season table with no chooser at all, because a switch offering one option
 * teaches them there is a decision and then spends their press proving there is
 * not. That is the shell's own rule for its competition switcher, applied one
 * layer down.
 *
 * ============================ IT OPENS PEOPLE, IT DOES NOT DESCRIBE THEM =
 *
 * Stage 10 owns what a player looks like once opened. This page owns the
 * doorway and, more importantly, WHETHER THE DOORWAY EXISTS — which is the
 * server's answer and not a judgement made here. See `LeaguePlayerCell`.
 *
 * ============================ NOTHING HERE READS A CLOCK OR A RANK =======
 *
 * No `Date.now()`, no sort, no renumbering, no comparison of two players to
 * decide who is ahead. Every number on this page is a number the server sent.
 */
export type VNextLeaguesProps = {
  readonly model: LeaguesModel
  readonly onIntent?: ((intent: LeaguesIntent) => void) | undefined
  /**
   * Ask the host to read again, offered beside whatever could not be read.
   *
   * IT BELONGS IN THE READY STATE AND NOT ONLY IN THE FAILURE ONE. A table that
   * did not answer no longer takes the whole page down — the chooser has to
   * survive it, or the player is stranded in the league that failed — so the
   * page a partial read produces is a READY page, and the only place a retry
   * could live is next to the sentence that admits the gap.
   */
  readonly onRetry?: (() => void) | undefined
}

export function VNextLeagues({ model, onIntent, onRetry }: VNextLeaguesProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)

  /**
   * THE HIGHLIGHTED SCOPE IS THE MODEL'S, AND THERE IS NO LOCAL STATE HERE.
   *
   * Stage 8's filter is local because filtering a list the page already holds
   * changes nothing about what was read. Switching scope is not that: the two
   * tables are two different reads with two different rank authorities, and the
   * model carries exactly one of them. A pressed state that ran ahead of the
   * model would show "Sunday Club" selected above the season's table — the
   * chooser claiming a table the page is not drawing, which is the one thing a
   * control over two rankings must never do.
   *
   * So pressing fires an intent and nothing else. The host re-reads, a new
   * model arrives, and the highlight moves because the TABLE moved.
   */
  const highlighted = scopeKey(model.scope)
  const scopeGroup = useId()

  const switchable = leaguesSwitchable(model)
  const contextLine = useMemo(() => contextSentence(model), [model])

  function choose(scope: LeaguesScope) {
    onIntent?.({ kind: 'scope', scope })
  }

  function openPlayer(playerRef: string, playerId: string | null) {
    onIntent?.({ kind: 'openPlayer', playerRef, playerId })
  }

  return (
    <VNextShell
      destination="leagues"
      header={
        <VNextPageHeader
          title="Leagues"
          competition={
            model.context.seasonLabel
              ? `${model.context.competitionName} · ${model.context.seasonLabel}`
              : model.context.competitionName
          }
          context={model.context.gameName}
        />
      }
    >
      <div className={styles.page}>
        {switchable ? (
          <nav className={styles.scope} aria-label="Which table" data-vnext-zone="chooser">
            <button
              type="button"
              className={styles.scopeOption}
              aria-pressed={highlighted === 'global'}
              onClick={() => choose({ kind: 'global' })}
            >
              {highlighted === 'global' ? <ScopeMarker group={scopeGroup} /> : null}
              <span className={styles.scopeName}>Season</span>
            </button>
            {model.leagues.map((league) => (
              <LeagueOption
                key={league.id}
                league={league}
                group={scopeGroup}
                pressed={highlighted === `private:${league.id}`}
                onChoose={() => choose({ kind: 'private', leagueId: league.id })}
              />
            ))}
          </nav>
        ) : null}

        {model.unavailable.length > 0 ? (
          /* THE MESSAGE IS THE LIVE REGION, AND THE CONTROL IS OUTSIDE IT.
           *
           * Pressing "Try again" swaps the whole subtree to the skeleton and
           * back, so a SECOND failure re-mounts this sentence — and without a
           * live region a reader who cannot see it is told nothing at all,
           * having just asked for exactly this answer. `role="status"` on the
           * paragraph announces it; keeping the button outside means the
           * control is not inside a region that re-announces itself. It is the
           * same choice `VNextLeaguesStates` makes for the whole-page notice,
           * so the two retry paths behave alike. */
          <div className={styles.unavailable}>
            <p className={text.micro} role="status">
              We could not load {listSentence(model.unavailable)} just now.
            </p>
            {onRetry ? (
              <button type="button" className={styles.retry} onClick={onRetry}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        <motion.div
          className={styles.tableRegion}
          data-vnext-zone="standings"
          variants={rise}
          initial="hidden"
          animate="visible"
        >
          <div className={styles.tableHead}>
            <h2 className={text.title}>{tableHeading(model)}</h2>
            <p className={`${text.micro} ${styles.tableContext}`}>{contextLine}</p>
          </div>

          {model.global !== null ? (
            <GlobalStandingsTable
              table={model.global}
              caption={`${model.context.competitionName} season standings`}
              onOpenPlayer={onIntent ? openPlayer : undefined}
            />
          ) : model.private !== null ? (
            <PrivateStandingsTable
              table={model.private}
              onOpenPlayer={onIntent ? openPlayer : undefined}
            />
          ) : (
            /* NOT AN ERROR SCREEN. The read did not answer and the strip above
             * already said so; repeating it as a failure would turn one missing
             * table into two apologies. */
            <p className={`${text.body} ${styles.emptyTable}`}>
              There is no table to show here yet.
            </p>
          )}
        </motion.div>

        {leaguesKnownEmpty(model) ? (
          /* THE SENTENCE, AND NOW THE TWO WAYS OUT OF IT. Stage 9 wrote this as
           * a statement rather than a call to action because "a button here
           * would be a door onto a corridor that has not been built". The
           * corridor exists, so the sentence keeps its job — saying what a
           * private league IS — and stops being the end of the road.
           *
           * IT IS GATED ON THE LIST HAVING ANSWERED, not on the chooser being
           * absent. Those two coincide until the league list FAILS, at which
           * point the second one would tell a player they are in no league on
           * the strength of a read that never came back — the one thing this
           * lane forbids everywhere else.
           *
           * AND ON THE HOST BEING ABLE TO ROUTE. A host with no `onIntent` gets
           * the sentence alone, which is what it always was. */
          <div className={styles.emptyOffer} data-vnext-zone="no-private-league">
            <p className={`${text.micro} ${styles.aside}`}>
              You are not in a private league in {model.context.gameName} yet. A private
              league ranks a group of players against each other inside this
              competition.
            </p>
            {onIntent === undefined ? null : (
              <div className={styles.emptyActions}>
                <button
                  type="button"
                  className={styles.emptyAction}
                  onClick={() => onIntent({ kind: 'join-with-code' })}
                >
                  Join with an invite
                </button>
                <button
                  type="button"
                  className={styles.emptyAction}
                  onClick={() => onIntent({ kind: 'create-private-play' })}
                >
                  Create one
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </VNextShell>
  )
}

function LeagueOption({
  league,
  group,
  pressed,
  onChoose,
}: {
  readonly league: LeagueChoice
  readonly group: string
  readonly pressed: boolean
  readonly onChoose: () => void
}) {
  return (
    <button
      type="button"
      className={styles.scopeOption}
      aria-pressed={pressed}
      onClick={onChoose}
    >
      {pressed ? <ScopeMarker group={group} /> : null}
      <span className={styles.scopeName}>{league.name}</span>
      <span className={`${text.micro} ${styles.scopeCount}`}>
        {formatNumber(league.memberCount)}
        <span className={text.srOnly}>
          {league.memberCount === 1 ? ' member' : ' members'}
        </span>
      </span>
    </button>
  )
}

/* ==========================================================================
   SENTENCES
   ========================================================================== */

function scopeKey(scope: LeaguesScope): string {
  return scope.kind === 'global' ? 'global' : `private:${scope.leagueId}`
}

function tableHeading(model: LeaguesModel): string {
  if (model.scope.kind === 'global') return 'Season standings'
  return model.private?.name ?? 'This league'
}

/**
 * WHAT THE TABLE IS RANKING, IN ONE LINE UNDER THE HEADING.
 *
 * The season table says the competition; a league says how many people are in
 * it. Neither says both, because the header above has already named the
 * competition and the game and a third repetition is the page shouting.
 */
function contextSentence(model: LeaguesModel): string {
  if (model.scope.kind === 'global') {
    return `Everyone playing ${model.context.gameName} this season`
  }
  const table = model.private
  if (table === null) return model.context.gameName
  // THE TABLE'S OWN COUNT, NOT THE LIST'S. `memberCount` comes from
  // `get_my_game_leagues` and `totalCount` from contract 128 — two reads, which
  // can and do disagree. Printing the list's figure here and the table's in the
  // foot puts "8 members" directly above "5 members" on one screen, which is
  // the page arguing with itself. The chooser chip is where the list's own
  // count belongs, because that is the list's own control.
  const members =
    table.totalCount === 1 ? '1 member' : `${formatNumber(table.totalCount)} members`
  return `${members} · ranked inside this league`
}

/** "a and b", "a, b and c" — a list a person would say out loud. */
function listSentence(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
