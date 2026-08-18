import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { LeagueChoice, LeaguesModel, LeaguesScope } from '../models/leagues'
import { leaguesKnownEmpty, leaguesSwitchable } from '../models/leagues'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatNumber } from '../foundations/format'
import { GlobalStandingsTable, PrivateStandingsTable } from './LeagueTables'
import text from '../foundations/typography.module.css'
import styles from './leagues.module.css'

/**
 * WHAT THE PLAYER ASKED THIS SURFACE FOR.
 *
 * ONE INTENT TYPE, as every vNext page uses. `openPlayer` CARRIES AN ID AND
 * HAS NO NAME FIELD, which is the type-level half of the social identity rule:
 * a host wiring this to a router literally cannot receive a display name to
 * route by, because none is sent.
 */
export type LeaguesIntent =
  | { readonly kind: 'openPlayer'; readonly playerId: string }
  | { readonly kind: 'scope'; readonly scope: LeaguesScope }

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
}

export function VNextLeagues({ model, onIntent }: VNextLeaguesProps) {
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

  const switchable = leaguesSwitchable(model)
  const contextLine = useMemo(() => contextSentence(model), [model])

  function choose(scope: LeaguesScope) {
    onIntent?.({ kind: 'scope', scope })
  }

  function openPlayer(playerId: string) {
    onIntent?.({ kind: 'openPlayer', playerId })
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
              Season
            </button>
            {model.leagues.map((league) => (
              <LeagueOption
                key={league.id}
                league={league}
                pressed={highlighted === `private:${league.id}`}
                onChoose={() => choose({ kind: 'private', leagueId: league.id })}
              />
            ))}
          </nav>
        ) : null}

        {model.unavailable.length > 0 ? (
          <p className={`${text.micro} ${styles.unavailable}`} role="status">
            We could not load {listSentence(model.unavailable)} just now.
          </p>
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
          /* THE ONE SENTENCE ABOUT PRIVATE LEAGUES, and it is not a call to
           * action. Stage 9 does not own joining or creating a league, so a
           * button here would be a door onto a corridor that has not been
           * built. Saying what a private league IS, is honest and costs nothing.
           *
           * IT IS GATED ON THE LIST HAVING ANSWERED, not on the chooser being
           * absent. Those two coincide until the league list FAILS, at which
           * point the second one would tell a player they are in no league on
           * the strength of a read that never came back — the one thing this
           * lane forbids everywhere else. */
          <p className={`${text.micro} ${styles.aside}`}>
            You are not in a private league in {model.context.gameName} yet. A private
            league ranks a group of players against each other inside this
            competition.
          </p>
        ) : null}
      </div>
    </VNextShell>
  )
}

function LeagueOption({
  league,
  pressed,
  onChoose,
}: {
  readonly league: LeagueChoice
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
  const members = table.memberCount === 1 ? '1 member' : `${formatNumber(table.memberCount)} members`
  return `${members} · ranked inside this league`
}

/** "a and b", "a, b and c" — a list a person would say out loud. */
function listSentence(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
