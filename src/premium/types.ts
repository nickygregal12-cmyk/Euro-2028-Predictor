export type LeagueId = 'premier-league' | 'scottish-premiership'

export interface Club {
  id: string
  name: string
  shortName: string
  colour: string
  form: readonly ('W' | 'D' | 'L')[]
}

export interface Fixture {
  id: string
  leagueId: LeagueId
  home: Club
  away: Club
  kickoff: string
  venue: string
  status: 'upcoming' | 'live' | 'complete'
  homeScore?: number
  awayScore?: number
}

export interface PredictionScore {
  home: number
  away: number
}

export interface LeaderboardEntry {
  rank: number
  name: string
  club: string
  points: number
  accuracy: number
  streak: number
  movement: number
  avatar: string
}

export interface GameMode {
  id: 'predictor' | 'last-man-standing' | 'championship'
  name: string
  eyebrow: string
  description: string
  rule: string
  payoff: string
  accent: string
}

