/**
 * WHO OWNS EVERY USER-FACING ADDRESS THIS APPLICATION SERVES.
 *
 * ============================ WHY THIS TABLE EXISTS =====================
 *
 * `docs/product/vnext-route-migration-matrix.md` §"Why this exists" states the
 * failure it was written against: *"a route left as 'probably covered by
 * Leagues' is exactly how the next Last Man Standing happens"*. That matrix is
 * a dated document and cannot fail a build. This is the executable half — every
 * address in `src/App.tsx` carries an explicit owner here, and a route added
 * without one is a failing test rather than a surface somebody finds on a phone
 * six weeks later.
 *
 * It records the CLASSIFICATION only. Everything checkable is derived from
 * `src/App.tsx` itself in `routeOwnership.test.ts` and cross-checked against
 * these rows, so the table cannot drift away from the tree in either direction:
 * a row that claims `redirect` for a route that renders a page fails, and so
 * does a route that renders a vNext surface while claiming to be legacy.
 */

type RouteOwner =
  /**
   * A vNext surface renders here. Where the row names a `journey`, the legacy
   * element is still mounted on the off branch and the switch is the rollback.
   */
  | 'vnext'
  /**
   * The address survives and resolves INTO a vNext destination that took its
   * job. Gated on the absorbing destination's own flag, so a rollback restores
   * the legacy page with it.
   */
  | 'absorbed'
  /**
   * Deliberately not vNext, and not waiting to be. Administration, the Euro
   * tournament's own journeys (Stage 15), the sessionless auth screens, and the
   * matchday television screen, which must stay outside the signed-in frame.
   */
  | 'legacy-permanent'
  /** A pure `<Navigate>`. It renders nothing of its own. */
  | 'redirect'

export type RouteOwnership = {
  readonly path: string
  readonly owner: RouteOwner
  /**
   * The cutover flag that decides this row, where one does.
   *
   * `null` means the row is not switchable: an admin page, an auth screen, a
   * compatibility redirect, or `/about`, which is vNext and behind no flag
   * because the address did not exist before it.
   */
  readonly journey: string | null
  /** One line. Why this owner, in the product's own terms. */
  readonly why: string
}

export const ROUTE_OWNERSHIP: readonly RouteOwnership[] = [
  /* ---- Sessionless and public --------------------------------------- */
  {
    path: '/auth/login',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Authentication is outside the vNext scope entirely; the matrix keeps it RETAIN.',
  },
  {
    path: '/auth/signup',
    owner: 'legacy-permanent',
    journey: null,
    why: 'RETAIN, and the Euro publication gate above it is a route guard that must stay one.',
  },
  {
    path: '/auth/reset',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Account recovery. RETAIN.',
  },
  {
    path: '/auth/update-password',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Account recovery. RETAIN.',
  },
  {
    path: '/about',
    owner: 'vnext',
    journey: null,
    why: 'ADR 0017 non-affiliation, built in vNext and behind no flag: the address did not exist before it.',
  },

  /* ---- The way in ---------------------------------------------------- */
  {
    path: '/welcome',
    owner: 'vnext',
    journey: 'footballHubOnboarding',
    why: 'First sign-in. The presentation switches; commitOnboarding.ts writes on both sides of it.',
  },
  {
    path: '/join/:code',
    owner: 'vnext',
    journey: 'footballHubInvite',
    why: 'The invite deep link. useInviteCode and useInviteLanding are shared by both presentations.',
  },

  /* ---- The Competition Deck ------------------------------------------ */
  {
    path: '/',
    owner: 'vnext',
    journey: 'footballHubHome',
    why: 'The front door, resolved to the competition the player is most relevant to. Euro keeps its own.',
  },
  {
    path: '/play',
    owner: 'absorbed',
    journey: 'footballHubHome',
    why: 'HIDE / ABSORB. What needs doing HERE is Home’s; what needs doing elsewhere is the attention layer’s.',
  },
  {
    path: '/matches',
    owner: 'absorbed',
    journey: 'footballHubMatches',
    why: 'HIDE / ABSORB. The combined calendar is a scope inside Matches, never a fifth destination.',
  },
  {
    path: '/leagues',
    owner: 'absorbed',
    journey: 'footballHubLeagues',
    why: 'HIDE / ABSORB. ADR 0011 refuses a cross-competition ranking at the data layer.',
  },
  {
    path: '/more',
    owner: 'absorbed',
    journey: 'footballHubAccount',
    why: 'ABSORB. A directory page is a symptom of a navigation that ran out of slots.',
  },
  {
    path: '/competitions',
    owner: 'vnext',
    journey: 'footballHubDiscovery',
    why: 'RETAIN + HIDE. Deliberate discovery over the published catalogue, outside permanent navigation.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug',
    owner: 'vnext',
    journey: 'footballHubHome',
    why: 'MERGE. This and `/` are one visible destination under the Competition Deck.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/play',
    owner: 'absorbed',
    journey: 'footballHubHome',
    why: 'ABSORB. Two “what needs doing” surfaces at two scopes is one too many.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/matches',
    owner: 'vnext',
    journey: 'footballHubMatches',
    why: 'REDESIGN, built in Stage 8 and cut over in Stage 14.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/matches/:fixtureId',
    owner: 'vnext',
    journey: 'footballHubMatches',
    why: 'RETAIN + REDESIGN. Contract 148 resolves the fixture from its id, so the address shape is the strength.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/games',
    owner: 'vnext',
    journey: 'footballHubGames',
    why: 'REDESIGN. The one surface where the three games are peers, and where their rules live.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/games/match-predictor',
    owner: 'vnext',
    journey: 'footballHubPredictor',
    why: 'REDESIGN. The flagship game, whose adapter Stage 14 built and never routed.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/games/create',
    owner: 'vnext',
    journey: 'footballHubCreatePrivatePlay',
    why: 'The create-private-play corridor. New address: the off branch is Not Found, because there is no legacy page here.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/wrapped',
    owner: 'vnext',
    journey: 'footballHubSeasonWrapped',
    why: "Contract 156's Season Wrapped. New address: nothing has ever rendered the archive, so the off branch is Not Found.",
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings',
    owner: 'absorbed',
    journey: 'footballHubLeagues',
    why: 'ABSORB. The season table is a SCOPE inside Leagues, with its own rank authority.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/games/lms',
    owner: 'vnext',
    journey: 'footballHubLms',
    why: 'REDESIGN, built in Stage 11 and cut over in Stage 14.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/games/championship/*',
    owner: 'vnext',
    journey: 'footballHubChampionship',
    why: 'REDESIGN, built in Stage 12 and cut over in Stage 14.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/leagues',
    owner: 'vnext',
    journey: 'footballHubLeagues',
    why: 'REDESIGN, built in Stage 9. The season table and each private league are scopes inside it.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/players/:playerId',
    owner: 'vnext',
    journey: 'footballHubPlayerProfile',
    why: 'RETAIN + REDESIGN. A player’s season is a fact about them IN a season, so the address stays scoped.',
  },
  {
    path: '/competitions/:competitionSlug/:seasonSlug/tv',
    owner: 'legacy-permanent',
    journey: null,
    why: 'INNOV-006. It must stay shell-less — a room display with a bottom bar is the wrong product — and Stage 8 deferred its redesign deliberately.',
  },

  /* ---- Platform identity --------------------------------------------- */
  {
    path: '/profile',
    owner: 'absorbed',
    journey: 'footballHubAccount',
    why: 'Platform identity and season history, which the vNext Account surface reads through contracts 157 and 161.',
  },
  {
    path: '/account',
    owner: 'vnext',
    journey: 'footballHubAccount',
    why: 'RETAIN. Account / You, outside the tournament boundary.',
  },
  {
    path: '/more/scoring',
    owner: 'absorbed',
    journey: 'footballHubGames',
    why: 'ABSORB. Rules belong beside the game they govern, and Games renders them.',
  },

  /* ---- Compatibility redirects, which were already redirects --------- */
  { path: '/fixtures', owner: 'redirect', journey: null, why: 'Old address for the calendar.' },
  { path: '/league', owner: 'redirect', journey: null, why: 'Old address for private play.' },
  { path: '/more/points', owner: 'redirect', journey: null, why: 'Old address for the profile.' },
  { path: '/admin', owner: 'redirect', journey: null, why: 'Old address for the admin front page.' },

  /* ---- Euro 2028, which this migration does not touch ---------------- */
  {
    path: '/league/:id',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Euro-scoped. Deferred to Stage 15 deliberately: the tournament league authorities are a different set of reads.',
  },
  {
    path: '/h2h/:rivalId',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Euro-scoped. The WEEKLY head-to-head is absorbed into the vNext player profile; this address is the tournament’s.',
  },
  {
    path: '/tournament/profile',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Euro-scoped, inside the tournament boundary. Stage 15.',
  },
  {
    path: '/tournament/profile/:playerId',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Euro-scoped, inside the tournament boundary. Stage 15.',
  },

  /* ---- Administration, out of vNext scope entirely ------------------- */
  {
    path: '/admin/ai',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Contract 185’s private analytical lab. Hub-only and inside the domestic boundary.',
  },
  {
    path: '/admin/results',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Administration is out of vNext scope entirely.',
  },
  {
    path: '/admin/users',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Administration is out of vNext scope entirely.',
  },
  {
    path: '/admin/season',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Administration is out of vNext scope entirely.',
  },
  {
    path: '/admin/euro',
    owner: 'legacy-permanent',
    journey: null,
    why: 'Contract 143 publication. Deliberately outside the tournament boundary.',
  },
]
