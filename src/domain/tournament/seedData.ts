// Placeholder seed data for building and testing domain logic in isolation.
// Team names are placeholders — replace with the real Euro 2028 qualified
// teams once qualifying is complete. Structure is what matters right now,
// not which real teams sit where.

export type Team = {
  id: string
  name: string
}

export type Group = {
  id: string
  name: string
  teamIds: string[]
}

export const teams: Team[] = [
  { id: 't1', name: 'Team A1' },
  { id: 't2', name: 'Team A2' },
  { id: 't3', name: 'Team A3' },
  { id: 't4', name: 'Team A4' },
  { id: 't5', name: 'Team B1' },
  { id: 't6', name: 'Team B2' },
  { id: 't7', name: 'Team B3' },
  { id: 't8', name: 'Team B4' },
]

export const groups: Group[] = [
  { id: 'gA', name: 'Group A', teamIds: ['t1', 't2', 't3', 't4'] },
  { id: 'gB', name: 'Group B', teamIds: ['t5', 't6', 't7', 't8'] },
]
