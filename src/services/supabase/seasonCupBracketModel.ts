/**
 * Contract 193 / `CUP-003` — `get_season_cup_bracket`, decoded for the first
 * time.
 *
 * ============================ NOTHING CONSUMED THIS READ UNTIL NOW =======
 *
 * It has existed since 17 August with a pgTAP suite and a parity test and no
 * application caller at all. Being the first consumer is a specific
 * responsibility: every shape below was established by reading the migration's
 * `jsonb_build_object` calls, not by inferring what a bracket "should" carry,
 * and two of the shapes are surprising enough to be worth naming here.
 *
 * ============================ IT RETURNS THE BRACKET AS DATA =============
 *
 * Which is what makes Stage 12's headline predicate satisfiable: a launched
 * Championship must be understandable "without reconstructing its bracket in
 * React". Every seat carries `window_sequence`, `bracket_slot` and
 * `round_size`, ordered `by window_sequence, bracket_slot` server-side. This
 * module reorders nothing.
 *
 * ============================ THE `stage` FILTER IS A WORKAROUND, AND SAYS
 * SO ======================================================================
 *
 * Contract 102 widened the fixture stage domain to
 * `('group','split','playoff','knockout')`, and every authority since uses the
 * NARROW predicate. Contract 195's own SQL comment:
 *
 *     -- Contract 102's predicate. `stage <> 'group'` would sweep in a `split`
 *     -- fixture, which is a group-phase table row with no Penalty Number.
 *
 * and contract 194 goes further, asserting against the installed settlement
 * driver that the broad form has not reappeared.
 *
 * **Contract 193 uses the broad form in four places.** A split fixture can
 * never settle (`bonus_cup_fixtures_group_never_settles`), so `my_tie`'s
 * `winner_user_id is null` filter does not exclude it — meaning a
 * `single_group` Championship that reaches its split gets a LEAGUE FIXTURE
 * offered as a knockout tie, with `round_size` and `bracket_slot` null, and a
 * Penalty Number lane for a fixture that has none.
 *
 * So this decoder filters `stage` to `playoff | knockout` itself.
 *
 * **CONTRACT 207 FIXED THE READ.** All four predicates now name the knockout
 * stages, so the server no longer offers a split fixture as a tie. The filter
 * below is therefore no longer the authority — it is the second of two, kept
 * because the environments this code runs against reach a contract on their own
 * schedule and a decoder that trusted an unapplied migration would render the
 * defect. It may be retired once every hosted environment is at 208 or later;
 * until then, deleting it would restore the bug in exactly the environments
 * that still have it.
 *
 * It was deliberately NOT the same defect contract 205 fixed — that one raised
 * an exception; this one returned the wrong rows.
 *
 * ============================ AN EMPTY SEAT IS NOT A PERSON CALLED "PLAYER"
 * ========================================================================
 *
 * Contract 193 renders every side as
 *
 *     jsonb_build_object('user_id', ..., 'display_name',
 *                        coalesce(profile.display_name, 'Player'))
 *
 * so an UNFILLED seat and a real player with no profile row are textually
 * identical. Only `user_id` separates them, which is why `side()` below keys
 * on the id and never on the name.
 *
 * ============================ AND THE TWO OPPONENT SHAPES DIFFER =========
 *
 * `my_tie.opponent` is a scalar subselect FROM `profiles`, so it is null
 * outright when there is no opponent row. `my_ties[].opponent` is a built
 * object, so the same situation arrives as `{user_id: null, display_name:
 * 'Player'}`. Same concept, two encodings; both are handled.
 */

/**
 * THE CALLER'S OWN STANDING IN THE COMPETITION, and the only authority for it.
 *
 * `bonus_competition_entrants.outcome`, constrained to these five values since
 * the games platform was founded and added to this read by contract 208. Before
 * that, no season Championship read returned elimination at all: a surface
 * could say who WON and not who was OUT, and every available inference — lost
 * your only tie, hold no later fixture, hold no seed — is conclusive-looking
 * and wrong whenever the competition has not finished eliminating.
 *
 * `null` IS A REAL ANSWER AND MEANS "THIS DATABASE HAS NOT REACHED CONTRACT
 * 208". It is not `active`: an environment that cannot say must not be decoded
 * into the one outcome that reads as "you are fine".
 */
type CupEntrantOutcome =
  | 'active'
  | 'qualified'
  | 'survived'
  | 'eliminated'
  | 'champion'

type CupTieDecision =
  | 'points'
  | 'extra_time'
  | 'penalty_number'
  | 'walkover'
  | 'admin_walkover'

/** One side of a tie. `null` where the seat is empty — never a name. */
export type CupSeatSide = { userId: string; displayName: string } | null

export type CupBracketSeat = {
  fixtureId: string
  stage: 'playoff' | 'knockout'
  roundSize: number | null
  bracketSlot: number | null
  windowSequence: number
  windowLabel: string | null
  home: CupSeatSide
  away: CupSeatSide
  isYours: boolean
  winnerUserId: string | null
  decidedBy: CupTieDecision | null
}

type CupPenaltyNumber = {
  windowId: string
  windowLabel: string | null
  lane: 'odd' | 'even'
  submitted: boolean
  value: number | null
  version: number | null
  locksAt: string | null
  /**
   * BOTH ARE THE SERVER'S OWN COMPARISON against its own clock, and they are
   * NOT complements: when the round's real fixtures are unscheduled,
   * `cup_window_first_kickoff` is null and BOTH are false. That third state is
   * a real one — `submit_cup_penalty_number` refuses with `55000` — so a
   * surface must read them as two booleans rather than one.
   */
  locked: boolean
  open: boolean
}

export type SeasonCupBracket =
  | { entered: false }
  | {
      entered: true
      /** The database's own clock, returned so a caller need not read one. */
      serverNow: string
      /**
       * Contract 208. The caller's own outcome, verbatim, or `null` where the
       * database predates the contract. Never derived here and never defaulted.
       */
      yourOutcome: CupEntrantOutcome | null
      format: {
        kind: string | null
        producesKnockout: boolean
        groupStageLastSequence: number | null
      }
      qualification: {
        drawn: boolean
        qualifiers: number
        yourSeed: number | null
        youQualified: boolean
      }
      myTie: {
        fixtureId: string
        stage: 'playoff' | 'knockout'
        roundSize: number | null
        bracketSlot: number | null
        windowSequence: number
        windowLabel: string | null
        isHome: boolean
        opponent: CupSeatSide
        locksAt: string | null
      } | null
      penaltyNumber: CupPenaltyNumber | null
      myTies: readonly {
        fixtureId: string
        stage: 'playoff' | 'knockout'
        windowSequence: number
        windowLabel: string | null
        // WHICH SIDE OF THE TIE THE CALLER IS, stated by the server per
        // fixture. Unlike `my_tie`, this is present on SETTLED ties too, so it
        // still answers after the final has been won.
        isHome: boolean
        opponent: CupSeatSide
        settled: boolean
        youWon: boolean
        decidedBy: CupTieDecision | null
        settledAt: string | null
      }[]
      bracket: readonly CupBracketSeat[]
      champion: { userId: string; displayName: string } | null
    }

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

/**
 * ONE SIDE, KEYED ON THE ID.
 *
 * A missing `user_id` is an EMPTY SEAT and returns null, whatever the payload
 * says the display name is — and it will say `'Player'`, because contract 193
 * coalesces. Reading the name here is how a bracket ends up showing a person
 * called Player standing in every hole.
 */
function side(value: unknown): CupSeatSide {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  if (userId === null) return null
  return { userId, displayName: stringOrNull(row.display_name) ?? 'Player' }
}

/**
 * The stored vocabulary, or `null`. An unrecognised string is `null` rather
 * than a guess: the constraint is the server's and a value this code has not
 * been taught about is a value it must not classify.
 */
function entrantOutcome(value: unknown): CupEntrantOutcome | null {
  const text = stringOrNull(value)
  return text === 'active' ||
    text === 'qualified' ||
    text === 'survived' ||
    text === 'eliminated' ||
    text === 'champion'
    ? text
    : null
}

function decision(value: unknown): CupTieDecision | null {
  const text = stringOrNull(value)
  return text === 'points' ||
    text === 'extra_time' ||
    text === 'penalty_number' ||
    text === 'walkover' ||
    text === 'admin_walkover'
    ? text
    : null
}

/** `playoff | knockout` only. See the header: this is a workaround. */
function knockoutStage(value: unknown): 'playoff' | 'knockout' | null {
  const text = stringOrNull(value)
  return text === 'playoff' || text === 'knockout' ? text : null
}

function penaltyNumberOf(value: unknown): CupPenaltyNumber | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const windowId = stringOrNull(row.window_id)
  if (windowId === null) return null
  const lane = stringOrNull(row.lane)
  if (lane !== 'odd' && lane !== 'even') return null
  return {
    windowId,
    windowLabel: stringOrNull(row.window_label),
    lane,
    submitted: row.submitted === true,
    // NULL SURVIVES. A caller who has not submitted has no value, and 0 is a
    // legal Penalty Number — so defaulting would invent a submission of zero.
    value: integerOrNull(row.value),
    version: integerOrNull(row.version),
    locksAt: stringOrNull(row.locks_at),
    locked: row.locked === true,
    open: row.open === true,
  }
}

export function mapSeasonCupBracket(payload: unknown): SeasonCupBracket {
  const root = objectOf(payload)
  if (root.entered !== true) return { entered: false }

  const format = objectOf(root.format)
  const qualification = objectOf(root.qualification)
  const myTieRow = root.my_tie === null || root.my_tie === undefined ? null : objectOf(root.my_tie)
  const myTieStage = myTieRow === null ? null : knockoutStage(myTieRow.stage)

  const championRow = root.champion === null || root.champion === undefined
    ? null
    : objectOf(root.champion)
  const championId = championRow === null ? null : stringOrNull(championRow.user_id)

  return {
    entered: true,
    serverNow: stringOrNull(root.server_now) ?? '',
    // CARRIED, NEVER COMPUTED. There is no fallback to `champion` when
    // `root.champion` names the caller, and none to `eliminated` when they hold
    // no live tie — both would be this file becoming a settlement authority.
    yourOutcome: entrantOutcome(root.your_outcome),
    format: {
      kind: stringOrNull(format.kind),
      producesKnockout: format.produces_knockout === true,
      groupStageLastSequence: integerOrNull(format.group_stage_last_sequence),
    },
    qualification: {
      drawn: qualification.drawn === true,
      qualifiers: integerOrNull(qualification.qualifiers) ?? 0,
      // NULL IS AN ANSWER: an entrant who did not qualify has no seed, and 0 is
      // not a seed. Contract 205 is what makes reading this safe at all.
      yourSeed: integerOrNull(qualification.your_seed),
      youQualified: qualification.you_qualified === true,
    },
    // A `split` fixture offered as a live tie is dropped rather than rendered.
    myTie:
      myTieRow === null || myTieStage === null
        ? null
        : {
            fixtureId: stringOrNull(myTieRow.fixture_id) ?? '',
            stage: myTieStage,
            roundSize: integerOrNull(myTieRow.round_size),
            bracketSlot: integerOrNull(myTieRow.bracket_slot),
            windowSequence: integerOrNull(myTieRow.window_sequence) ?? 0,
            windowLabel: stringOrNull(myTieRow.window_label),
            isHome: myTieRow.is_home === true,
            opponent: side(myTieRow.opponent),
            locksAt: stringOrNull(myTieRow.locks_at),
          },
    // AND ITS PENALTY NUMBER GOES WITH IT. Contract 193 populates this whenever
    // `my_tie` is populated, so a split fixture would otherwise offer a lane
    // for a fixture that has none.
    penaltyNumber: myTieStage === null ? null : penaltyNumberOf(root.penalty_number),
    myTies: (Array.isArray(root.my_ties) ? root.my_ties : []).flatMap((entry) => {
      const row = objectOf(entry)
      const stage = knockoutStage(row.stage)
      if (stage === null) return []
      return [
        {
          fixtureId: stringOrNull(row.fixture_id) ?? '',
          stage,
          windowSequence: integerOrNull(row.window_sequence) ?? 0,
          windowLabel: stringOrNull(row.window_label),
          isHome: row.is_home === true,
          opponent: side(row.opponent),
          settled: row.settled === true,
          youWon: row.you_won === true,
          decidedBy: decision(row.decided_by),
          settledAt: stringOrNull(row.settled_at),
        },
      ]
    }),
    // ORDER IS THE SERVER'S. Contract 193 orders by `window_sequence,
    // bracket_slot`; nothing here sorts, and a filtered-out split fixture
    // leaves the remaining order intact.
    bracket: (Array.isArray(root.bracket) ? root.bracket : []).flatMap((entry) => {
      const row = objectOf(entry)
      const stage = knockoutStage(row.stage)
      if (stage === null) return []
      return [
        {
          fixtureId: stringOrNull(row.fixture_id) ?? '',
          stage,
          roundSize: integerOrNull(row.round_size),
          bracketSlot: integerOrNull(row.bracket_slot),
          windowSequence: integerOrNull(row.window_sequence) ?? 0,
          windowLabel: stringOrNull(row.window_label),
          home: side(row.home),
          away: side(row.away),
          isYours: row.is_yours === true,
          winnerUserId: stringOrNull(row.winner_user_id),
          decidedBy: decision(row.decided_by),
        },
      ]
    }),
    champion:
      championId === null
        ? null
        : {
            userId: championId,
            displayName: stringOrNull(championRow?.display_name) ?? 'Player',
          },
  }
}
