// Bounded support reads for the Admin Control Room.
//
// This is deliberately an Edge Function rather than a browser table grant or a
// broad service-role proxy. The caller is re-resolved through Supabase Auth,
// capability is taken ONLY from server-owned app_metadata, every action has its
// own narrow query, and the service-role credential never leaves this runtime.
// There are no writes in this function.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Capability = 'users' | 'leagues'
type AuthUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  created_at?: string | null
  last_sign_in_at?: string | null
  banned_until?: string | null
  deleted_at?: string | null
  app_metadata?: Record<string, unknown> | null
}
type Profile = {
  id: string
  display_name: string | null
  created_at: string | null
  last_seen_at: string | null
  welcomed_at: string | null
  reminder_emails: boolean | null
  onboarding_step: string | null
  onboarding_completed_at: string | null
}

type RestConfig = { url: string; serviceKey: string }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function capabilityAllowed(user: AuthUser, capability: Capability): boolean {
  const metadata = user.app_metadata
  if (!metadata || typeof metadata !== 'object') return false
  if (metadata.admin_role === 'super_admin') return true
  const values = metadata.admin_capabilities
  return Array.isArray(values) && values.includes(capability)
}

function cleanQuery(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 80).replace(/[^\p{L}\p{N}@._ '-]/gu, '')
}

function boundedLimit(value: unknown, maximum: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.max(1, Math.min(maximum, value))
    : Math.min(20, maximum)
}

async function authenticatedUser(request: Request, url: string, anonKey: string): Promise<AuthUser | null> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization } })
  if (!response.ok) return null
  const value = await response.json()
  return value && typeof value === 'object' ? value as AuthUser : null
}

async function serviceJson<T>(config: RestConfig, path: string): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    headers: { apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}` },
  })
  if (!response.ok) throw new Error(`bounded admin read failed (${response.status})`)
  return await response.json() as T
}

function inFilter(values: readonly string[]): string {
  return `in.(${values.join(',')})`
}

function counts(rows: readonly { user_id: string }[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const row of rows) result.set(row.user_id, (result.get(row.user_id) ?? 0) + 1)
  return result
}

async function searchUsers(config: RestConfig, query: string, limit: number) {
  if (query.length < 2) return { query, users: [], note: 'Enter at least two characters.' }

  const profileQuery = new URLSearchParams({
    select: 'id,display_name,created_at,last_seen_at,welcomed_at,reminder_emails,onboarding_step,onboarding_completed_at',
    limit: String(limit),
  })
  if (UUID.test(query)) profileQuery.set('id', `eq.${query}`)
  else profileQuery.set('display_name', `ilike.*${query}*`)

  const profiles = await serviceJson<Profile[]>(config, `/rest/v1/profiles?${profileQuery}`)
  const ids = profiles.map((profile) => profile.id)
  if (ids.length === 0) return { query, users: [] }

  const [authUsers, leagueRows, gameRows, followRows] = await Promise.all([
    Promise.all(ids.map(async (id) => {
      try {
        return await serviceJson<AuthUser>(config, `/auth/v1/admin/users/${id}`)
      } catch {
        return null
      }
    })),
    serviceJson<{ user_id: string }[]>(config, `/rest/v1/league_members?select=user_id&user_id=${encodeURIComponent(inFilter(ids))}`),
    // Membership is a lifecycle, not a historical row count. A player who left
    // or was disqualified is not currently in that game and must not be shown
    // as one more active membership in support tooling.
    serviceJson<{ user_id: string }[]>(config, `/rest/v1/game_memberships?select=user_id&status=eq.active&user_id=${encodeURIComponent(inFilter(ids))}`),
    serviceJson<{ user_id: string }[]>(config, `/rest/v1/competition_follows?select=user_id&user_id=${encodeURIComponent(inFilter(ids))}`),
  ])

  const byId = new Map(authUsers.filter((user): user is AuthUser => user !== null).map((user) => [user.id, user]))
  const leagueCounts = counts(leagueRows)
  const gameCounts = counts(gameRows)
  const followCounts = counts(followRows)

  return {
    query,
    users: profiles.map((profile) => {
      const user = byId.get(profile.id)
      const banned = user?.banned_until ? new Date(user.banned_until).getTime() > Date.now() : false
      return {
        supportRef: profile.id,
        displayName: profile.display_name ?? 'Player',
        email: user?.email ?? null,
        accountStatus: user?.deleted_at ? 'deleted' : banned ? 'banned' : 'active',
        createdAt: user?.created_at ?? profile.created_at,
        emailConfirmedAt: user?.email_confirmed_at ?? null,
        lastSignInAt: user?.last_sign_in_at ?? null,
        lastSeenAt: profile.last_seen_at,
        welcomedAt: profile.welcomed_at,
        onboardingStep: profile.onboarding_step,
        onboardingCompletedAt: profile.onboarding_completed_at,
        reminderEmails: profile.reminder_emails,
        followedCompetitions: followCounts.get(profile.id) ?? 0,
        gameMemberships: gameCounts.get(profile.id) ?? 0,
        leagueMemberships: leagueCounts.get(profile.id) ?? 0,
      }
    }),
  }
}

type LeagueRow = {
  id: string
  tournament_id: string
  owner_id: string
  name: string
  created_at: string
  game_competition_id: string | null
}
type PrivateCompetitionRow = {
  id: string
  tournament_id: string
  game_key: string
  availability_status: string | null
  completed_at: string | null
  created_at: string
  name: string | null
  owner_id: string | null
}
type LinkedGameRow = {
  id: string
  game_key: string
}

async function searchLeagues(config: RestConfig, query: string, limit: number) {
  if (query.length < 2) return { query, containers: [], note: 'Enter at least two characters.' }

  const leagueQuery = new URLSearchParams({
    select: 'id,tournament_id,owner_id,name,created_at,game_competition_id',
    name: `ilike.*${query}*`,
    order: 'created_at.desc',
    limit: String(limit),
  })
  const privateQuery = new URLSearchParams({
    select: 'id,tournament_id,game_key,availability_status,completed_at,created_at,name,owner_id',
    visibility_kind: 'eq.private',
    name: `ilike.*${query}*`,
    order: 'created_at.desc',
    limit: String(limit),
  })

  const [leagues, privateGames] = await Promise.all([
    serviceJson<LeagueRow[]>(config, `/rest/v1/leagues?${leagueQuery}`),
    serviceJson<PrivateCompetitionRow[]>(config, `/rest/v1/bonus_competitions?${privateQuery}`),
  ])

  const leagueIds = leagues.map((league) => league.id)
  const privateIds = privateGames.map((competition) => competition.id)
  // A league's linked game may not contain the league-name search term. Resolve
  // those ids directly instead of asking the filtered private-game result set
  // to double as a game catalogue — that inference mislabels real LMS/Cup
  // leagues as Match Predictor when their container name differs.
  const linkedGameIds = [...new Set(leagues.flatMap((league) => league.game_competition_id ? [league.game_competition_id] : []))]
  const allGameIds = [...new Set([...privateIds, ...linkedGameIds])]
  const ownerIds = [...new Set([
    ...leagues.map((league) => league.owner_id),
    ...privateGames.flatMap((competition) => competition.owner_id ? [competition.owner_id] : []),
  ])]
  const tournamentIds = [...new Set([
    ...leagues.map((league) => league.tournament_id),
    ...privateGames.map((competition) => competition.tournament_id),
  ])]

  const [leagueMembers, gameMembers, linkedGames, owners, tournaments] = await Promise.all([
    leagueIds.length === 0 ? [] : serviceJson<{ league_id: string }[]>(config, `/rest/v1/league_members?select=league_id&league_id=${encodeURIComponent(inFilter(leagueIds))}`),
    allGameIds.length === 0 ? [] : serviceJson<{ game_competition_id: string }[]>(config, `/rest/v1/game_memberships?select=game_competition_id&status=eq.active&game_competition_id=${encodeURIComponent(inFilter(allGameIds))}`),
    linkedGameIds.length === 0 ? [] : serviceJson<LinkedGameRow[]>(config, `/rest/v1/bonus_competitions?select=id,game_key&id=${encodeURIComponent(inFilter(linkedGameIds))}`),
    ownerIds.length === 0 ? [] : serviceJson<{ id: string; display_name: string | null }[]>(config, `/rest/v1/profiles?select=id,display_name&id=${encodeURIComponent(inFilter(ownerIds))}`),
    tournamentIds.length === 0 ? [] : serviceJson<{ id: string; name: string; status: string | null }[]>(config, `/rest/v1/tournaments?select=id,name,status&id=${encodeURIComponent(inFilter(tournamentIds))}`),
  ])

  const leagueMemberCounts = new Map<string, number>()
  for (const row of leagueMembers) leagueMemberCounts.set(row.league_id, (leagueMemberCounts.get(row.league_id) ?? 0) + 1)
  const gameMemberCounts = new Map<string, number>()
  for (const row of gameMembers) gameMemberCounts.set(row.game_competition_id, (gameMemberCounts.get(row.game_competition_id) ?? 0) + 1)
  const gameKeys = new Map(linkedGames.map((game) => [game.id, game.game_key]))
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.display_name ?? 'Player']))
  const seasonNames = new Map(tournaments.map((tournament) => [tournament.id, { name: tournament.name, status: tournament.status }]))

  const normal = leagues.map((league) => ({
    kind: 'league',
    id: league.id,
    name: league.name,
    seasonName: seasonNames.get(league.tournament_id)?.name ?? null,
    gameType: league.game_competition_id ? gameKeys.get(league.game_competition_id) ?? null : 'main_predictor',
    ownerName: ownerNames.get(league.owner_id) ?? 'Player',
    memberCount: leagueMemberCounts.get(league.id) ?? 0,
    createdAt: league.created_at,
    lifecycle: seasonNames.get(league.tournament_id)?.status ?? null,
  }))
  const games = privateGames
    .filter((competition) => !leagues.some((league) => league.game_competition_id === competition.id))
    .map((competition) => ({
      kind: 'private-game',
      id: competition.id,
      name: competition.name ?? 'Private game',
      seasonName: seasonNames.get(competition.tournament_id)?.name ?? null,
      gameType: competition.game_key,
      ownerName: competition.owner_id ? ownerNames.get(competition.owner_id) ?? 'Player' : 'Unknown',
      memberCount: gameMemberCounts.get(competition.id) ?? 0,
      createdAt: competition.created_at,
      lifecycle: competition.completed_at ? 'complete' : competition.availability_status,
    }))

  return { query, containers: [...normal, ...games].slice(0, limit) }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS })
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let url: string
  let anonKey: string
  let serviceKey: string
  try {
    url = required('SUPABASE_URL')
    anonKey = required('SUPABASE_ANON_KEY')
    serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
  } catch {
    return json({ error: 'server boundary is not configured' }, 503)
  }

  const caller = await authenticatedUser(request, url, anonKey)
  if (!caller) return json({ error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return json({ error: 'invalid request' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const query = cleanQuery(body.query)
  const config = { url, serviceKey }

  try {
    if (action === 'search-users') {
      if (!capabilityAllowed(caller, 'users')) return json({ error: 'forbidden' }, 403)
      return json(await searchUsers(config, query, boundedLimit(body.limit, 20)))
    }
    if (action === 'search-leagues') {
      if (!capabilityAllowed(caller, 'leagues')) return json({ error: 'forbidden' }, 403)
      return json(await searchLeagues(config, query, boundedLimit(body.limit, 30)))
    }
    return json({ error: 'unknown action' }, 400)
  } catch {
    // Do not echo database/Auth bodies: these reads include support data.
    return json({ error: 'admin support read failed' }, 502)
  }
})
