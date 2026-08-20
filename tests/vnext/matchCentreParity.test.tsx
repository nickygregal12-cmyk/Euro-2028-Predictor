import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextMatchCentre } from '../../src/vnext/matches/VNextMatchCentre'
import { matchCentreScenarios } from '../../src/vnext/fixtures'

/**
 * THE CUTOVER MUST NOT COST A JOURNEY THAT ALREADY WORKS.
 *
 * ============================ WHAT THIS IS MEASURING ====================
 *
 * Stage 14's contract says the stage does NOT own "creative redesign of already
 * accepted vNext surfaces" — and by the same token it must not own a feature
 * regression. The production Season Match Centre composes three deliberately
 * separate things and `SeasonFixtureLeagues` names them: **You** is the
 * reader's own prediction and points; **Your leagues** is named, private and
 * league-scoped; **Everyone** is anonymous, platform-wide and has a minimum
 * cohort.
 *
 * vNext's Match Centre shipped with a stronger presentation and none of the
 * three. A cutover in that state would have moved every reader from a page that
 * told them what a fixture was worth to one that did not.
 *
 * ============================ AND WHAT IT IS NOT ========================
 *
 * Not a demand that vNext look like the old page. Nothing here asserts a
 * layout, a heading order or a word. It asserts CAPABILITY: that the same facts
 * are reachable, from the same reads, with the same boundaries.
 *
 * NOTHING NEW IS INVENTED, AND A CASE HOLDS THAT TOO. No venue, no referee, no
 * lineups, no statistics, no event timeline and no broadcast — every one of
 * them absent from the platform, and every one of them still absent here.
 */

function renderCentre(model: Parameters<typeof VNextMatchCentre>[0]['model']) {
  return render(
    <VNextRoot>
      <VNextMatchCentre model={model} />
    </VNextRoot>,
  )
}

const zone = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

describe('YOU — what this fixture was worth to the reader', () => {
  it('states the prediction, the outcome and the points', () => {
    const { container } = renderCentre(matchCentreScenarios.socialRich)
    const you = zone(container, 'you')
    expect(you).toBeTruthy()
    expect(you?.textContent).toContain('2 - 1')
    expect(you?.textContent).toContain('Exact score. 5 points from this fixture.')
  })

  it('says the Joker doubles the matchweek and never one fixture', () => {
    // The production Match Centre records this word for word: saying "doubled"
    // beside a fixture invites a player to double it themselves and get a
    // different answer from the server's.
    const { container } = renderCentre(matchCentreScenarios.socialRich)
    expect(zone(container, 'joker')?.textContent).toContain('never one fixture')
  })

  it('says nothing about what an unsettled fixture might be worth', () => {
    const { container } = renderCentre(matchCentreScenarios.socialHiddenLeague)
    const you = zone(container, 'you')
    expect(you?.textContent).toContain('1 - 0')
    expect(you?.textContent).not.toMatch(/\bpoints from this fixture\b/)
  })

  it('tells a non-entrant they are not playing, not that they missed something', () => {
    const { container } = renderCentre(matchCentreScenarios.socialNotPlaying)
    const you = zone(container, 'you')
    expect(you?.textContent).toContain('not playing the Match Predictor')
    expect(you?.textContent).not.toMatch(/no prediction|deadline|missed/i)
  })

  it('names a failed read as a failed read', () => {
    const { container } = renderCentre(matchCentreScenarios.socialUnavailable)
    expect(zone(container, 'you')?.textContent).toContain('could not read your entry')
  })
})

describe('YOUR LEAGUES — the people the reader actually plays with', () => {
  it('names co-members and their predictions once the server revealed them', () => {
    const { container } = renderCentre(matchCentreScenarios.socialRich)
    const leagues = zone(container, 'your-leagues') as HTMLElement
    expect(leagues.textContent).toContain('The Sunday League')
    expect(within(leagues).getByText('Bo Nilsson')).toBeTruthy()
    expect(leagues.textContent).toContain('1 - 1')
  })

  it('marks the reader in their own league', () => {
    const leagues = zone(
      renderCentre(matchCentreScenarios.socialRich).container,
      'your-leagues',
    ) as HTMLElement
    expect(leagues.textContent).toContain('(you)')
  })

  it('says hidden rather than empty before the matchweek locks, and counts nothing', () => {
    // Contract 149 withholds how many members have played before the lock.
    // Printing a number here would leak precisely what the read withheld.
    const { container } = renderCentre(matchCentreScenarios.socialHiddenLeague)
    const leagues = zone(container, 'your-leagues') as HTMLElement
    expect(leagues.textContent).toContain('hidden until the matchweek locks')
    expect(leagues.textContent).not.toMatch(/\d+ of \d+|\d+ members|\d+ predicted/)
  })

  it('keeps hidden, empty and unavailable as three different sentences', () => {
    const hidden = renderCentre(matchCentreScenarios.socialHiddenLeague).container
    const hiddenText = zone(hidden, 'your-leagues')?.textContent ?? ''
    expect(hiddenText).toContain('hidden until the matchweek locks')
    expect(hiddenText).toContain('Nobody in this league predicted this fixture')

    const failed = renderCentre(matchCentreScenarios.socialUnavailable).container
    expect(zone(failed, 'your-leagues')?.textContent).toContain('could not read this league')
  })

  it('draws no league section at all for a reader in none', () => {
    const { container } = renderCentre(matchCentreScenarios.socialNotPlaying)
    expect(zone(container, 'your-leagues')).toBeNull()
  })
})

describe('EVERYONE — anonymous, platform-wide, and never a league', () => {
  it('states the three-way split and the popular scorelines', () => {
    const { container } = renderCentre(matchCentreScenarios.socialRich)
    const everyone = zone(container, 'everyone') as HTMLElement
    expect(everyone.textContent).toContain('46% home')
    expect(everyone.textContent).toContain('1 - 1')
  })

  it('states its denominator, so a percentage can be weighed', () => {
    const everyone = zone(
      renderCentre(matchCentreScenarios.socialRich).container,
      'everyone',
    ) as HTMLElement
    expect(everyone.textContent).toContain('From 412 predictions')
  })

  it('carries no name anywhere', () => {
    // The whole point of the scope. A consensus that named somebody would be a
    // league, and the two must never read as one section.
    const everyone = zone(
      renderCentre(matchCentreScenarios.socialRich).container,
      'everyone',
    ) as HTMLElement
    for (const name of ['Ada Lovelace', 'Bo Nilsson', 'The Sunday League']) {
      expect(everyone.textContent, name).not.toContain(name)
    }
  })

  it('says the cohort was withheld rather than showing an empty summary', () => {
    const { container } = renderCentre(matchCentreScenarios.socialHiddenLeague)
    expect(zone(container, 'everyone')?.textContent).toContain('Not enough people have predicted')
  })
})

describe('one enrichment failing degrades only that module', () => {
  it('leaves the fixture itself complete when all three fail', () => {
    const { container } = renderCentre(matchCentreScenarios.socialUnavailable)
    // The match is still the match: both clubs, the state and the hero.
    expect(zone(container, 'match-hero')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.textContent).toContain('Glenmore Athletic')
    expect(container.textContent).toContain('Strathkelvin United')
  })

  it('draws a module that answered beside one that did not', () => {
    const { container } = renderCentre(matchCentreScenarios.socialNotPlaying)
    // `you` cannot answer and `everyone` can. Both are drawn.
    expect(zone(container, 'you')?.textContent).toContain('not playing')
    expect(zone(container, 'everyone')?.textContent).toContain('46% home')
  })

  it('draws nothing at all where the host loaded no module', () => {
    // A story, a render test and a page-scoped harness all legitimately have
    // this shape, and it must not read as "there is nothing".
    const { container } = renderCentre(matchCentreScenarios.richContext)
    expect(zone(container, 'you')).toBeNull()
    expect(zone(container, 'your-leagues')).toBeNull()
    expect(zone(container, 'everyone')).toBeNull()
  })
})

describe('nothing the platform does not have is invented to fill the page', () => {
  it('leaves every absent capability null in every world', () => {
    // Venue, referee, lineups, statistics, an event timeline and broadcast:
    // not one of them exists in this platform for a league season. The model
    // keeps a field for each so the contract stays capable, and every world
    // must still answer null — a decorative module that made the page look
    // complete is exactly what Stage 14 forbids.
    for (const [name, model] of Object.entries(matchCentreScenarios)) {
      for (const [field, value] of Object.entries({
        venue: model.venue,
        broadcast: model.broadcast,
        referee: model.referee,
        timeline: model.timeline,
        statistics: model.statistics,
        lineups: model.lineups,
      })) {
        expect(value, `${name} invented a ${field}`).toBeNull()
      }
    }
  })

  it('never lets the mapper produce one either', () => {
    const mapper = readFileSync(
      resolve(process.cwd(), 'src/vnext/integration/matches/buildMatchCentreModel.ts'),
      'utf8',
    )
    for (const field of ['venue', 'broadcast', 'referee', 'timeline', 'statistics', 'lineups']) {
      expect(mapper, `${field} is no longer hard-null in the mapper`).toMatch(
        new RegExp(`^\\s*${field}: null,`, 'm'),
      )
    }
  })

  it('adds no provider beyond the ones the adapter already reads', () => {
    // The whole social layer is built from reads the production Match Centre
    // already makes. A new provider import here would be exactly the
    // "add a provider to make the page look fuller" that Stage 14 forbids.
    const acquisition = readFileSync(
      resolve(process.cwd(), 'src/vnext/integration/matches/useVNextMatchCentreSource.ts'),
      'utf8',
    )
    for (const forbidden of ['sportmonks', 'football-data', 'api-sports']) {
      expect(acquisition.toLowerCase(), forbidden).not.toContain(forbidden)
    }
  })
})

describe('the fan-out stays on the page it belongs to', () => {
  it('gives the Matches LIST no field any of this could hang off', () => {
    // §20's rule, held by the type: a list that could carry a per-fixture
    // social read is a list that will make one read per row.
    const model = readFileSync(resolve(process.cwd(), 'src/vnext/models/matches.ts'), 'utf8')
    const listItem = model.slice(
      model.indexOf('export type MatchListItem = {'),
      model.indexOf('}', model.indexOf('export type MatchListItem = {')),
    )
    for (const field of ['you', 'leagues', 'everyone']) {
      expect(listItem, `MatchListItem grew a ${field} field`).not.toMatch(
        new RegExp(`readonly ${field}\\b`),
      )
    }
  })
})
