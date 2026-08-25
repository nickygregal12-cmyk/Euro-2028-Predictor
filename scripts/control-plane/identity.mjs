/**
 * Which identity performs an autonomous action, and how much authority that
 * identity is allowed to carry.
 *
 * WHY THIS EXISTS. #1041 proposed granting the Builder task-branch push and
 * pull-request creation. Nothing in that change said *who* would be pushing.
 * The answer mattered and was unrecorded: on this host both the read-only
 * verification credential and the write credential resolve to the owner's own
 * GitHub user, so an autonomous push is indistinguishable in the audit record
 * from the owner pushing by hand.
 *
 * That is survivable for repository work — the action is still attributable to
 * a real account, and a bad branch is revertible. It is not survivable for a
 * Production executor, where "which actor applied this migration" is the whole
 * question. So authority is made a function of identity rather than a separate
 * grant: an identity that is merely the owner's own account cannot be handed
 * deployment authority, no matter what a task, a prompt or a model asserts.
 *
 * Fetching is deliberately not here, matching `ruleset.mjs` and `github.mjs`:
 * callers reach GitHub by different routes and none of them should be able to
 * change the verdict. This module decides from what they observed.
 *
 * Nothing here accepts, stores, logs or returns a credential value. It reasons
 * only about the actor a credential resolved to.
 */

/**
 * @typedef {{ kind: 'env', name: string } | { kind: 'command', argv: string[] } | { kind: 'none' }} LaneCredential
 *
 * @typedef {{ purpose?: string, credential?: LaneCredential, authority: string,
 *             identityClass: string,
 *             expectedActor: { login: string, id: number, type?: string } | null }} IdentityLane
 *
 * @typedef {{ lanes: Record<string, IdentityLane>,
 *             distinctFrom?: Record<string, string[]> }} IdentityRecord
 *
 * @typedef {{ readable: boolean, login?: string, id?: number, type?: string }} ObservedActor
 */

/**
 * Authority a lane may hold, weakest first. The order is the comparison: a
 * ceiling is "this index or lower".
 */
export const AUTHORITY_LEVELS = Object.freeze([
  'NONE',
  'READ_ONLY',
  'REPOSITORY_WRITE',
  'DEPLOYMENT_EXECUTOR',
])

/**
 * What kind of actor a lane's credential resolves to.
 *
 * `OWNER_ATTRIBUTED` is the honest description of a lane whose credential is
 * the owner's own account: real, attributable, and not a separate executor.
 * `MACHINE` is a distinct non-owner actor. `UNPROVISIONED` is a lane that has
 * deliberately not been given a credential yet.
 */
export const IDENTITY_CLASSES = Object.freeze([
  'UNPROVISIONED',
  'OWNER_ATTRIBUTED',
  'MACHINE',
])

/**
 * The most authority each identity class may hold.
 *
 * This is the rule the whole module exists to enforce. `UNPROVISIONED` gets
 * nothing because there is no actor to attribute to. `OWNER_ATTRIBUTED` stops
 * at `REPOSITORY_WRITE` because a branch and a pull request are reviewable and
 * revertible, and a Production apply is neither. Only a distinct `MACHINE`
 * actor may reach `DEPLOYMENT_EXECUTOR`.
 */
/** @type {Readonly<Record<string, string>>} */
const CEILING_BY_CLASS = Object.freeze({
  UNPROVISIONED: 'NONE',
  OWNER_ATTRIBUTED: 'REPOSITORY_WRITE',
  MACHINE: 'DEPLOYMENT_EXECUTOR',
})

/**
 * @param {string} authority
 * @returns {number} index in `AUTHORITY_LEVELS`, or -1 when unknown.
 */
function authorityRank(authority) {
  return AUTHORITY_LEVELS.indexOf(authority)
}

/**
 * The most authority this identity class may hold.
 *
 * @param {string} identityClass
 * @returns {string | null} an authority level, or null when the class is unknown.
 */
export function authorityCeiling(identityClass) {
  return CEILING_BY_CLASS[identityClass] ?? null
}

/**
 * Narrow an untrusted value to a record shape, or null when it is not one.
 *
 * The guard is deliberately shallow: it establishes only that `lanes` is an
 * object to iterate. Every field inside is then validated individually, because
 * a record that merely has the right shape is not thereby correct.
 *
 * @param {unknown} value
 * @returns {IdentityRecord | null}
 */
function asRecord(value) {
  if (!value || typeof value !== 'object') return null
  const lanes = /** @type {{ lanes?: unknown }} */ (value).lanes
  if (!lanes || typeof lanes !== 'object') return null
  return /** @type {IdentityRecord} */ (value)
}

/**
 * Structural verdict on the tracked record alone. No network.
 *
 * Catches the failures a clone can see: an unknown authority or identity class,
 * a lane holding more authority than its class permits, a provisioned lane with
 * no actor to attribute to, an unprovisioned lane that has quietly acquired
 * one, and a `distinctFrom` constraint naming a lane that does not exist.
 *
 * @param {unknown} record
 * @returns {{ ok: boolean, lanes: Array<{ name: string, authority: string, identityClass: string,
 *            ceiling: string | null, ok: boolean }>, problems: string[] }}
 */
export function evaluateIdentityRecord(record) {
  /** @type {string[]} */
  const problems = []

  const parsed = asRecord(record)
  if (!parsed) {
    // Not "no lanes". An unreadable record reads exactly like a record that
    // declares no authority anywhere, which is the shape a caller would happily
    // proceed past. Fail closed instead.
    return { ok: false, lanes: [], problems: ['the identity record is missing or is not an object'] }
  }

  const laneNames = Object.keys(parsed.lanes)
  if (laneNames.length === 0) problems.push('the identity record declares no lanes')

  const lanes = laneNames.map((name) => {
    const lane = parsed.lanes[name]
    // Stringified rather than defaulted: an absent field must be reported as an
    // unknown value, not quietly replaced by a valid-looking one.
    const authority = String(lane?.authority)
    const identityClass = String(lane?.identityClass)
    const expectedActor = lane?.expectedActor
    const ceiling = authorityCeiling(identityClass)
    const before = problems.length

    if (!IDENTITY_CLASSES.includes(identityClass)) {
      problems.push(`lane '${name}' has unknown identity class '${identityClass}'`)
    }
    if (!AUTHORITY_LEVELS.includes(authority)) {
      problems.push(`lane '${name}' has unknown authority '${authority}'`)
    }
    if (ceiling && AUTHORITY_LEVELS.includes(authority) && authorityRank(authority) > authorityRank(ceiling)) {
      problems.push(
        `lane '${name}' claims ${authority} but its identity class ${identityClass} ceilings at ${ceiling}`,
      )
    }
    if (identityClass === 'UNPROVISIONED' && expectedActor) {
      problems.push(`lane '${name}' is UNPROVISIONED yet names an expected actor`)
    }
    if (identityClass !== 'UNPROVISIONED' && !expectedActor) {
      problems.push(`lane '${name}' is ${identityClass} yet names no expected actor to attribute to`)
    }
    if (expectedActor && (typeof expectedActor.login !== 'string' || typeof expectedActor.id !== 'number')) {
      problems.push(`lane '${name}' has an expected actor without both a login and a numeric id`)
    }

    // The credential source is data the verifier consumes, not prose beside it.
    // The first version of this record described the repository lane's source in
    // a string nothing read, and the command resolved that lane from an ambient
    // fallback instead — reporting PROVED against a different credential than
    // the record named. A declared source no code reads cannot be wrong, which
    // is the problem with it.
    const credential = lane?.credential
    const kind = credential?.kind
    if (credential && kind === 'env') {
      if (typeof credential.name !== 'string' || credential.name.length === 0) {
        problems.push(`lane '${name}' declares an env credential without a variable name`)
      }
    } else if (credential && kind === 'command') {
      if (!Array.isArray(credential.argv) || credential.argv.length === 0
        || credential.argv.some((part) => typeof part !== 'string' || part.length === 0)) {
        problems.push(`lane '${name}' declares a command credential without a non-empty argv`)
      }
    } else if (kind === 'none') {
      if (identityClass !== 'UNPROVISIONED') {
        problems.push(`lane '${name}' is ${identityClass} yet declares no credential to resolve it from`)
      }
    } else {
      problems.push(`lane '${name}' has unknown credential kind '${kind}'`)
    }
    if (kind !== 'none' && identityClass === 'UNPROVISIONED') {
      problems.push(`lane '${name}' is UNPROVISIONED yet declares a credential to resolve`)
    }

    return { name, authority, identityClass, ceiling, ok: problems.length === before }
  })

  /** @param {string} laneName */
  const actorId = (laneName) => parsed.lanes[laneName]?.expectedActor?.id

  for (const [lane, others] of Object.entries(parsed.distinctFrom ?? {})) {
    if (!laneNames.includes(lane)) problems.push(`distinctFrom names unknown lane '${lane}'`)
    for (const other of others ?? []) {
      if (!laneNames.includes(other)) {
        problems.push(`distinctFrom['${lane}'] names unknown lane '${other}'`)
        continue
      }
      // Checked here, from the record, and not only against what the live run
      // observes. The offline half is the one CI runs, so a constraint enforced
      // only live is a constraint the merge gate cannot apply.
      const [id, otherId] = [actorId(lane), actorId(other)]
      if (id !== undefined && id === otherId) {
        problems.push(`lanes '${lane}' and '${other}' are declared distinct but name the same actor id`)
      }
    }
  }

  // MACHINE is not a label a record may award itself.
  //
  // This is the escalation that made the ceiling table decorative: set the
  // deployment lane to MACHINE with the owner's own id, and it passed the
  // offline check and was granted DEPLOYMENT_EXECUTOR — through the very gate
  // that exists to stop authority being self-granted. `distinctFrom` did not
  // help, because it is editable data in the same file, and relabelling a lane
  // can simply drop it.
  //
  // So the invariant is unconditional rather than declared: an actor that any
  // lane calls the owner's is not a machine anywhere in this record.
  const ownerActorIds = new Set(
    laneNames
      .filter((name) => parsed.lanes[name]?.identityClass === 'OWNER_ATTRIBUTED')
      .map((name) => actorId(name))
      .filter((id) => typeof id === 'number'),
  )
  for (const name of laneNames) {
    if (parsed.lanes[name]?.identityClass !== 'MACHINE') continue
    const id = actorId(name)
    if (id !== undefined && ownerActorIds.has(id)) {
      problems.push(
        `lane '${name}' claims MACHINE but names an actor another lane records as owner-attributed`,
      )
    }
  }

  return { ok: problems.length === 0, lanes, problems }
}

/**
 * Verdict on what the credentials actually resolved to.
 *
 * `observations` maps lane name to what that lane's credential reported, or to
 * `{ readable: false }` when it could not be resolved at all. An unresolved
 * provisioned lane is a failure, never a pass: an identity that cannot be
 * proved is exactly the case this gate exists for.
 *
 * @param {unknown} record
 * @param {Record<string, ObservedActor>} observations
 * @returns {{ ok: boolean, lanes: Array<{ name: string, state: string, detail: string }>, problems: string[] }}
 */
export function evaluateObservedIdentity(record, observations) {
  const structural = evaluateIdentityRecord(record)
  const parsed = asRecord(record)
  if (!structural.ok || !parsed) return { ok: false, lanes: [], problems: structural.problems }

  /** @type {string[]} */
  const problems = []
  /** @type {Array<{ name: string, state: string, detail: string }>} */
  const lanes = []
  /** @type {Record<string, number>} */
  const resolvedIds = {}

  for (const [name, lane] of Object.entries(parsed.lanes)) {
    const observed = observations[name]

    if (lane.identityClass === 'UNPROVISIONED') {
      if (observed && observed.readable) {
        // The dangerous direction. A lane recorded as having no credential has
        // acquired one, which means authority exists that no record describes.
        problems.push(
          `lane '${name}' is recorded UNPROVISIONED but resolved to ${observed.login ?? 'an actor'}`,
        )
        lanes.push({ name, state: 'UNEXPECTED_CREDENTIAL', detail: `resolved to ${observed.login ?? 'unknown'}` })
      } else {
        lanes.push({ name, state: 'UNPROVISIONED', detail: 'no credential, and none expected' })
      }
      continue
    }

    if (!observed || !observed.readable) {
      problems.push(`lane '${name}' could not be resolved; an unproved identity is not a proved one`)
      lanes.push({ name, state: 'UNRESOLVED', detail: 'the credential did not resolve to an actor' })
      continue
    }

    const expected = lane.expectedActor
    if (!expected) {
      problems.push(`lane '${name}' is ${lane.identityClass} yet names no expected actor`)
      lanes.push({ name, state: 'UNRESOLVED', detail: 'no expected actor to compare against' })
      continue
    }
    if (observed.id !== expected.id || observed.login !== expected.login) {
      problems.push(
        `lane '${name}' resolved to ${observed.login}#${observed.id}, not the recorded ${expected.login}#${expected.id}`,
      )
      lanes.push({ name, state: 'MISMATCH', detail: `resolved to ${observed.login}#${observed.id}` })
      continue
    }

    resolvedIds[name] = /** @type {number} */ (observed.id)
    lanes.push({
      name,
      state: 'PROVED',
      detail: `${observed.login}#${observed.id} (${lane.identityClass}, ceiling ${lane.authority})`,
    })
  }

  for (const [lane, others] of Object.entries(parsed.distinctFrom ?? {})) {
    for (const other of others ?? []) {
      // Only comparable once both actually resolved. Two lanes that both failed
      // to resolve are not thereby "distinct".
      if (resolvedIds[lane] === undefined || resolvedIds[other] === undefined) continue
      if (resolvedIds[lane] === resolvedIds[other]) {
        problems.push(`lanes '${lane}' and '${other}' must be distinct actors but resolved to the same id`)
      }
    }
  }

  return { ok: problems.length === 0, lanes, problems }
}

/**
 * Whether a lane may perform an action needing `required` authority.
 *
 * The single entry point a dispatcher should use. It re-derives the ceiling
 * from the identity class rather than trusting the recorded authority, so a
 * record edited to claim more than its class permits still refuses.
 *
 * @param {unknown} record
 * @param {string} laneName
 * @param {string} required
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function authorityForLane(record, laneName, required) {
  // Coherence first, and for the whole record rather than this lane alone. The
  // invariants that matter most are relational — a MACHINE lane naming an
  // owner's actor is only detectable by reading the other lanes — so a
  // per-lane check would answer from exactly the fields an escalation edits.
  // Blocking the merge is not enough on its own: this is what a dispatcher
  // calls, and it may be handed a record that never went through a gate.
  const structural = evaluateIdentityRecord(record)
  if (!structural.ok) {
    return { allowed: false, reason: `the identity record is not coherent: ${structural.problems[0]}` }
  }

  const lane = asRecord(record)?.lanes?.[laneName]
  if (!lane) return { allowed: false, reason: `no identity lane '${laneName}' is recorded` }

  const ceiling = authorityCeiling(lane.identityClass)
  if (!ceiling) return { allowed: false, reason: `lane '${laneName}' has unknown identity class` }
  if (!AUTHORITY_LEVELS.includes(required)) {
    return { allowed: false, reason: `unknown required authority '${required}'` }
  }

  const granted = authorityRank(lane.authority) > authorityRank(ceiling) ? ceiling : lane.authority
  if (authorityRank(granted) < authorityRank(required)) {
    return {
      allowed: false,
      reason: `lane '${laneName}' holds ${granted} (${lane.identityClass}); ${required} is required`,
    }
  }
  return { allowed: true, reason: null }
}
