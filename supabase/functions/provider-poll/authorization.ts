// Who may invoke `provider-poll`, as a pure decision.
//
// WHY THIS IS A SEPARATE MODULE, and it is the same reason `providerDecoders.ts`
// is. `index.ts` calls `Deno.serve` at module scope and exports nothing, so it
// cannot be imported by the Vitest suite — importing it would run the server on a
// runtime where `Deno` is undefined. Until this extraction the only thing that
// ever EXECUTED the authorisation rule was one step in
// `.github/workflows/database-parity.yml`, which curls the deployed function and
// asserts a 401. That probe is good, and it is not a substitute for being able to
// state the rule's edge cases: it exercises exactly one request shape, and it only
// runs when that workflow's path filter matches.
//
// The two tests that named this rule asserted on TEXT rather than behaviour —
// `databaseParityWorkflow.test.ts` checks the YAML contains `test "$status" =
// '401'`, and `providerPollContract.test.ts` reads `index.ts` as a string. Both
// remain worth having; neither could tell you what happens when the header is
// absent, or a prefix of the key, or the right length and the wrong bytes.
//
// Nothing here reads the environment, holds a credential or performs I/O. The
// caller supplies both values, so the rule is assertable with fabricated input.

/**
 * Whether two strings are equal, in time that does not depend on where they
 * first differ.
 *
 * The comparison is over UTF-8 bytes and always walks the full length of the
 * longer input. A length difference is folded into the same accumulator rather
 * than returned early, because returning early on length is itself a signal —
 * it tells an attacker how long the secret is.
 */
export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  let mismatch = leftBytes.length ^ rightBytes.length

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return mismatch === 0
}

/**
 * Whether a request carries the dedicated caller key.
 *
 * FAIL CLOSED ON AN ABSENT HEADER, which is the case the deployed probe covers:
 * a request with no `apikey` at all is refused before anything reads a provider
 * credential or spends a request against a paid quota. It is refused the same way
 * a wrong key is, so the response cannot be used to tell the two apart.
 *
 * The header name is `apikey`, lower-case, because that is what Supabase's own
 * gateway forwards. `Headers` lookup is case-insensitive, so a caller sending
 * `APIKey` is still read — and a test pins that, since relying on it silently
 * would make a future rewrite to a plain object a security change disguised as a
 * refactor.
 */
export function authorized(request: Request, secretKey: string): boolean {
  const supplied = request.headers.get('apikey')
  return supplied !== null && constantTimeEqual(supplied, secretKey)
}
