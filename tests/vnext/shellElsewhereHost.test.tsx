import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { buildShellModel } from '../../src/vnext/integration/shell/buildShellModel'
import type { ShellSourceElsewhere } from '../../src/vnext/integration/shell/shellSource'
import { VNextShell } from '../../src/vnext/app/VNextShell'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { presentPlayInbox } from '../../src/features/hub/playInboxModel'

/**
 * THE HOST THAT MAKES THE CROSS-COMPETITION LAYER REACHABLE.
 *
 * `useVNextShellElsewhere` was written, tested and unreachable: it says in its
 * own header that it must be mounted once above page navigation, every
 * connected screen grew a `shellElsewhere` prop, and nothing ever passed one.
 * So the attention layer was empty in the running product for the one reason
 * that never shows in a screenshot.
 *
 * These cases hold the acceptance the architecture states, at the level each
 * one actually lives at: the MAPPER decides what a shell says about elsewhere,
 * and the HOST decides how many times the reads are paid for.
 */

const ACTIVE = {
  tournamentId: 'season-premier',
  name: 'Premier League',
  seasonLabel: '2027/28',
  colours: { primary: '#38003c', accent: '#00ff85' },
}

function elsewhereWith(options: {
  readonly competitions: readonly { id: string; name: string; season: string }[]
  readonly inbox: ShellSourceElsewhere['inbox']
}): ShellSourceElsewhere {
  return {
    competitions: options.competitions.map((entry) => ({
      tournamentId: entry.id,
      name: entry.name,
      seasonLabel: entry.season,
    })),
    inbox: options.inbox,
  }
}

function renderShell(node: ReactNode) {
  return render(<VNextRoot>{node}</VNextRoot>)
}

describe('the shell a host with several competitions builds', () => {
  it('keeps the one-competition shape when the host loaded nothing', () => {
    const model = buildShellModel({
      competition: ACTIVE,
      playerName: 'Sam',
      outstandingGames: null,
      canNavigateAway: true,
      elsewhere: null,
    })

    expect(model.contexts).toHaveLength(1)
    expect(model.attention).toEqual([])
  })

  it('offers the other competitions without repeating the active one', () => {
    const model = buildShellModel({
      competition: ACTIVE,
      playerName: 'Sam',
      outstandingGames: null,
      canNavigateAway: true,
      elsewhere: elsewhereWith({
        competitions: [
          // The active competition appears in the player's list too — two reads
          // that overlap. Joining on `tournamentId` is what stops the switcher
          // showing the current competition twice.
          { id: 'season-premier', name: 'Premier League', season: '2027/28' },
          { id: 'season-scottish', name: 'Scottish Premiership', season: '2027/28' },
        ],
        inbox: null,
      }),
    })

    expect(model.contexts.map((context) => context.competition.id)).toEqual([
      'season-premier',
      'season-scottish',
    ])
    expect(model.activeContextId).toBe('season-premier')
  })

  it('draws no attention while the reads are still out', () => {
    // `null` is not an empty inbox. An empty one claims "nothing is waiting",
    // and that claim has not been made yet.
    const model = buildShellModel({
      competition: ACTIVE,
      playerName: 'Sam',
      outstandingGames: null,
      canNavigateAway: true,
      elsewhere: elsewhereWith({
        competitions: [{ id: 'season-scottish', name: 'Scottish Premiership', season: '2027/28' }],
        inbox: null,
      }),
    })

    expect(model.attention).toEqual([])
  })

  it('never offers a Jump the application cannot answer', () => {
    // `games` and `leagues` are empty on every context the application can build
    // today, and the shell must draw no shortcut it cannot honour. An inert
    // control is worse than an absent one.
    const model = buildShellModel({
      competition: ACTIVE,
      playerName: 'Sam',
      outstandingGames: null,
      canNavigateAway: true,
      elsewhere: elsewhereWith({
        competitions: [{ id: 'season-scottish', name: 'Scottish Premiership', season: '2027/28' }],
        inbox: presentPlayInbox([], new Date('2026-08-22T12:00:00.000Z')),
      }),
    })

    for (const context of model.contexts) {
      expect(context.games).toEqual([])
      expect(context.leagues).toEqual([])
    }

    renderShell(
      <VNextShellProvider model={model} onIntent={vi.fn()}>
        <VNextShell destination="home">
          <p>Page</p>
        </VNextShell>
      </VNextShellProvider>,
    )

    // No shortcut group means no Jump control anywhere in the chrome.
    expect(screen.queryByRole('button', { name: /jump/i })).toBeNull()
  })
})

const integrationRoot = resolve(process.cwd(), 'src/vnext/integration')

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

describe('the expensive read is acquired once, above the pages', () => {
  const integrationFiles = filesUnder(integrationRoot)

  it('has exactly one caller of the cross-competition acquisition hook', () => {
    // `useGlobalPlayInbox` costs a play-context read plus up to three game reads
    // PER COMPETITION. A second caller is a second set of those reads, and a
    // caller inside a page is that set again on every navigation.
    const callers = [
      ...integrationFiles,
      ...filesUnder(resolve(process.cwd(), 'src/dev')),
    ].filter((file) => {
      if (file.endsWith('useVNextShellElsewhere.ts')) return false
      return /import[^\n]*useVNextShellElsewhere/.test(readFileSync(file, 'utf8'))
    })

    expect(callers.map((file) => file.replace(`${process.cwd()}/`, ''))).toEqual([
      'src/vnext/integration/shell/VNextShellElsewhereHost.tsx',
    ])
  })

  it('makes every connected screen read the host rather than only a prop', () => {
    // A screen that resolved `props.shellElsewhere ?? null` would ignore the
    // host entirely — and would pass every existing test, because every
    // existing test passes the prop.
    const screens = integrationFiles.filter((file) => /Screen\.tsx$/.test(file))
    const offenders = screens.filter((file) => {
      const source = readFileSync(file, 'utf8')
      if (!source.includes('shellElsewhere')) return false
      return !source.includes('useShellElsewhere(props.shellElsewhere)')
    })

    expect(screens.length).toBeGreaterThanOrEqual(10)
    expect(
      offenders.map((file) => file.replace(`${process.cwd()}/`, '')),
      'a connected screen resolves shellElsewhere without consulting the host',
    ).toEqual([])
  })

  it('mounts the host outside the harness destination switch', () => {
    // The harness is the only place the persistent shape is exercised today, so
    // the property it exists to demonstrate is worth holding: one host, wrapping
    // all four destinations rather than sitting inside one of them.
    const harness = readFileSync(resolve(process.cwd(), 'src/dev/VNextHubPreview.tsx'), 'utf8')
    const opens = harness.match(/<VNextShellElsewhereHost>/g) ?? []
    expect(opens).toHaveLength(1)
    expect(harness.indexOf('<VNextShellElsewhereHost>')).toBeLessThan(
      harness.indexOf('<VNextHomeScreen'),
    )
  })
})
