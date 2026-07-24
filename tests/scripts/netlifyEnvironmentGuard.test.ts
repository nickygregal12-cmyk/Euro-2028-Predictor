import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(
  process.cwd(),
  'scripts/validate-netlify-environment.mjs',
)

const prodUrl = 'https://vkfnsqdyhvtwyqkisxhk.supabase.co'
const devUrl = 'https://iouzoutneyjpugbbtdem.supabase.co'
const dummyKey = 'publishable-test-key'

function run(overrides: NodeJS.ProcessEnv = {}) {
  return () =>
    execFileSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        NETLIFY: undefined,
        CONTEXT: undefined,
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_ANON_KEY: undefined,
        ...overrides,
      },
      encoding: 'utf8',
      stdio: 'pipe',
    })
}

describe('Netlify environment guard', () => {
  it('skips ordinary non-Netlify builds', () => {
    expect(run()).not.toThrow()
  })

  it('accepts production only with production Supabase', () => {
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'production',
        VITE_SUPABASE_URL: prodUrl,
        VITE_SUPABASE_ANON_KEY: dummyKey,
      }),
    ).not.toThrow()
  })

  it.each(['deploy-preview', 'branch-deploy', 'dev'])(
    'accepts %s only with development Supabase',
    (context) => {
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: context,
          VITE_SUPABASE_URL: devUrl,
          VITE_SUPABASE_ANON_KEY: dummyKey,
        }),
      ).not.toThrow()
    },
  )

  it('rejects production using development Supabase', () => {
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'production',
        VITE_SUPABASE_URL: devUrl,
        VITE_SUPABASE_ANON_KEY: dummyKey,
      }),
    ).toThrow()
  })

  it.each(['deploy-preview', 'branch-deploy', 'dev'])(
    'rejects %s using production Supabase',
    (context) => {
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: context,
          VITE_SUPABASE_URL: prodUrl,
          VITE_SUPABASE_ANON_KEY: dummyKey,
        }),
      ).toThrow()
    },
  )

  it('rejects recognised Netlify contexts with missing configuration', () => {
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'deploy-preview',
      }),
    ).toThrow()
  })

  it('rejects unknown Netlify contexts', () => {
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'unexpected-context',
        VITE_SUPABASE_URL: devUrl,
        VITE_SUPABASE_ANON_KEY: dummyKey,
      }),
    ).toThrow()
  })
})
