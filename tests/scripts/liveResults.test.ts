/**
 * ADR 0008 accepted a NARROW live-results channel. The properties that make it
 * narrow are the ones worth asserting: it opens in one place, it carries no
 * payload anyone could believe, it collapses a burst into one refetch, it goes
 * away, and it stays shut until a deployment turns it on.
 *
 * Each test names the failure it exists to catch. "subscribe was called" would
 * pass while the channel leaked, so none of these assert that.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

function trackedSourceFiles(): string[] {
  return execFileSync('git', ['ls-files', 'src'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => /\.tsx?$/.test(path))
}

describe('the live-results channel is the only one', () => {
  it('opens a Supabase channel in exactly one module', () => {
    // The fan-out ADR 0008 rejected begins with a second component deciding it
    // may subscribe for itself. Counting the openers is the cheapest guard, and
    // it fails on the file that was added rather than on a symptom later.
    const openers = trackedSourceFiles().filter((file) => /\.channel\(/.test(source(file)))
    expect(openers).toEqual(['src/services/supabase/liveResults.ts'])
  })

  it('hands callers nothing, so no score can arrive over the wire', () => {
    // The structural reason this cannot become a second source of match truth.
    // A handler that named its payload could leak a live score into the UI, and
    // a callback taking an argument invites exactly that.
    const module = source('src/services/supabase/liveResults.ts')
    expect(module).toContain('onChange: () => void')
    expect(module).toMatch(/\.on\(\s*'postgres_changes',[\s\S]*?,\s*\(\)\s*=>/)
  })

  it('removes the channel rather than only unsubscribing it', () => {
    // An unsubscribed but still-attached channel reconnects for the life of the
    // tab -- a leak that looks like nothing until the request count is read.
    expect(source('src/services/supabase/liveResults.ts')).toContain('removeChannel')
  })

  it('subscribes to matches and to nothing else', () => {
    // ADR 0008 rejected realtime over broad user-owned or scoring tables.
    const tables = [...source('src/services/supabase/liveResults.ts').matchAll(
      /table:\s*'([a-z_]+)'/g,
    )].map((match) => match[1])
    expect(tables).toEqual(['matches'])
  })
})

describe('the hosted capability flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('fails closed on every value but the exact string', async () => {
    // "Guarded until hosted operational evidence exists." A truthy-looking
    // value must not open a socket against a database without contract 218.
    for (const value of ['', 'false', '1', 'TRUE', 'True', 'yes', 'on']) {
      vi.resetModules()
      vi.stubEnv('VITE_LIVE_UPDATES_ENABLED', value)
      const module = await import('../../src/app/providers/liveResultsConfig')
      expect(module.liveUpdatesEnabled, `value ${JSON.stringify(value)}`).toBe(false)
    }
  })

  it('opens only on exactly true', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_LIVE_UPDATES_ENABLED', 'true')
    const module = await import('../../src/app/providers/liveResultsConfig')
    expect(module.liveUpdatesEnabled).toBe(true)
  })

  it('reads the flag without constructing a Supabase client', () => {
    // The flag is consulted by tests and by paths that must not build a client
    // just to learn the feature is off, so its module imports nothing.
    expect(source('src/app/providers/liveResultsConfig.ts')).not.toContain('import ')
  })

  it('lets a surface consume the version without importing the transport', () => {
    // Depending on live updates must not drag the Supabase client into a
    // consumer's import graph, or every test of that surface has to mock a
    // realtime channel it never uses. The context module imports only React.
    const context = source('src/app/providers/liveResultsContext.ts')
    expect(context).toContain("from 'react'")
    expect(context).not.toContain('services/supabase')
    for (const consumer of [
      'src/features/league/OverallStandingsPage.tsx',
      'src/features/home/useHomeData.ts',
    ]) {
      expect(source(consumer), consumer).toContain("providers/liveResultsContext'")
      expect(source(consumer), consumer).not.toContain("providers/LiveResultsProvider'")
    }
  })

  it('is declared in both files the environment contract requires', () => {
    expect(source('src/vite-env.d.ts')).toContain('VITE_LIVE_UPDATES_ENABLED')
    expect(source('.env.example')).toContain('VITE_LIVE_UPDATES_ENABLED')
  })
})

describe('the provider holds one subscription', () => {
  const provider = source('src/app/providers/LiveResultsProvider.tsx')

  it('opens nothing without a session', () => {
    // `matches` is readable by authenticated users; an anonymous subscriber
    // would be holding a socket entitled to nothing.
    expect(provider).toContain('if (!liveUpdatesEnabled || !userId) return')
  })

  it('coalesces a burst into one version advance', () => {
    // A confirmed result rewrites several rows and a correction rewrites them
    // again. Without a trailing window every row would be its own refetch.
    expect(source('src/app/providers/liveResultsConfig.ts')).toMatch(/COALESCE_MS\s*=\s*\d+/)
    expect(provider).toContain('COALESCE_MS')
    expect(provider).toContain('clearTimeout')
  })

  it('tears the channel down and cancels the pending timer', () => {
    // Either one left behind outlives the provider.
    const teardown = provider.slice(provider.indexOf('return () => {'))
    expect(teardown).toContain('unsubscribe()')
    expect(teardown).toContain('clearTimeout')
  })
})

describe('the standings list refreshes in the background', () => {
  const page = source('src/features/league/OverallStandingsPage.tsx')
  const liveEffect = page.slice(
    page.indexOf('if (fetchedAtVersionRef.current === resultsVersion) return'),
    page.indexOf('}, [resultsVersion, tournamentId, state])'),
  )

  it('has a live effect at all', () => {
    // Guards the slice above: if the effect is renamed away, the assertions
    // below would silently be testing an empty string.
    expect(liveEffect.length).toBeGreaterThan(200)
  })

  it('never blanks the list nor errors over good data', () => {
    // A confirmed goal must not replace the standings with a skeleton, and a
    // failed background refresh must not evict a page the player is reading.
    expect(liveEffect).not.toContain("status: 'loading'")
    expect(liveEffect).not.toContain("status: 'error'")
  })

  it('leaves a list deeper than one clamped page alone', () => {
    // get_leaderboard clamps a page at 100. Refetching 100 while 150 are shown
    // would silently drop 50 rows the player had already loaded.
    expect(page).toContain('MAX_LIVE_REFRESH_ROWS = 100')
    expect(liveEffect).toContain('if (shown > MAX_LIVE_REFRESH_ROWS) {')
  })

  it('records the version even when it declines to refresh a deep list', () => {
    // Otherwise the effect re-evaluates on every later state change, forever
    // finding the versions unequal and never settling.
    const skip = liveEffect.slice(liveEffect.indexOf('if (shown > MAX_LIVE_REFRESH_ROWS) {'))
    expect(skip.slice(0, skip.indexOf('}'))).toContain('fetchedAtVersionRef.current = resultsVersion')
  })

  it('never asks for a zero-row page, which the RPC rejects', () => {
    // A ready-but-empty board would otherwise send limit: 0 and raise 22023.
    expect(liveEffect).toContain('Math.min(Math.max(shown, PAGE_SIZE), MAX_LIVE_REFRESH_ROWS)')
  })

  it('scrolls to the player once, not on every refresh', () => {
    // This ran on every state change, so loading another page -- and now a live
    // refresh -- pulled the viewport back while they were reading elsewhere.
    expect(page).toContain('if (hasScrolledToYou.current) return')
  })

  it('replays an invalidation that arrived while the page was loading', () => {
    // The failure this catches: a signal lands mid-load, the effect sees a
    // non-ready state and drops it, the in-flight request returns a pre-change
    // snapshot, and the page stays stale until the next goal. Depending on
    // `state` re-runs the effect on the transition to ready; comparing the
    // applied version is what makes that re-run do something.
    expect(page).toContain('}, [resultsVersion, tournamentId, state])')
    expect(liveEffect).toContain('fetchedAtVersionRef.current = startedAtVersion')
  })
})

describe('overlapping standings requests cannot corrupt each other', () => {
  const page = source('src/features/league/OverallStandingsPage.tsx')

  it('gives all three fetch paths one shared generation', () => {
    // First load/retry, live refresh and load-more can be in flight together.
    // Each must claim the counter on the way out and check it on the way back.
    const claims = page.match(/\+\+requestGenerationRef\.current/g) ?? []
    expect(claims).toHaveLength(3)
    const checks = page.match(/generation !== requestGenerationRef\.current/g) ?? []
    expect(checks.length).toBeGreaterThanOrEqual(3)
  })

  it('drops a paging response that a refresh has overtaken', () => {
    // The concrete corruption: load-more's cursor belongs to the ranking as it
    // stood before the refresh, so merging its rows by position splices
    // pre-change entries into the refreshed head and carries a stale
    // nextCursor with them -- duplicates, gaps, and paging that walks nowhere.
    const loadMore = page.slice(page.indexOf('async function loadMore()'))
    const guard = loadMore.indexOf('if (generation !== requestGenerationRef.current) return')
    const merge = loadMore.indexOf('setState((current) => {')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(merge)
  })

  it('does not raise a paging error the player can no longer act on', () => {
    const loadMore = page.slice(page.indexOf('async function loadMore()'))
    expect(loadMore).toContain('if (generation === requestGenerationRef.current) {')
  })

  it('always clears the paging spinner, superseded or not', () => {
    // A stuck spinner is worse than a list that refreshed underneath.
    const marker = '} finally {'
    const finallyBlock = page.slice(page.indexOf(marker) + marker.length)
    expect(finallyBlock.slice(0, finallyBlock.indexOf('}'))).toContain('setLoadingMore(false)')
  })

  it('reads the live version through a ref in the effect that ignores it', () => {
    // The first-load effect must not depend on the version (that would blank
    // the page on every goal) but still has to record which snapshot it got.
    expect(page).toContain('const startedAtVersion = versionRef.current')
    expect(page).toContain('}, [tournamentId, reloadKey])')
  })
})

describe('Home refreshes in the background', () => {
  const hook = source('src/features/home/useHomeData.ts')

  it('takes the live version as a dependency', () => {
    expect(hook).toContain('useLiveResultsVersion()')
    expect(hook).toMatch(/\}, \[[^\]]*resultsVersion\]\)/)
  })

  it('does not blank a rendered Home, nor error over it', () => {
    expect(hook).toContain('const isBackgroundRefresh')
    expect(hook).toContain('if (!isBackgroundRefresh) setState')
    expect(hook).toContain('if (active && !isBackgroundRefresh)')
  })

  it('will not let a superseded run persist an older points snapshot', () => {
    // updateLastSeen WRITES. The other guards in this chain protect React
    // state, which a superseded run simply fails to set -- but an unguarded
    // write from a slower older run lands last and overwrites a newer total
    // with a lower one, so the player's next visit shows a wrong catch-up.
    expect(hook).toContain('if (active) void updateLastSeen(')
  })
})

describe('contract 218 publishes the table', () => {
  const migration = source('supabase/migrations/20260824100000_live_results_channel.sql')

  it('adds matches to the realtime publication', () => {
    expect(migration).toContain('alter publication supabase_realtime add table public.matches')
  })

  it('is idempotent in both directions', () => {
    // Re-running must not fail on an already-published table, and a bare
    // Postgres without Supabase's own publication must not fail either.
    expect(migration).toContain('pg_publication_tables')
    expect(migration).toContain('create publication supabase_realtime')
  })

  it('does not broadcast old row images', () => {
    // Nothing needs the pre-update row to decide to refetch. Turning this on
    // should be a decision someone makes, not a default nobody noticed.
    expect(migration).not.toMatch(/replica\s+identity\s+full/i)
  })

  it('publishes exactly one table', () => {
    const added = [...migration.matchAll(/add table (\S+)/g)].map((match) => match[1])
    expect(added).toEqual(['public.matches;'])
  })
})
