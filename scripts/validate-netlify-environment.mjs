#!/usr/bin/env node

const PRODUCTION_PROJECT_REF = 'vkfnsqdyhvtwyqkisxhk'
const DEVELOPMENT_PROJECT_REF = 'iouzoutneyjpugbbtdem'
const NON_PRODUCTION_CONTEXTS = new Set([
  'deploy-preview',
  'branch-deploy',
  'dev',
])

export function validateNetlifyEnvironment(env = process.env) {
  const isNetlify = env.NETLIFY === 'true'
  const context = env.CONTEXT?.trim()

  // Ordinary local and GitHub Actions builds do not have a Netlify context.
  if (!isNetlify && !context) {
    return {
      checked: false,
      message: 'Not a Netlify build; environment isolation check skipped.',
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

    return {
      checked: true,
      context,
      expectedProjectRef: PRODUCTION_PROJECT_REF,
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

    return {
      checked: true,
      context,
      expectedProjectRef: DEVELOPMENT_PROJECT_REF,
    }
  }

  throw new Error(`Unrecognised Netlify CONTEXT: ${context}`)
}

try {
  const result = validateNetlifyEnvironment()
  console.log(result.message ?? `Netlify ${result.context} environment verified.`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Netlify environment verification failed: ${message}`)
  process.exitCode = 1
}
