#!/usr/bin/env node

import { Buffer } from 'node:buffer'

const PRODUCTION_PROJECT_REF = 'vkfnsqdyhvtwyqkisxhk'
const DEVELOPMENT_PROJECT_REF = 'iouzoutneyjpugbbtdem'
const NON_PRODUCTION_CONTEXTS = new Set([
  'deploy-preview',
  'branch-deploy',
  'dev',
])

// `VITE_SUPABASE_ANON_KEY` is compiled into the browser bundle, so it must be a
// key that is safe to publish. Anything server-side grade bypasses row-level
// security for every visitor.
const PUBLISHABLE_KEY_PREFIX = 'sb_publishable_'
const NEVER_PUBLISHABLE_PREFIXES = [
  'sb_secret_', // Supabase secret key
  'sbp_', // Supabase personal access token
  'service_role', // a pasted role name rather than a key
]

/**
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
function decodeJwtPayload(token) {
  const segments = token.split('.')
  if (segments.length !== 3) return null

  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    )
    return typeof payload === 'object' && payload !== null ? payload : null
  } catch {
    return null
  }
}

/**
 * Verifies the browser key is publishable and belongs to the context's project.
 *
 * The URL checks above cannot catch either failure: a build can pair the correct
 * project URL with the other project's key, or with a secret key, and still
 * satisfy them. The signature is deliberately not verified — that needs the
 * project's JWT secret, which must never be present in a build.
 */
/**
 * @param {string} key
 * @param {string} expectedProjectRef
 * @param {string} context
 */
function verifySupabaseKey(key, expectedProjectRef, context) {
  const lowered = key.toLowerCase()
  for (const prefix of NEVER_PUBLISHABLE_PREFIXES) {
    if (lowered.startsWith(prefix)) {
      throw new Error(
        `Netlify ${context} build supplies a non-publishable ` +
          `VITE_SUPABASE_ANON_KEY (starts with "${prefix}"). This key is ` +
          'compiled into the browser bundle and would bypass row-level ' +
          'security. Use the project publishable/anon key.',
      )
    }
  }

  if (key.startsWith(PUBLISHABLE_KEY_PREFIX)) {
    // Publishable keys carry no decodable project reference; the URL check is
    // the project boundary for this format.
    return { format: 'publishable' }
  }

  const payload = decodeJwtPayload(key)
  if (payload) {
    if (payload.role !== 'anon') {
      throw new Error(
        `Netlify ${context} build supplies a VITE_SUPABASE_ANON_KEY whose ` +
          `role is "${payload.role}", not "anon". A non-anon key must never ` +
          'reach the browser bundle.',
      )
    }

    if (payload.ref && payload.ref !== expectedProjectRef) {
      throw new Error(
        `Netlify ${context} build supplies a VITE_SUPABASE_ANON_KEY for ` +
          `project "${payload.ref}" but expects "${expectedProjectRef}". The ` +
          'Supabase URL and key must reference the same project.',
      )
    }

    return { format: 'anon-jwt', projectRef: payload.ref ?? null }
  }

  throw new Error(
    `Netlify ${context} build supplies an unrecognised ` +
      'VITE_SUPABASE_ANON_KEY format. Expected a publishable key ' +
      `("${PUBLISHABLE_KEY_PREFIX}…") or an anon JWT.`,
  )
}

/**
 * ADR 0026's site variant and the origin it publishes.
 *
 * This runs on every build, Netlify or not, because both failures it catches
 * are silent: a variant of `Euro` or `hub ` resolves to the Hub (fail-closed,
 * and correct — but not what the operator asked for, and nothing would say so),
 * and an unparseable `VITE_PUBLIC_SITE_ORIGIN` simply drops the canonical tag,
 * the Open Graph URLs and the whole sitemap with no error anywhere.
 *
 * It refuses the build rather than warning. A site that quietly deploys as the
 * other product, or with no canonical URL, is worse than one that does not
 * deploy — and both are trivially fixed by correcting an environment variable.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {'hub' | 'euro'}
 */
function validateSiteVariant(env) {
  const rawVariant = (env.VITE_SITE_VARIANT ?? '').trim()
  if (rawVariant !== '' && rawVariant !== 'hub' && rawVariant !== 'euro') {
    throw new Error(
      `VITE_SITE_VARIANT is "${rawVariant}", which is neither "hub" nor ` +
        '"euro". The build would fail closed to the Hub, so the Euro site ' +
        'would silently deploy as the weekly platform.',
    )
  }

  for (const name of ['VITE_PUBLIC_SITE_ORIGIN', 'VITE_SIBLING_SITE_ORIGIN']) {
    const raw = (env[name] ?? '').trim()
    if (!raw) continue
    let parsed
    try {
      parsed = new URL(raw)
    } catch {
      throw new Error(
        `${name} is "${raw}", which is not an absolute URL. It would be ` +
          'discarded and the metadata that depends on it silently omitted.',
      )
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`${name} must be an http(s) origin; got "${raw}".`)
    }
  }

  return rawVariant === '' ? 'hub' : rawVariant
}

export function validateNetlifyEnvironment(env = process.env) {
  const siteVariant = validateSiteVariant(env)

  const isNetlify = env.NETLIFY === 'true'
  const context = env.CONTEXT?.trim()

  // Ordinary local and GitHub Actions builds do not have a Netlify context.
  if (!isNetlify && !context) {
    return {
      checked: false,
      siteVariant,
      message:
        `Not a Netlify build; environment isolation check skipped. Site ` +
        `variant "${siteVariant}".`,
    }
  }

  if (!context) {
    throw new Error('Netlify build is missing CONTEXT.')
  }

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `Netlify ${context} build is missing VITE_SUPABASE_URL or ` +
        'VITE_SUPABASE_ANON_KEY.',
    )
  }

  if (context === 'production') {
    if (!supabaseUrl.includes(PRODUCTION_PROJECT_REF)) {
      throw new Error(
        'Production Netlify build is not configured for production Supabase.',
      )
    }

    if (supabaseUrl.includes(DEVELOPMENT_PROJECT_REF)) {
      throw new Error(
        'Production Netlify build must never use development Supabase.',
      )
    }

    const key = verifySupabaseKey(supabaseKey, PRODUCTION_PROJECT_REF, context)

    return {
      checked: true,
      context,
      expectedProjectRef: PRODUCTION_PROJECT_REF,
      keyFormat: key.format,
      siteVariant,
    }
  }

  if (NON_PRODUCTION_CONTEXTS.has(context)) {
    if (!supabaseUrl.includes(DEVELOPMENT_PROJECT_REF)) {
      throw new Error(
        `Netlify ${context} build must use development Supabase.`,
      )
    }

    if (supabaseUrl.includes(PRODUCTION_PROJECT_REF)) {
      throw new Error(
        `Netlify ${context} build must never use production Supabase.`,
      )
    }

    const key = verifySupabaseKey(supabaseKey, DEVELOPMENT_PROJECT_REF, context)

    return {
      checked: true,
      context,
      expectedProjectRef: DEVELOPMENT_PROJECT_REF,
      keyFormat: key.format,
      siteVariant,
    }
  }

  throw new Error(`Unrecognised Netlify CONTEXT: ${context}`)
}

try {
  const result = validateNetlifyEnvironment()
  console.log(
    result.message ??
      `Netlify ${result.context} environment verified; site variant ` +
        `"${result.siteVariant}".`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Netlify environment verification failed: ${message}`)
  process.exitCode = 1
}
