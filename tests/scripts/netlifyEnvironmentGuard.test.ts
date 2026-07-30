import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(
  process.cwd(),
  'scripts/validate-netlify-environment.mjs',
)

const prodRef = 'vkfnsqdyhvtwyqkisxhk'
const devRef = 'iouzoutneyjpugbbtdem'
const prodUrl = `https://${prodRef}.supabase.co`
const devUrl = `https://${devRef}.supabase.co`

/**
 * Synthetic, unsigned Supabase-shaped JWT. The guard decodes the payload and
 * never verifies the signature, so no real key is needed — and none may be
 * committed. `publishable-test-key` was used before and is not a real key
 * format, so it no longer satisfies the guard.
 */
function jwtKey(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.unsigned`
}

const anonKey = (ref: string) => jwtKey({ iss: 'supabase', ref, role: 'anon' })
const dummyKey = 'sb_publishable_localtestkeyonly'

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

  describe('browser key safety', () => {
    it('accepts an anon JWT issued for the context project', () => {
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: 'production',
          VITE_SUPABASE_URL: prodUrl,
          VITE_SUPABASE_ANON_KEY: anonKey(prodRef),
        }),
      ).not.toThrow()
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: 'deploy-preview',
          VITE_SUPABASE_URL: devUrl,
          VITE_SUPABASE_ANON_KEY: anonKey(devRef),
        }),
      ).not.toThrow()
    })

    it.each(['service_role', 'authenticated', 'supabase_admin'])(
      'refuses to ship a %s key to the browser',
      (role) => {
        // A non-anon key in the bundle bypasses row-level security for every
        // visitor. The URL checks alone cannot detect this.
        expect(
          run({
            NETLIFY: 'true',
            CONTEXT: 'production',
            VITE_SUPABASE_URL: prodUrl,
            VITE_SUPABASE_ANON_KEY: jwtKey({ iss: 'supabase', ref: prodRef, role }),
          }),
        ).toThrow()
      },
    )

    it.each(['sb_secret_abc123', 'sbp_personalaccesstoken', 'service_role_key'])(
      'refuses the non-publishable key form %s',
      (key) => {
        expect(
          run({
            NETLIFY: 'true',
            CONTEXT: 'production',
            VITE_SUPABASE_URL: prodUrl,
            VITE_SUPABASE_ANON_KEY: key,
          }),
        ).toThrow()
      },
    )

    it('rejects a key issued for the other project', () => {
      // Crossed configuration: right URL, wrong project's key. Previously passed.
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: 'production',
          VITE_SUPABASE_URL: prodUrl,
          VITE_SUPABASE_ANON_KEY: anonKey(devRef),
        }),
      ).toThrow()
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: 'deploy-preview',
          VITE_SUPABASE_URL: devUrl,
          VITE_SUPABASE_ANON_KEY: anonKey(prodRef),
        }),
      ).toThrow()
    })

    it('rejects an unrecognised key format', () => {
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: 'production',
          VITE_SUPABASE_URL: prodUrl,
          VITE_SUPABASE_ANON_KEY: 'publishable-test-key',
        }),
      ).toThrow()
    })
  })
})
