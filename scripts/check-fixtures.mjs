import fixtures from '../fixtures/predicted-group-order.json' with { type: 'json' }

const validExpectations = new Set(['resolved', 'unresolved', 'partial'])
const validCriteria = new Set([
  'head-to-head-points',
  'head-to-head-goal-difference',
  'head-to-head-goals-scored',
  'overall-goal-difference',
  'overall-goals-scored',
  'recursive-subset-resolved',
  'recursive-subset-unresolved',
])
const recursiveCriteria = new Set([
  'recursive-subset-resolved',
  'recursive-subset-unresolved',
])
const batch2FixtureNames = new Set([
  'two-team-head-to-head-points',
  'three-team-overall-goals-scored-fallback',
  'three-team-head-to-head-goal-difference',
  'three-team-head-to-head-goals-scored',
  'recursive-subset-resolved',
  'recursive-subset-unresolved',
])
const fixtureNames = new Set()

function fail(fixtureName, message) {
  throw new Error(`${fixtureName}: ${message}`)
}

function canonicalPair(teamA, teamB) {
  return [teamA, teamB].sort().join('|')
}

function expectedPairs(teams) {
  const pairs = new Set()

  for (let index = 0; index < teams.length; index += 1) {
    for (let opponent = index + 1; opponent < teams.length; opponent += 1) {
      pairs.add(canonicalPair(teams[index], teams[opponent]))
    }
  }

  return pairs
}

function isExactPermutation(values, teams) {
  return (
    Array.isArray(values) &&
    values.length === teams.length &&
    new Set(values).size === teams.length &&
    values.every((teamId) => teams.includes(teamId))
  )
}

function validateUnresolvedBlocks(fixture) {
  if (!Array.isArray(fixture.unresolved) || fixture.unresolved.length === 0) {
    fail(fixture.name, 'unresolved expectations require at least one tied block')
  }

  for (const block of fixture.unresolved) {
    if (!Array.isArray(block) || block.length < 2) {
      fail(fixture.name, 'each unresolved block must contain at least two teams')
    }

    if (new Set(block).size !== block.length) {
      fail(fixture.name, 'unresolved blocks cannot contain duplicate teams')
    }

    if (block.some((teamId) => !fixture.teams.includes(teamId))) {
      fail(fixture.name, 'unresolved blocks must contain only group teams')
    }
  }
}

function validateProofRow(fixture, row, expectedTeams, label) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    fail(fixture.name, `${label} rows must be objects`)
  }

  if (!expectedTeams.includes(row.teamId)) {
    fail(fixture.name, `${label} rows must reference an expected team`)
  }

  for (const field of ['points', 'goalDifference', 'goalsFor']) {
    if (!Number.isInteger(row[field])) {
      fail(fixture.name, `${label} ${field} values must be integers`)
    }
  }
}

function validateProofTable(fixture, table, expectedTeams, label) {
  if (!Array.isArray(table) || table.length !== expectedTeams.length) {
    fail(fixture.name, `${label} must contain exactly the expected teams`)
  }

  const teamIds = table.map((row) => row?.teamId)
  if (
    new Set(teamIds).size !== expectedTeams.length ||
    teamIds.some((teamId) => !expectedTeams.includes(teamId))
  ) {
    fail(fixture.name, `${label} must contain unique expected team aliases`)
  }

  for (const row of table) {
    validateProofRow(fixture, row, expectedTeams, label)
  }
}

function validateProof(fixture, proof, label) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    fail(fixture.name, `${label} must be an object`)
  }

  if (!validCriteria.has(proof.criterion)) {
    fail(fixture.name, `${label} criterion is not recognised`)
  }

  if (
    !Array.isArray(proof.tiedTeams) ||
    proof.tiedTeams.length < 2 ||
    new Set(proof.tiedTeams).size !== proof.tiedTeams.length ||
    proof.tiedTeams.some((teamId) => !fixture.teams.includes(teamId))
  ) {
    fail(fixture.name, `${label} tied teams must be unique group teams`)
  }

  validateProofTable(
    fixture,
    proof.overall,
    proof.tiedTeams,
    `${label} overall table`,
  )
  validateProofTable(
    fixture,
    proof.headToHead,
    proof.tiedTeams,
    `${label} head-to-head table`,
  )

  const recursive = recursiveCriteria.has(proof.criterion)
  if (recursive) {
    if (
      !Array.isArray(proof.recursiveSubset) ||
      proof.recursiveSubset.length < 2 ||
      proof.recursiveSubset.length >= proof.tiedTeams.length ||
      new Set(proof.recursiveSubset).size !== proof.recursiveSubset.length ||
      proof.recursiveSubset.some(
        (teamId) => !proof.tiedTeams.includes(teamId),
      )
    ) {
      fail(
        fixture.name,
        `${label} recursive subset must be a proper unique subset of tied teams`,
      )
    }

    validateProofTable(
      fixture,
      proof.recursiveHeadToHead,
      proof.recursiveSubset,
      `${label} recursive head-to-head table`,
    )
  } else if (
    'recursiveSubset' in proof ||
    'recursiveHeadToHead' in proof
  ) {
    fail(
      fixture.name,
      `${label} recursive fields are only valid for recursive criteria`,
    )
  }
}

for (const fixture of fixtures) {
  if (typeof fixture.name !== 'string' || fixture.name.trim() === '') {
    fail('<unnamed>', 'fixture name must be non-empty')
  }

  if (fixtureNames.has(fixture.name)) {
    fail(fixture.name, 'fixture name must be unique')
  }
  fixtureNames.add(fixture.name)

  if (
    !Array.isArray(fixture.teams) ||
    fixture.teams.length !== 4 ||
    new Set(fixture.teams).size !== 4
  ) {
    fail(fixture.name, 'fixture must define exactly four unique teams')
  }

  if (!validExpectations.has(fixture.expectation)) {
    fail(fixture.name, 'expectation must be resolved, unresolved or partial')
  }

  if (fixture.criterionProof && fixture.automaticProof) {
    fail(fixture.name, 'fixture cannot define both proof formats')
  }

  if (fixture.criterionProof) {
    validateProof(fixture, fixture.criterionProof, 'criterion proof')
  }

  if (fixture.automaticProof) {
    validateProof(fixture, fixture.automaticProof, 'automatic proof')
  }

  if (batch2FixtureNames.has(fixture.name) && !fixture.automaticProof) {
    fail(fixture.name, 'Batch 2 fixtures must define an automatic proof')
  }

  if (
    typeof fixture.explanation !== 'string' ||
    fixture.explanation.trim() === ''
  ) {
    fail(fixture.name, 'explanation must be non-empty')
  }

  if (!Array.isArray(fixture.matches)) {
    fail(fixture.name, 'matches must be an array')
  }

  const seenPairs = new Set()
  for (const match of fixture.matches) {
    if (!Array.isArray(match) || match.length !== 4) {
      fail(
        fixture.name,
        'every match must be [homeTeamId, awayTeamId, homeScore, awayScore]',
      )
    }

    const [homeTeamId, awayTeamId, homeScore, awayScore] = match
    if (
      !fixture.teams.includes(homeTeamId) ||
      !fixture.teams.includes(awayTeamId) ||
      homeTeamId === awayTeamId
    ) {
      fail(fixture.name, 'match participants must be distinct group teams')
    }

    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      fail(fixture.name, 'scores must be non-negative integers')
    }

    const pair = canonicalPair(homeTeamId, awayTeamId)
    if (seenPairs.has(pair)) {
      fail(fixture.name, `duplicate pairing: ${pair}`)
    }
    seenPairs.add(pair)
  }

  const allPairs = expectedPairs(fixture.teams)
  if (fixture.expectation === 'partial') {
    if (seenPairs.size >= allPairs.size) {
      fail(fixture.name, 'partial fixtures must contain fewer than six pairings')
    }
  } else if (
    seenPairs.size !== allPairs.size ||
    [...allPairs].some((pair) => !seenPairs.has(pair))
  ) {
    fail(fixture.name, 'complete fixtures must contain all six unique pairings')
  }

  if (
    (fixture.expectation === 'resolved' ||
      fixture.expectation === 'partial') &&
    !isExactPermutation(fixture.order, fixture.teams)
  ) {
    fail(
      fixture.name,
      'resolved and partial orders must be exact team permutations',
    )
  }

  if (fixture.order && !isExactPermutation(fixture.order, fixture.teams)) {
    fail(fixture.name, 'orders must be exact team permutations')
  }

  if (fixture.expectation === 'unresolved' || fixture.unresolved) {
    validateUnresolvedBlocks(fixture)
  }
}

for (const fixtureName of batch2FixtureNames) {
  if (!fixtureNames.has(fixtureName)) {
    fail(fixtureName, 'required Batch 2 fixture is missing')
  }
}

console.log(`validated ${fixtures.length} predicted-group-order fixtures`)
