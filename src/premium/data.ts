import type { Club, Fixture, GameMode, LeaderboardEntry, LeagueId } from './types'

const club = (
  id: string,
  name: string,
  shortName: string,
  colour: string,
  form: Club['form'],
): Club => ({ id, name, shortName, colour, form })

export const CLUBS = {
  arsenal: club('arsenal', 'Arsenal', 'ARS', '#E84142', ['W', 'W', 'D', 'W', 'W']),
  liverpool: club('liverpool', 'Liverpool', 'LIV', '#C8102E', ['W', 'W', 'W', 'D', 'W']),
  city: club('city', 'Manchester City', 'MCI', '#6CABDD', ['W', 'D', 'W', 'W', 'L']),
  chelsea: club('chelsea', 'Chelsea', 'CHE', '#4169E1', ['D', 'W', 'L', 'W', 'W']),
  newcastle: club('newcastle', 'Newcastle United', 'NEW', '#F4F1E8', ['W', 'L', 'W', 'D', 'W']),
  spurs: club('spurs', 'Tottenham Hotspur', 'TOT', '#D9E4FF', ['L', 'W', 'D', 'W', 'L']),
  celtic: club('celtic', 'Celtic', 'CEL', '#18A558', ['W', 'W', 'W', 'W', 'D']),
  rangers: club('rangers', 'Rangers', 'RAN', '#3156B3', ['W', 'D', 'W', 'W', 'W']),
  hearts: club('hearts', 'Heart of Midlothian', 'HEA', '#A44A67', ['D', 'W', 'W', 'L', 'W']),
  hibs: club('hibs', 'Hibernian', 'HIB', '#56B870', ['L', 'W', 'D', 'W', 'D']),
  aberdeen: club('aberdeen', 'Aberdeen', 'ABE', '#D94848', ['W', 'L', 'D', 'W', 'L']),
  united: club('united', 'Dundee United', 'DUT', '#F08A3E', ['D', 'L', 'W', 'D', 'W']),
} as const

export const FIXTURES: readonly Fixture[] = [
  { id: 'pl-1', leagueId: 'premier-league', home: CLUBS.arsenal, away: CLUBS.newcastle, kickoff: '2028-02-19T12:30:00Z', venue: 'Emirates Stadium', status: 'upcoming' },
  { id: 'pl-2', leagueId: 'premier-league', home: CLUBS.liverpool, away: CLUBS.chelsea, kickoff: '2028-02-19T15:00:00Z', venue: 'Anfield', status: 'upcoming' },
  { id: 'pl-3', leagueId: 'premier-league', home: CLUBS.city, away: CLUBS.spurs, kickoff: '2028-02-19T17:30:00Z', venue: 'Etihad Stadium', status: 'upcoming' },
  { id: 'scot-1', leagueId: 'scottish-premiership', home: CLUBS.celtic, away: CLUBS.hearts, kickoff: '2028-02-19T12:00:00Z', venue: 'Celtic Park', status: 'upcoming' },
  { id: 'scot-2', leagueId: 'scottish-premiership', home: CLUBS.rangers, away: CLUBS.aberdeen, kickoff: '2028-02-19T15:00:00Z', venue: 'Ibrox Stadium', status: 'upcoming' },
  { id: 'scot-3', leagueId: 'scottish-premiership', home: CLUBS.hibs, away: CLUBS.united, kickoff: '2028-02-19T15:00:00Z', venue: 'Easter Road', status: 'upcoming' },
]

export const GAME_MODES: readonly GameMode[] = [
  {
    id: 'predictor',
    name: 'Predictor',
    eyebrow: 'Every score matters',
    description: 'Call every result. Nail the scoreline. Climb the global table.',
    rule: '3 points exact · 1 point correct result',
    payoff: 'The purest test of your football read.',
    accent: 'var(--signal)',
  },
  {
    id: 'last-man-standing',
    name: 'Last Man Standing',
    eyebrow: 'One pick. No second chance.',
    description: 'Choose one winner each week. Survive, then do it again without repeating a club.',
    rule: 'Win and advance · Draw or lose and you are out',
    payoff: 'Pressure rises as your options disappear.',
    accent: 'var(--amber)',
  },
  {
    id: 'championship',
    name: 'Predictor Championship',
    eyebrow: 'Head to head',
    description: 'Your weekly score against another supporter. Win the fixture, earn three points.',
    rule: 'Regular season · Playoffs · Final',
    payoff: 'Settle the group-chat debate properly.',
    accent: 'var(--sky)',
  },
]

export const LEADERBOARD: readonly LeaderboardEntry[] = [
  { rank: 1, name: 'Maya Reid', club: 'Arsenal', points: 186, accuracy: 68, streak: 7, movement: 1, avatar: 'MR' },
  { rank: 2, name: 'Callum Fraser', club: 'Celtic', points: 181, accuracy: 64, streak: 5, movement: -1, avatar: 'CF' },
  { rank: 3, name: 'Aisha Khan', club: 'Liverpool', points: 178, accuracy: 66, streak: 6, movement: 2, avatar: 'AK' },
  { rank: 4, name: 'Theo Martin', club: 'Newcastle', points: 171, accuracy: 61, streak: 4, movement: 0, avatar: 'TM' },
  { rank: 5, name: 'Jamie Scott', club: 'Hearts', points: 168, accuracy: 60, streak: 3, movement: 3, avatar: 'JS' },
]

export const LEAGUES: Record<LeagueId, { name: string; short: string; week: number; players: string }> = {
  'premier-league': { name: 'Premier League', short: 'England', week: 26, players: '18,420' },
  'scottish-premiership': { name: 'Scottish Premiership', short: 'Scotland', week: 28, players: '7,860' },
}

