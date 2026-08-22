import type { PrivateLmsChoice, PrivateLmsPageModel, PrivateLmsRoundState } from '../../models/privateLms'
import type { PrivateLmsSource } from './privateLmsSource'

function caller(source: PrivateLmsSource) {
  return source.workspace.members.find((member) => member.isMe) ?? null
}

function stateOf(source: PrivateLmsSource): PrivateLmsRoundState {
  const round = source.workspace.currentRound
  const me = caller(source)
  if (round === null) return 'no-round'
  if (source.workspace.caller.membershipStatus !== 'active' || me === null) return 'not-entered'
  if (me.outcome === 'eliminated') return 'eliminated'
  if (me.hasPickedCurrentRound === true) return 'picked'
  if (round.locked) return 'locked'

  const now = Date.parse(source.generatedAt)
  if (round.opensAt === null || round.locksAt === null) return 'not-open'
  if (Date.parse(round.opensAt) > now) return 'not-open'
  if (Date.parse(round.locksAt) <= now) return 'locked'
  return 'open'
}

function choicesOf(source: PrivateLmsSource): readonly PrivateLmsChoice[] {
  if (stateOf(source) !== 'open' || source.fixtures === null) return []

  // Contract 183 documents this exact-name join: the matchweek-card names and
  // `teams.name` are sourced from the same row, so no fuzzy club matching is
  // introduced merely to obtain the canonical id the write requires.
  const ids = new Map(source.clubs.map((club) => [club.name, club.teamId]))
  const choices: PrivateLmsChoice[] = []
  for (const fixture of source.fixtures.fixtures) {
    const homeId = ids.get(fixture.homeName)
    const awayId = ids.get(fixture.awayName)
    if (!homeId || !awayId) continue
    choices.push({
      key: `${fixture.id}:home`,
      teamId: homeId,
      name: fixture.homeName,
      fixtureId: fixture.id,
      kickoffAt: fixture.kickoffAt,
    })
    choices.push({
      key: `${fixture.id}:away`,
      teamId: awayId,
      name: fixture.awayName,
      fixtureId: fixture.id,
      kickoffAt: fixture.kickoffAt,
    })
  }
  return choices
}

export function buildPrivateLmsModel(source: PrivateLmsSource): PrivateLmsPageModel {
  const round = source.workspace.currentRound
  return {
    context: {
      competitionName: source.context.competitionName,
      seasonLabel: source.context.seasonLabel,
      privateCompetitionName: source.workspace.competition.name,
    },
    round: {
      label: round?.label ?? null,
      opensAt: round?.opensAt ?? null,
      locksAt: round?.locksAt ?? null,
      state: stateOf(source),
    },
    memberCount: source.workspace.memberCount,
    inviteCode: source.workspace.caller.isOwner ? source.workspace.caller.inviteCode : null,
    choices: choicesOf(source),
  }
}
