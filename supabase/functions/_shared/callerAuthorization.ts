// Who may invoke an Edge Function, as a pure decision.
//
// This is the shared home for the rule. `provider-poll/authorization.ts` still
// carries its own copy and is deliberately NOT repointed here: it is a live
// Production function at version 14, this change cannot be deployed or
// exercised from the repository, and re-pointing an import in a function that
// guards paid provider credentials is not a change to make blind. When somebody
// next deploys `provider-poll`, that copy should be deleted in favour of this
// one — the two are identical today and a test pins that they stay so.
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
 * FAIL CLOSED ON AN ABSENT HEADER: a request with no `apikey` at all is refused
 * before anything reads a credential, and it is refused the same way a wrong
 * key is, so the response cannot be used to tell the two apart.
 *
 * The header name is `apikey`, lower-case, because that is what Supabase's own
 * gateway forwards. `Headers` lookup is case-insensitive, so a caller sending
 * `APIKey` is still read — and a test pins that, since relying on it silently
 * would make a future rewrite to a plain object a security change disguised as
 * a refactor.
 */
export function authorized(request: Request, secretKey: string): boolean {
  const supplied = request.headers.get('apikey')
  return supplied !== null && constantTimeEqual(supplied, secretKey)
}
